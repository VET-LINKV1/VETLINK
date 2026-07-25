-- Vet-Specific Messaging Fix
-- Run in Supabase SQL Editor.
--
-- Adds assigned_vet_id to conversations so each client's messages
-- go only to their assigned vet. Staff/admin still see everything.

-- 1. Add vet assignment column to conversations
DO $$ BEGIN
  ALTER TABLE public.conversations
    ADD COLUMN assigned_vet_id UUID REFERENCES public.users(id);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_conversations_vet ON public.conversations(assigned_vet_id);

-- 2. Update get_or_create_conversation to auto-assign vet
-- Based on the client's most recent appointment's assigned vet
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(p_client UUID)
RETURNS public.conversations LANGUAGE plpgsql AS $$
DECLARE
  conv public.conversations%ROWTYPE;
  v_vet UUID;
BEGIN
  SELECT * INTO conv FROM public.conversations WHERE client_id = p_client;
  IF NOT FOUND THEN
    -- Find the client's most recent appointment's vet
    SELECT a.vet_id INTO v_vet
      FROM public.appointments a
     WHERE a.client_id = p_client
       AND a.vet_id IS NOT NULL
       AND a.status IN ('pending','confirmed','completed')
     ORDER BY a.appointment_at DESC
     LIMIT 1;

    INSERT INTO public.conversations (client_id, assigned_vet_id)
      VALUES (p_client, v_vet)
      RETURNING * INTO conv;
  ELSIF conv.assigned_vet_id IS NULL THEN
    -- Existing conversation without a vet assigned — backfill
    SELECT a.vet_id INTO v_vet
      FROM public.appointments a
     WHERE a.client_id = p_client
       AND a.vet_id IS NOT NULL
       AND a.status IN ('pending','confirmed','completed')
     ORDER BY a.appointment_at DESC
     LIMIT 1;
    IF v_vet IS NOT NULL THEN
      UPDATE public.conversations SET assigned_vet_id = v_vet WHERE id = conv.id;
      conv.assigned_vet_id := v_vet;
    END IF;
  END IF;
  RETURN conv;
END;
$$;


-- 3. Update v_conversation_list to include vet assignment
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
  u.name             AS client_name,
  u.email            AS client_email,
  u.phone_number     AS client_phone,
  u.avatar_url       AS client_avatar,
  v.name             AS assigned_vet_name
FROM public.conversations c
JOIN public.users u ON u.id = c.client_id
LEFT JOIN public.users v ON v.id = c.assigned_vet_id;
