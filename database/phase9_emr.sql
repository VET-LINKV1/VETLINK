-- ============================================================
-- VETLINK Phase 9: Advanced EMR Module
-- Run in Supabase SQL Editor AFTER phase3_schema.sql
--
-- Adds:
--   * soap_notes          (Subjective/Objective/Assessment/Plan)
--   * emr_files           (X-rays, lab results, prescriptions, docs)
--   * vaccinations        (with due dates + reminders)
--   * prescriptions       (medications prescribed per pet)
--   * treatments          (procedures performed, separate from rx)
--   * medical_timeline_v  (unified per-pet timeline view)
--
-- Requires Supabase Storage bucket: 'emr-files' (private).
-- Storage policies are included at the bottom of this file.
-- ============================================================

-- ── ENUMS ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE emr_file_kind AS ENUM ('xray', 'lab_result', 'prescription_doc', 'document', 'photo', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE vaccination_status AS ENUM ('scheduled', 'administered', 'overdue', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE prescription_status AS ENUM ('active', 'completed', 'discontinued', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE treatment_status AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- TABLE: soap_notes
-- One-to-one (logical) with a medical_record; the SOAP note
-- captures structured clinical reasoning for a single visit.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.soap_notes (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  medical_record_id  UUID NOT NULL REFERENCES public.medical_records(id) ON DELETE CASCADE,
  pet_id             UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  vet_id             UUID NOT NULL REFERENCES public.users(id),
  subjective         TEXT,   -- chief complaint, history, owner's report
  objective          TEXT,   -- vital signs, physical exam findings
  assessment         TEXT,   -- diagnosis / differential
  plan               TEXT,   -- treatment plan, follow-up
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (medical_record_id)
);

DROP TRIGGER IF EXISTS soap_notes_updated_at ON public.soap_notes;
CREATE TRIGGER soap_notes_updated_at
  BEFORE UPDATE ON public.soap_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_soap_notes_pet_id ON public.soap_notes(pet_id);
CREATE INDEX IF NOT EXISTS idx_soap_notes_vet_id ON public.soap_notes(vet_id);
CREATE INDEX IF NOT EXISTS idx_soap_notes_record ON public.soap_notes(medical_record_id);

-- Full-text search across all four SOAP fields
CREATE INDEX IF NOT EXISTS idx_soap_notes_fts
  ON public.soap_notes
  USING GIN (to_tsvector('english',
    coalesce(subjective,'') || ' ' ||
    coalesce(objective,'')  || ' ' ||
    coalesce(assessment,'') || ' ' ||
    coalesce(plan,'')));


-- ============================================================
-- TABLE: emr_files
-- File metadata for anything stored in Supabase Storage:
-- X-rays, lab PDFs, scanned prescriptions, photos, documents.
-- The actual bytes live in the 'emr-files' bucket; storage_path
-- is the object key within that bucket.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.emr_files (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id            UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  medical_record_id UUID REFERENCES public.medical_records(id) ON DELETE SET NULL,
  uploaded_by       UUID NOT NULL REFERENCES public.users(id),
  kind              emr_file_kind NOT NULL DEFAULT 'document',
  title             TEXT NOT NULL,
  description       TEXT,
  storage_path      TEXT NOT NULL,        -- key in 'emr-files' bucket
  mime_type         TEXT,
  size_bytes        BIGINT,
  is_archived       BOOLEAN NOT NULL DEFAULT false,
  metadata          JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS emr_files_updated_at ON public.emr_files;
CREATE TRIGGER emr_files_updated_at
  BEFORE UPDATE ON public.emr_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_emr_files_pet     ON public.emr_files(pet_id);
CREATE INDEX IF NOT EXISTS idx_emr_files_record  ON public.emr_files(medical_record_id);
CREATE INDEX IF NOT EXISTS idx_emr_files_kind    ON public.emr_files(kind);
CREATE INDEX IF NOT EXISTS idx_emr_files_created ON public.emr_files(created_at DESC);


-- ============================================================
-- TABLE: vaccinations
-- Tracks vaccines administered and upcoming due dates.
-- A row with administered_date IS NULL represents a scheduled
-- (upcoming) vaccination; once given, administered_date is set.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vaccinations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id            UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  vet_id            UUID REFERENCES public.users(id),
  medical_record_id UUID REFERENCES public.medical_records(id) ON DELETE SET NULL,
  vaccine_name      TEXT NOT NULL,
  manufacturer      TEXT,
  batch_number      TEXT,
  dose              TEXT,
  administered_date DATE,
  due_date          DATE,                       -- next dose due
  status            vaccination_status NOT NULL DEFAULT 'scheduled',
  notes             TEXT,
  reminder_sent_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS vaccinations_updated_at ON public.vaccinations;
CREATE TRIGGER vaccinations_updated_at
  BEFORE UPDATE ON public.vaccinations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_vaccinations_pet      ON public.vaccinations(pet_id);
CREATE INDEX IF NOT EXISTS idx_vaccinations_vet      ON public.vaccinations(vet_id);
CREATE INDEX IF NOT EXISTS idx_vaccinations_due      ON public.vaccinations(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vaccinations_status   ON public.vaccinations(status);


-- ============================================================
-- TABLE: prescriptions
-- Structured prescription rows (rather than a free-text field).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id            UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  vet_id            UUID NOT NULL REFERENCES public.users(id),
  medical_record_id UUID REFERENCES public.medical_records(id) ON DELETE SET NULL,
  medication_name   TEXT NOT NULL,
  dosage            TEXT NOT NULL,           -- e.g. "5 mg/kg"
  frequency         TEXT NOT NULL,           -- e.g. "twice daily"
  route             TEXT,                    -- e.g. "oral"
  duration_days     INT,
  refills_allowed   INT NOT NULL DEFAULT 0,
  refills_used      INT NOT NULL DEFAULT 0,
  start_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date          DATE,
  status            prescription_status NOT NULL DEFAULT 'active',
  instructions      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (refills_used <= refills_allowed)
);

DROP TRIGGER IF EXISTS prescriptions_updated_at ON public.prescriptions;
CREATE TRIGGER prescriptions_updated_at
  BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_prescriptions_pet     ON public.prescriptions(pet_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_vet     ON public.prescriptions(vet_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status  ON public.prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_prescriptions_start   ON public.prescriptions(start_date DESC);


-- ============================================================
-- TABLE: treatments
-- Procedures / interventions (surgery, dental cleaning, etc.).
-- Distinct from prescriptions (which are medications).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.treatments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id            UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  vet_id            UUID NOT NULL REFERENCES public.users(id),
  medical_record_id UUID REFERENCES public.medical_records(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  performed_date    DATE,
  scheduled_date    DATE,
  status            treatment_status NOT NULL DEFAULT 'planned',
  outcome           TEXT,
  cost_estimate     NUMERIC(10,2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS treatments_updated_at ON public.treatments;
CREATE TRIGGER treatments_updated_at
  BEFORE UPDATE ON public.treatments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_treatments_pet    ON public.treatments(pet_id);
CREATE INDEX IF NOT EXISTS idx_treatments_status ON public.treatments(status);
CREATE INDEX IF NOT EXISTS idx_treatments_date   ON public.treatments(performed_date DESC NULLS LAST);


-- ============================================================
-- VIEW: medical_timeline_v
-- Unified, per-pet chronological event stream used by the
-- Timeline UI. Each row is one event with a `kind`, `occurred_at`,
-- a short `summary`, and a reference back to the source row.
-- ============================================================
CREATE OR REPLACE VIEW public.medical_timeline_v AS
SELECT
  mr.id            AS event_id,
  mr.pet_id        AS pet_id,
  'visit'::text    AS kind,
  mr.visit_date::timestamptz AS occurred_at,
  mr.diagnosis     AS summary,
  mr.id            AS source_id,
  mr.vet_id        AS actor_id
FROM public.medical_records mr

UNION ALL

SELECT
  v.id, v.pet_id, 'vaccination'::text,
  COALESCE(v.administered_date, v.due_date)::timestamptz,
  v.vaccine_name || ' (' || v.status::text || ')',
  v.id, v.vet_id
FROM public.vaccinations v

UNION ALL

SELECT
  p.id, p.pet_id, 'prescription'::text,
  p.start_date::timestamptz,
  p.medication_name || ' — ' || p.dosage || ' ' || p.frequency,
  p.id, p.vet_id
FROM public.prescriptions p

UNION ALL

SELECT
  t.id, t.pet_id, 'treatment'::text,
  COALESCE(t.performed_date, t.scheduled_date)::timestamptz,
  t.name || ' (' || t.status::text || ')',
  t.id, t.vet_id
FROM public.treatments t

UNION ALL

SELECT
  f.id, f.pet_id, 'file'::text,
  f.created_at,
  f.kind::text || ': ' || f.title,
  f.id, f.uploaded_by
FROM public.emr_files f
WHERE f.is_archived = false;


-- ============================================================
-- ROW LEVEL SECURITY
-- The Express backend uses the service role and enforces access
-- in code, but we also enable RLS so any client-side Supabase
-- access (e.g. from the React app via anon key) is locked down.
-- ============================================================

ALTER TABLE public.soap_notes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emr_files      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vaccinations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatments     ENABLE ROW LEVEL SECURITY;

-- Helper: is the caller staff (admin/vet/staff)?
-- Reused in every policy below.
CREATE OR REPLACE FUNCTION public.is_staff(uid UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = uid
      AND u.role IN ('admin','veterinarian','staff')
  );
$$;

-- Helper: does the caller own the pet?
CREATE OR REPLACE FUNCTION public.owns_pet(uid UUID, pet UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pets p
    WHERE p.id = pet AND p.owner_id = uid
  );
$$;

-- ── soap_notes policies ────────────────────────────────────
DROP POLICY IF EXISTS "soap_staff_all"   ON public.soap_notes;
DROP POLICY IF EXISTS "soap_client_read" ON public.soap_notes;

CREATE POLICY "soap_staff_all"
  ON public.soap_notes FOR ALL
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "soap_client_read"
  ON public.soap_notes FOR SELECT
  USING (public.owns_pet(auth.uid(), pet_id));

-- ── emr_files policies ─────────────────────────────────────
DROP POLICY IF EXISTS "files_staff_all"   ON public.emr_files;
DROP POLICY IF EXISTS "files_client_read" ON public.emr_files;

CREATE POLICY "files_staff_all"
  ON public.emr_files FOR ALL
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "files_client_read"
  ON public.emr_files FOR SELECT
  USING (public.owns_pet(auth.uid(), pet_id));

-- ── vaccinations policies ──────────────────────────────────
DROP POLICY IF EXISTS "vax_staff_all"   ON public.vaccinations;
DROP POLICY IF EXISTS "vax_client_read" ON public.vaccinations;

CREATE POLICY "vax_staff_all"
  ON public.vaccinations FOR ALL
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "vax_client_read"
  ON public.vaccinations FOR SELECT
  USING (public.owns_pet(auth.uid(), pet_id));

-- ── prescriptions policies ─────────────────────────────────
DROP POLICY IF EXISTS "rx_staff_all"   ON public.prescriptions;
DROP POLICY IF EXISTS "rx_client_read" ON public.prescriptions;

CREATE POLICY "rx_staff_all"
  ON public.prescriptions FOR ALL
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "rx_client_read"
  ON public.prescriptions FOR SELECT
  USING (public.owns_pet(auth.uid(), pet_id));

-- ── treatments policies ────────────────────────────────────
DROP POLICY IF EXISTS "tx_staff_all"   ON public.treatments;
DROP POLICY IF EXISTS "tx_client_read" ON public.treatments;

CREATE POLICY "tx_staff_all"
  ON public.treatments FOR ALL
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "tx_client_read"
  ON public.treatments FOR SELECT
  USING (public.owns_pet(auth.uid(), pet_id));


-- ============================================================
-- SUPABASE STORAGE — 'emr-files' bucket
-- Run these in the Storage section of Supabase, or via SQL:
--   1. Create a private bucket named 'emr-files'.
--   2. Apply the policies below so staff can read/write and
--      clients can read files attached to their own pets.
-- ============================================================

-- Create the bucket if it doesn't exist (idempotent).
INSERT INTO storage.buckets (id, name, public)
VALUES ('emr-files', 'emr-files', false)
ON CONFLICT (id) DO NOTHING;

-- Staff (admin / veterinarian / staff): full access to objects
DROP POLICY IF EXISTS "emr_files_staff_all" ON storage.objects;
CREATE POLICY "emr_files_staff_all"
  ON storage.objects FOR ALL
  USING (bucket_id = 'emr-files' AND public.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'emr-files' AND public.is_staff(auth.uid()));

-- Clients: read objects whose object key starts with one of
-- their pet IDs (we'll structure uploads as: <pet_id>/<filename>).
DROP POLICY IF EXISTS "emr_files_client_read" ON storage.objects;
CREATE POLICY "emr_files_client_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'emr-files'
    AND EXISTS (
      SELECT 1 FROM public.pets p
      WHERE p.owner_id = auth.uid()
        AND split_part(name, '/', 1) = p.id::text
    )
  );


-- ============================================================
-- VACCINATION REMINDER MAINTENANCE
-- Mark any vaccination as 'overdue' once due_date < today and
-- it hasn't been administered. Run nightly via cron / pg_cron
-- or trigger from the backend on read.
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_overdue_vaccinations()
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE updated_count INT;
BEGIN
  UPDATE public.vaccinations
     SET status = 'overdue', updated_at = NOW()
   WHERE status = 'scheduled'
     AND due_date IS NOT NULL
     AND due_date < CURRENT_DATE
     AND administered_date IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
