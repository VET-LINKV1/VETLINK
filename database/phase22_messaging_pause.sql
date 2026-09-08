-- ============================================================
-- VETLINK Phase 22: Let staff pause messaging on a conversation
-- Run in Supabase SQL Editor ONCE, AFTER phase13_comms.sql and
-- fix_vet_specific_messaging.sql.
--
-- Gives admin/staff/vet a way to temporarily stop a specific pet
-- owner from sending new chat messages -- useful for a difficult
-- or abusive client -- without deleting the conversation history
-- or blocking the clinic's own ability to reach out to them.
-- ============================================================

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS messaging_disabled        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS messaging_disabled_reason  TEXT,
  ADD COLUMN IF NOT EXISTS messaging_disabled_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS messaging_disabled_by      UUID REFERENCES public.users(id);

-- Re-create the staff inbox view to expose the new fields
-- (same shape as fix_vet_specific_messaging.sql, plus these 4 columns).
DROP VIEW IF EXISTS public.v_conversation_list;
CREATE OR REPLACE VIEW public.v_conversation_list AS
SELECT
  c.id,
  c.client_id,
  c.assigned_vet_id,
  c.last_message_at,
  c.last_message_preview,
  c.unread_for_client,
  c.unread_for_staff,
  c.is_archived,
  c.messaging_disabled,
  c.messaging_disabled_reason,
  c.messaging_disabled_at,
  c.messaging_disabled_by,
  u.name             AS client_name,
  u.email            AS client_email,
  u.phone_number     AS client_phone,
  u.avatar_url       AS client_avatar,
  v.name             AS assigned_vet_name
FROM public.conversations c
JOIN public.users u ON u.id = c.client_id
LEFT JOIN public.users v ON v.id = c.assigned_vet_id;

-- Verify
SELECT 'v_conversation_list now includes messaging_disabled' AS status;
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name LIKE 'messaging_disabled%';
