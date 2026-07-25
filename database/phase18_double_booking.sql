-- ============================================================
-- VETLINK Phase 18: Double-Booking Prevention & Vet Decline
-- Run in Supabase SQL Editor AFTER phase17_no_show_policy.sql
--
-- Adds:
--   * 'no_show' and 'declined' to appointment_status enum (if not already)
--   * Exclusion constraint to prevent overlapping appointments
--     for the same vet on the same time slot
--   * declined_by / declined_at / declined_reason columns
-- ============================================================

-- ── Ensure all new enum values exist (safe to re-run) ────────
DO $$ BEGIN
  ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'no_show';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN invalid_text_representation THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'declined';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN invalid_text_representation THEN NULL; END $$;

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Drop if exists (idempotent)
DROP INDEX IF EXISTS idx_appt_no_overlap;

-- Create exclusion constraint using a unique index with COALESCE
-- so NULL vet_id doesn't interfere (walk-ins without assigned vet).
CREATE UNIQUE INDEX IF NOT EXISTS idx_appt_no_overlap
  ON public.appointments (vet_id, appointment_at)
  WHERE status IN ('pending', 'confirmed')
    AND vet_id IS NOT NULL
    AND appointment_at IS NOT NULL;

-- Note: For true range-based exclusion (accounting for duration_mins)
-- we'd need a proper exclusion constraint, but PostgreSQL exclusion
-- constraints have limitations with partial indexes. Instead, the
-- application layer does the authoritative check via the
-- get_available_slots SQL function, and the unique index above
-- prevents exact-duplicate inserts at the same millisecond.

-- ── Add declined_by and declined_at columns to appointments ──
DO $$ BEGIN
  ALTER TABLE public.appointments
    ADD COLUMN declined_by   UUID REFERENCES public.users(id);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.appointments
    ADD COLUMN declined_at   TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.appointments
    ADD COLUMN declined_reason TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Index for vet to quickly see pending bookings
CREATE INDEX IF NOT EXISTS idx_appt_vet_pending
  ON public.appointments(vet_id, status)
  WHERE status = 'pending' AND vet_id IS NOT NULL;
