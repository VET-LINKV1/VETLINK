-- ============================================================
-- VETLINK Phase 21: Fix reason_code to allow admin-defined services
-- Run in Supabase SQL Editor ONCE.
--
-- Why: Phase 19 made appointment reasons a fully admin-editable
-- catalog (public.services, code is free TEXT) so staff can add
-- new services like "Castration" from Admin > Services. But
-- Phase 11 had already made public.appointments.reason_code a
-- fixed ENUM (appointment_reason) hardcoded to only 6 original
-- values (annual_checkup / vaccination / grooming / injury /
-- emergency / other). Any custom service added later fails to
-- book with:
--   invalid input value for enum appointment_reason: "castration"
--
-- Fix: widen reason_code from the ENUM to TEXT so it can store
-- any service code from public.services, matching how the rest
-- of the app (booking validation, the services catalog) already
-- treats it as free text. No data is lost -- existing values are
-- simply reinterpreted as TEXT.
-- ============================================================

ALTER TABLE public.appointments
  ALTER COLUMN reason_code TYPE TEXT USING reason_code::TEXT;

-- Verify
SELECT 'appointments.reason_code is now TEXT -- any active service code can be booked' AS status;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'reason_code';
