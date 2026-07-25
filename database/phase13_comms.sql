-- ============================================================
-- VETLINK Phase 13: Direct Support & Communication Channels
-- Run in Supabase SQL Editor AFTER phase11_booking.sql
-- (appointments, pets, users, emr_files must already exist)
--
-- Adds:
--   * conversations            — one per client-clinic relationship
--   * conversation_participants — owner + every staff that has replied
--   * messages                  — chat messages with optional pet/appt tag
--   * message_attachments       — file/photo/video uploads per message
--   * video_consultations       — Jitsi-room-backed telehealth sessions
--   * consultation_notes        — vet's clinical notes from a consult
--
-- Realtime: messages, message_attachments, video_consultations, and
-- consultation_notes are added to the `supabase_realtime` publication
-- so the React app can subscribe to row changes.
-- ============================================================

-- ── ENUMS ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE message_kind AS ENUM ('text', 'image', 'video', 'file', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE consult_status AS ENUM ('scheduled', 'waiting', 'in_progress', 'completed', 'cancelled', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- TABLE: conversations
-- One ongoing thread per client. Created lazily on first message.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id          UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  last_message_at    TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_for_client  INT NOT NULL DEFAULT 0,
  unread_for_staff   INT NOT NULL DEFAULT 0,
  is_archived        BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS conversations_updated_at ON public.conversations;
CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_conversations_client ON public.conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last   ON public.conversations(last_message_at DESC);


-- ============================================================
-- TABLE: conversation_participants
-- Logs every staff member that has interacted with a conversation
-- (lets multiple vets / staff share a single client thread).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_at    TIMESTAMPTZ,
  UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_part_conv ON public.conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_part_user ON public.conversation_participants(user_id);


-- ============================================================
-- TABLE: messages
-- Each message belongs to a conversation; optional pet/appt tag
-- lets the UI filter "all messages about Max" or "messages from
-- this appointment".
-- ============================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES public.users(id),
  sender_role     user_role NOT NULL,
  kind            message_kind NOT NULL DEFAULT 'text',
  body            TEXT,
  pet_id          UUID REFERENCES public.pets(id) ON DELETE SET NULL,
  appointment_id  UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  reply_to_id     UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  is_deleted      BOOLEAN NOT NULL DEFAULT false,
  edited_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conv         ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender       ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_pet          ON public.messages(pet_id);
CREATE INDEX IF NOT EXISTS idx_messages_appt         ON public.messages(appointment_id);


-- ============================================================
-- TABLE: message_attachments
-- N attachments per message. Bucket key: chat-files/<conv>/<message>/<filename>.
-- Stores enough metadata that the UI can render a preview card
-- without re-hitting Storage on every render.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.message_attachments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id    UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  mime_type     TEXT,
  size_bytes    BIGINT,
  -- Loose categorization for UI rendering
  kind          message_kind NOT NULL DEFAULT 'file',
  width         INT,
  height        INT,
  duration_sec  NUMERIC(6,2),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_msg_attach_msg ON public.message_attachments(message_id);


-- ============================================================
-- TABLE: video_consultations
-- A telehealth session backed by a Jitsi Meet room. The `room_name`
-- is a long random slug; both parties join via the URL
--   https://meet.jit.si/<room_name>
-- We track when each party joined so the vet can leave the
-- waiting room only after the client connects.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.video_consultations (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id     UUID UNIQUE REFERENCES public.appointments(id) ON DELETE SET NULL,
  conversation_id    UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  pet_id             UUID REFERENCES public.pets(id) ON DELETE SET NULL,
  client_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vet_id             UUID REFERENCES public.users(id),
  room_name          TEXT NOT NULL UNIQUE,    -- e.g. "vetlink-9e2b1d77b6"
  jitsi_base_url     TEXT NOT NULL DEFAULT 'https://meet.jit.si',
  scheduled_at       TIMESTAMPTZ,
  status             consult_status NOT NULL DEFAULT 'scheduled',
  client_joined_at   TIMESTAMPTZ,
  vet_joined_at      TIMESTAMPTZ,
  started_at         TIMESTAMPTZ,
  ended_at           TIMESTAMPTZ,
  duration_sec       INT,
  cancel_reason      TEXT,
  created_by         UUID REFERENCES public.users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS video_consultations_updated_at ON public.video_consultations;
CREATE TRIGGER video_consultations_updated_at
  BEFORE UPDATE ON public.video_consultations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_consult_client ON public.video_consultations(client_id);
CREATE INDEX IF NOT EXISTS idx_consult_vet    ON public.video_consultations(vet_id);
CREATE INDEX IF NOT EXISTS idx_consult_appt   ON public.video_consultations(appointment_id);
CREATE INDEX IF NOT EXISTS idx_consult_status ON public.video_consultations(status);
CREATE INDEX IF NOT EXISTS idx_consult_sched  ON public.video_consultations(scheduled_at DESC);


-- ============================================================
-- TABLE: consultation_notes
-- Vet's clinical write-up for a telehealth session. Mirrors the
-- structure of a SOAP note but lives separately from medical_records
-- so we can show consult-specific UI affordances.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.consultation_notes (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consultation_id    UUID NOT NULL UNIQUE REFERENCES public.video_consultations(id) ON DELETE CASCADE,
  vet_id             UUID REFERENCES public.users(id),
  subjective         TEXT,
  objective          TEXT,
  assessment         TEXT,
  plan               TEXT,
  follow_up_required BOOLEAN NOT NULL DEFAULT false,
  follow_up_date     DATE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS consultation_notes_updated_at ON public.consultation_notes;
CREATE TRIGGER consultation_notes_updated_at
  BEFORE UPDATE ON public.consultation_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_consult_notes_consult ON public.consultation_notes(consultation_id);


-- ============================================================
-- VIEW: v_conversation_list
-- Per-conversation summary for inbox UI: client info, last message,
-- unread counts. Staff use this to list every active conversation.
-- ============================================================
CREATE OR REPLACE VIEW public.v_conversation_list AS
SELECT
  c.id,
  c.client_id,
  c.last_message_at,
  c.last_message_preview,
  c.unread_for_client,
  c.unread_for_staff,
  c.is_archived,
  u.name             AS client_name,
  u.email            AS client_email,
  u.phone_number     AS client_phone,
  u.avatar_url       AS client_avatar
FROM public.conversations c
JOIN public.users u ON u.id = c.client_id;


-- ============================================================
-- TRIGGER: keep conversations.last_message_* in sync
-- on every new message insert.
-- ============================================================
CREATE OR REPLACE FUNCTION public.bump_conversation_on_message()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Truncate preview to keep the inbox row light.
  UPDATE public.conversations
     SET last_message_at      = NEW.created_at,
         last_message_preview = CASE
           WHEN NEW.kind = 'text' THEN LEFT(COALESCE(NEW.body, ''), 160)
           WHEN NEW.kind = 'image' THEN '📷 Image'
           WHEN NEW.kind = 'video' THEN '🎥 Video'
           WHEN NEW.kind = 'file'  THEN '📎 File'
           WHEN NEW.kind = 'system' THEN COALESCE(NEW.body, '— system —')
           ELSE COALESCE(NEW.body, '')
         END,
         unread_for_client = CASE
           WHEN NEW.sender_role = 'client' THEN unread_for_client
           ELSE unread_for_client + 1
         END,
         unread_for_staff = CASE
           WHEN NEW.sender_role = 'client' THEN unread_for_staff + 1
           ELSE unread_for_staff
         END
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bump_conv_ai ON public.messages;
CREATE TRIGGER bump_conv_ai
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_on_message();


-- ============================================================
-- HELPER: get_or_create_conversation(client_id)
-- Idempotent — creates the row on first call, returns it.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(p_client UUID)
RETURNS public.conversations LANGUAGE plpgsql AS $$
DECLARE
  conv public.conversations%ROWTYPE;
BEGIN
  SELECT * INTO conv FROM public.conversations WHERE client_id = p_client;
  IF NOT FOUND THEN
    INSERT INTO public.conversations (client_id) VALUES (p_client) RETURNING * INTO conv;
  END IF;
  RETURN conv;
END;
$$;


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.conversations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_consultations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_notes      ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_staff(uid UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = uid AND u.role IN ('admin','veterinarian','staff'));
$$;

-- conversations: staff all, client own
DROP POLICY IF EXISTS "conv_staff_all"  ON public.conversations;
DROP POLICY IF EXISTS "conv_client_rw"  ON public.conversations;
CREATE POLICY "conv_staff_all" ON public.conversations FOR ALL
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "conv_client_rw" ON public.conversations FOR ALL
  USING (client_id = auth.uid()) WITH CHECK (client_id = auth.uid());

-- participants: staff all, client see own conversations
DROP POLICY IF EXISTS "convpart_staff_all"  ON public.conversation_participants;
DROP POLICY IF EXISTS "convpart_client_read" ON public.conversation_participants;
CREATE POLICY "convpart_staff_all" ON public.conversation_participants FOR ALL
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "convpart_client_read" ON public.conversation_participants FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.client_id = auth.uid()));

-- messages: staff all; client read/write only their own thread
DROP POLICY IF EXISTS "msg_staff_all"  ON public.messages;
DROP POLICY IF EXISTS "msg_client_rw"  ON public.messages;
CREATE POLICY "msg_staff_all" ON public.messages FOR ALL
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "msg_client_rw" ON public.messages FOR ALL
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.client_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.client_id = auth.uid()));

