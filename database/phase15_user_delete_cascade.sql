-- ============================================================
-- VETLINK Phase 15: User Deletion Cascade
-- Run in Supabase SQL Editor ONCE.
--
-- Adds ON DELETE CASCADE / SET NULL to all foreign keys
-- referencing public.users(id) that were missing them,
-- so admins can delete users without database errors.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Rename existing FK constraints so we can re-create them
--    with CASCADE.  We use a PL/pgSQL block so missing or
--    already-dropped constraints don't abort the script.
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  -- appointments
  ALTER TABLE public.appointments
    DROP CONSTRAINT IF EXISTS appointments_client_id_fkey,
    ADD CONSTRAINT appointments_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE CASCADE;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.appointments
    DROP CONSTRAINT IF EXISTS appointments_vet_id_fkey,
    ADD CONSTRAINT appointments_vet_id_fkey
      FOREIGN KEY (vet_id) REFERENCES public.users(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.appointments
    DROP CONSTRAINT IF EXISTS appointments_triaged_by_fkey,
    ADD CONSTRAINT appointments_triaged_by_fkey
      FOREIGN KEY (triaged_by) REFERENCES public.users(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- medical_records
DO $$ BEGIN
  ALTER TABLE public.medical_records
    DROP CONSTRAINT IF EXISTS medical_records_vet_id_fkey,
    ADD CONSTRAINT medical_records_vet_id_fkey
      FOREIGN KEY (vet_id) REFERENCES public.users(id) ON DELETE CASCADE;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- payments
DO $$ BEGIN
  ALTER TABLE public.payments
    DROP CONSTRAINT IF EXISTS payments_user_id_fkey,
    ADD CONSTRAINT payments_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- soap_notes
DO $$ BEGIN
  ALTER TABLE public.soap_notes
    DROP CONSTRAINT IF EXISTS soap_notes_vet_id_fkey,
    ADD CONSTRAINT soap_notes_vet_id_fkey
      FOREIGN KEY (vet_id) REFERENCES public.users(id) ON DELETE CASCADE;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- emr_files
DO $$ BEGIN
  ALTER TABLE public.emr_files
    DROP CONSTRAINT IF EXISTS emr_files_uploaded_by_fkey,
    ADD CONSTRAINT emr_files_uploaded_by_fkey
      FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- vaccinations
DO $$ BEGIN
  ALTER TABLE public.vaccinations
    DROP CONSTRAINT IF EXISTS vaccinations_vet_id_fkey,
    ADD CONSTRAINT vaccinations_vet_id_fkey
      FOREIGN KEY (vet_id) REFERENCES public.users(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- prescriptions
DO $$ BEGIN
  ALTER TABLE public.prescriptions
    DROP CONSTRAINT IF EXISTS prescriptions_vet_id_fkey,
    ADD CONSTRAINT prescriptions_vet_id_fkey
      FOREIGN KEY (vet_id) REFERENCES public.users(id) ON DELETE CASCADE;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- treatments
DO $$ BEGIN
  ALTER TABLE public.treatments
    DROP CONSTRAINT IF EXISTS treatments_vet_id_fkey,
    ADD CONSTRAINT treatments_vet_id_fkey
      FOREIGN KEY (vet_id) REFERENCES public.users(id) ON DELETE CASCADE;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- pet_weights
DO $$ BEGIN
  ALTER TABLE public.pet_weights
    DROP CONSTRAINT IF EXISTS pet_weights_recorded_by_fkey,
    ADD CONSTRAINT pet_weights_recorded_by_fkey
      FOREIGN KEY (recorded_by) REFERENCES public.users(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- passport_shares
DO $$ BEGIN
  ALTER TABLE public.passport_shares
    DROP CONSTRAINT IF EXISTS passport_shares_created_by_fkey,
    ADD CONSTRAINT passport_shares_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- appointment_intakes
DO $$ BEGIN
  ALTER TABLE public.appointment_intakes
    DROP CONSTRAINT IF EXISTS appointment_intakes_submitted_by_fkey,
    ADD CONSTRAINT appointment_intakes_submitted_by_fkey
      FOREIGN KEY (submitted_by) REFERENCES public.users(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- discharge_instructions
DO $$ BEGIN
  ALTER TABLE public.discharge_instructions
    DROP CONSTRAINT IF EXISTS discharge_instructions_vet_id_fkey,
    ADD CONSTRAINT discharge_instructions_vet_id_fkey
      FOREIGN KEY (vet_id) REFERENCES public.users(id) ON DELETE CASCADE;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- refill_requests
DO $$ BEGIN
  ALTER TABLE public.refill_requests
    DROP CONSTRAINT IF EXISTS refill_requests_requested_by_fkey,
    ADD CONSTRAINT refill_requests_requested_by_fkey
      FOREIGN KEY (requested_by) REFERENCES public.users(id) ON DELETE CASCADE;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.refill_requests
    DROP CONSTRAINT IF EXISTS refill_requests_processed_by_fkey,
    ADD CONSTRAINT refill_requests_processed_by_fkey
      FOREIGN KEY (processed_by) REFERENCES public.users(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- messages
DO $$ BEGIN
  ALTER TABLE public.messages
    DROP CONSTRAINT IF EXISTS messages_sender_id_fkey,
    ADD CONSTRAINT messages_sender_id_fkey
      FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- video_consultations
DO $$ BEGIN
  ALTER TABLE public.video_consultations
    DROP CONSTRAINT IF EXISTS video_consultations_vet_id_fkey,
    ADD CONSTRAINT video_consultations_vet_id_fkey
      FOREIGN KEY (vet_id) REFERENCES public.users(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.video_consultations
    DROP CONSTRAINT IF EXISTS video_consultations_created_by_fkey,
    ADD CONSTRAINT video_consultations_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- health_check_results
DO $$ BEGIN
  ALTER TABLE public.health_check_results
    DROP CONSTRAINT IF EXISTS health_check_results_performed_by_fkey,
    ADD CONSTRAINT health_check_results_performed_by_fkey
      FOREIGN KEY (performed_by) REFERENCES public.users(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- prescriptive_resource_usage
DO $$ BEGIN
  ALTER TABLE public.prescriptive_resource_usage
    DROP CONSTRAINT IF EXISTS prescriptive_resource_usage_used_by_fkey,
    ADD CONSTRAINT prescriptive_resource_usage_used_by_fkey
      FOREIGN KEY (used_by) REFERENCES public.users(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- prescriptive_actions
DO $$ BEGIN
  ALTER TABLE public.prescriptive_actions
    DROP CONSTRAINT IF EXISTS prescriptive_actions_acted_by_fkey,
    ADD CONSTRAINT prescriptive_actions_acted_by_fkey
      FOREIGN KEY (acted_by) REFERENCES public.users(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- notification preferences / contacts (phase4_payments migration)
DO $$ BEGIN
  ALTER TABLE public.payments
    DROP CONSTRAINT IF EXISTS payments_user_id_fkey1,
    ADD CONSTRAINT payments_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
EXCEPTION WHEN undefined_object THEN NULL; END $$;


-- ────────────────────────────────────────────────────────────
-- 2. Verify no missing ON DELETE CASCADE remains on users(id)
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  missing INT;
BEGIN
  SELECT COUNT(*) INTO missing
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
   WHERE tc.constraint_type = 'FOREIGN KEY'
     AND ccu.table_name    = 'users'
     AND ccu.column_name   = 'id'
     AND ccu.table_schema  = 'public'
     AND rc.delete_rule    = 'NO ACTION';

  IF missing > 0 THEN
    RAISE NOTICE 'Remaining FK constraints without CASCADE: %', missing;
  ELSE
    RAISE NOTICE 'All foreign keys on public.users now have CASCADE or SET NULL.';
  END IF;
END $$;

