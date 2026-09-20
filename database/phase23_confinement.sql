-- ============================================================
-- VETLINK Phase 23: Pet Confinement / Boarding & Hospitalization
-- Run in Supabase SQL Editor ONCE, AFTER phase1_schema.sql and
-- phase19_services_fixed.sql (uses public.is_clinical_staff()).
--
-- Adds:
--   * confinement_status enum   (active / discharged / cancelled)
--   * confinements table        -- one row per stay (boarding,
--                                   post-op recovery, hospitalization,
--                                   observation, IV therapy, etc.)
--   * confinement_logs table    -- staff/vet monitoring notes +
--                                   optional vitals while confined
--   * v_confinement_list view   -- confinements joined with pet/
--                                   owner/vet names for the UI
--
-- A pet is "confined" when it stays at the clinic rather than going
-- home the same day. This lets staff track where a boarded/admitted
-- pet is, why, who's watching it, and keep a running log the owner
-- can also see (read-only) while their pet is confined.
-- ============================================================

DO $$ BEGIN
  CREATE TYPE confinement_status AS ENUM ('active', 'discharged', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- TABLE: confinements
-- ============================================================
CREATE TABLE IF NOT EXISTS public.confinements (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id                 UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  client_id              UUID NOT NULL REFERENCES public.users(id),
  vet_id                 UUID REFERENCES public.users(id),
  appointment_id         UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  location               TEXT,                  -- free text, e.g. "Kennel 3", "ICU Bay 1"
  reason                 TEXT NOT NULL,
  status                 confinement_status NOT NULL DEFAULT 'active',
  admitted_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expected_discharge_at  TIMESTAMPTZ,
  discharged_at          TIMESTAMPTZ,
  discharge_notes        TEXT,
  admitted_by            UUID REFERENCES public.users(id),
  discharged_by          UUID REFERENCES public.users(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_confinements_pet      ON public.confinements(pet_id);
CREATE INDEX IF NOT EXISTS idx_confinements_client    ON public.confinements(client_id);
CREATE INDEX IF NOT EXISTS idx_confinements_vet       ON public.confinements(vet_id);
CREATE INDEX IF NOT EXISTS idx_confinements_status    ON public.confinements(status);

DROP TRIGGER IF EXISTS confinements_updated_at ON public.confinements;
CREATE TRIGGER confinements_updated_at
  BEFORE UPDATE ON public.confinements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Only one ACTIVE confinement per pet at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_confinements_one_active_per_pet
  ON public.confinements(pet_id) WHERE (status = 'active');

-- ============================================================
-- TABLE: confinement_logs
-- Monitoring notes + optional vitals, one row per check-in while
-- the pet is confined (feeding, meds given, temperature, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.confinement_logs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  confinement_id    UUID NOT NULL REFERENCES public.confinements(id) ON DELETE CASCADE,
  logged_by         UUID REFERENCES public.users(id),
  note              TEXT,
  temperature_c     NUMERIC(4,1),
  heart_rate_bpm    INT,
  respiration_rate  INT,
  weight_kg         NUMERIC(6,2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_confinement_logs_confinement
  ON public.confinement_logs(confinement_id, created_at DESC);

-- ============================================================
-- VIEW: v_confinement_list
-- ============================================================
CREATE OR REPLACE VIEW public.v_confinement_list AS
SELECT
  c.*,
  p.name          AS pet_name,
  p.species       AS pet_species,
  p.breed         AS pet_breed,
  owner.name      AS client_name,
  owner.phone_number AS client_phone,
  vet.name        AS vet_name,
  admitter.name   AS admitted_by_name,
  dischargr.name  AS discharged_by_name
FROM public.confinements c
JOIN public.pets  p       ON p.id = c.pet_id
JOIN public.users owner   ON owner.id = c.client_id
LEFT JOIN public.users vet       ON vet.id = c.vet_id
LEFT JOIN public.users admitter  ON admitter.id = c.admitted_by
LEFT JOIN public.users dischargr ON dischargr.id = c.discharged_by;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.confinements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confinement_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "confinements_staff_all" ON public.confinements;
DROP POLICY IF EXISTS "confinements_client_read" ON public.confinements;
CREATE POLICY "confinements_staff_all"
  ON public.confinements FOR ALL
  USING (public.is_clinical_staff(auth.uid()))
  WITH CHECK (public.is_clinical_staff(auth.uid()));
CREATE POLICY "confinements_client_read"
  ON public.confinements FOR SELECT
  USING (client_id = auth.uid());

DROP POLICY IF EXISTS "confinement_logs_staff_all" ON public.confinement_logs;
DROP POLICY IF EXISTS "confinement_logs_client_read" ON public.confinement_logs;
CREATE POLICY "confinement_logs_staff_all"
  ON public.confinement_logs FOR ALL
  USING (public.is_clinical_staff(auth.uid()))
  WITH CHECK (public.is_clinical_staff(auth.uid()));
CREATE POLICY "confinement_logs_client_read"
  ON public.confinement_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.confinements c
    WHERE c.id = confinement_logs.confinement_id AND c.client_id = auth.uid()
  ));

-- Verify
SELECT 'confinements + confinement_logs created' AS status;
SELECT COUNT(*) AS confinement_tables FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('confinements', 'confinement_logs');
