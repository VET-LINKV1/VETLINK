-- ============================================================
-- VETLINK Phase 3: Digital Medical Records
-- Run in Supabase SQL Editor AFTER phase2_schema.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.medical_records (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id         UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  vet_id         UUID NOT NULL REFERENCES public.users(id),
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  visit_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg      NUMERIC(5,2),
  temperature_c  NUMERIC(4,1),
  diagnosis      TEXT NOT NULL,
  treatment      TEXT,
  prescription   TEXT,
  notes          TEXT,
  follow_up_date DATE,
  attachments    JSONB DEFAULT '[]'::jsonb,  -- [{url, name, type}]
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS medical_records_updated_at ON public.medical_records;
CREATE TRIGGER medical_records_updated_at
  BEFORE UPDATE ON public.medical_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_medical_records_pet_id         ON public.medical_records(pet_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_vet_id         ON public.medical_records(vet_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_appointment_id ON public.medical_records(appointment_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_visit_date     ON public.medical_records(visit_date DESC);

ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

-- Vets: create and update their own records
DROP POLICY IF EXISTS "vets_manage_own_records" ON public.medical_records;
CREATE POLICY "vets_manage_own_records"
  ON public.medical_records FOR ALL
  USING (vet_id = auth.uid())
  WITH CHECK (vet_id = auth.uid());

-- Clients: read records for their own pets only
DROP POLICY IF EXISTS "clients_read_own_pet_records" ON public.medical_records;
CREATE POLICY "clients_read_own_pet_records"
  ON public.medical_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pets p
      WHERE p.id = medical_records.pet_id
        AND p.owner_id = auth.uid()
    )
  );

-- Admins and staff: read all records
DROP POLICY IF EXISTS "staff_read_all_records" ON public.medical_records;
CREATE POLICY "staff_read_all_records"
  ON public.medical_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'staff')
    )
  );
