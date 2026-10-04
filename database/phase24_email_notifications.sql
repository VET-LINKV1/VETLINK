-- ============================================================
-- VETLINK Phase 24: Email notification settings
-- Run in Supabase SQL Editor ONCE, AFTER phase20_settings.sql.
--
-- The Notification Settings page now configures EMAIL instead of
-- SMS (ClickSend). Adds the email master switch + sender name.
-- (The sender address already lives in settings_notifications.email_from.)
-- Safe to re-run.
-- ============================================================
ALTER TABLE public.settings_notifications
  ADD COLUMN IF NOT EXISTS email_enabled   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_from_name TEXT;

-- Carry the old SMS "From name" over as the email sender name.
UPDATE public.settings_notifications
   SET email_from_name = clicksend_from
 WHERE email_from_name IS NULL AND clicksend_from IS NOT NULL;
