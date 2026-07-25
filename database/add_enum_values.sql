-- Run this FIRST in Supabase SQL Editor to add missing enum values.
-- If you get "already exists" errors, that's fine — just ignore them.
-- After this succeeds, run phase17 and phase18 normally.

DO $$ BEGIN
  ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'no_show';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN invalid_text_representation THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'declined';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN invalid_text_representation THEN NULL; END $$;