-- attachments inherit message permissions
DROP POLICY IF EXISTS "att_staff_all"  ON public.message_attachments;
DROP POLICY IF EXISTS "att_client_read" ON public.message_attachments;
CREATE POLICY "att_staff_all" ON public.message_attachments FOR ALL
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "att_client_read" ON public.message_attachments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
     WHERE m.id = message_id AND c.client_id = auth.uid()
  ));

-- video_consultations: staff all; client see own
DROP POLICY IF EXISTS "consult_staff_all" ON public.video_consultations;
DROP POLICY IF EXISTS "consult_client_rw" ON public.video_consultations;
CREATE POLICY "consult_staff_all" ON public.video_consultations FOR ALL
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "consult_client_rw" ON public.video_consultations FOR ALL
  USING (client_id = auth.uid()) WITH CHECK (client_id = auth.uid());

-- consultation_notes: staff all; client read only
DROP POLICY IF EXISTS "consnotes_staff_all"  ON public.consultation_notes;
DROP POLICY IF EXISTS "consnotes_client_read" ON public.consultation_notes;
CREATE POLICY "consnotes_staff_all" ON public.consultation_notes FOR ALL
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "consnotes_client_read" ON public.consultation_notes FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.video_consultations v
                  WHERE v.id = consultation_id AND v.client_id = auth.uid()));


-- ============================================================
-- SUPABASE STORAGE — 'chat-files' bucket
-- Private; the Express backend mints signed URLs for downloads.
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-files', 'chat-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "chat_files_staff_all"  ON storage.objects;
CREATE POLICY "chat_files_staff_all"
  ON storage.objects FOR ALL
  USING (bucket_id = 'chat-files' AND public.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'chat-files' AND public.is_staff(auth.uid()));

-- Client read scoped by conversation_id embedded in the object key path
DROP POLICY IF EXISTS "chat_files_client_read" ON storage.objects;
CREATE POLICY "chat_files_client_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'chat-files' AND
    EXISTS (
      SELECT 1 FROM public.conversations c
       WHERE c.client_id = auth.uid()
         AND split_part(name, '/', 1) = c.id::text
    )
  );


-- ============================================================
-- REALTIME — add the chatty tables to the supabase_realtime publication
-- so the React app can subscribe to row changes.
-- (Safe to re-run; ALTER PUBLICATION ADD TABLE is idempotent only
--  if the table isn't already a member, so we catch duplicate errors.)
-- ============================================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.message_attachments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.video_consultations;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
