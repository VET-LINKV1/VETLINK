-- SMS Opt-in/Opt-out System
-- Run in Supabase SQL Editor.

-- 1. Add sms_opt_in column to users (default true for existing users)
DO $$ BEGIN
  ALTER TABLE public.users ADD COLUMN sms_opt_in BOOLEAN NOT NULL DEFAULT true;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 2. Create a view for SMS-eligible users
CREATE OR REPLACE VIEW public.sms_eligible_users AS
SELECT id, name, phone_number, role
FROM public.users
WHERE is_active = true
  AND sms_opt_in = true
  AND phone_number IS NOT NULL
  AND phone_number != '';
