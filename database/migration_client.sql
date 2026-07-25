-- ============================================================
-- VETLINK: Client Role Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add 'client' to role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'client';

-- 2. Add extra columns to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS contact_number TEXT,
  ADD COLUMN IF NOT EXISTS address        TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url     TEXT;

-- 3. Pets table
CREATE TABLE IF NOT EXISTS public.pets (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  species       TEXT NOT NULL,
  breed         TEXT,
  age           INT,
  gender        TEXT CHECK (gender IN ('male','female','unknown')) DEFAULT 'unknown',
  weight_kg     NUMERIC(5,2),
  color         TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS pets_updated_at ON public.pets;
CREATE TRIGGER pets_updated_at
  BEFORE UPDATE ON public.pets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Appointments table
DO $$ BEGIN
  CREATE TYPE appointment_status AS ENUM ('pending','confirmed','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.appointments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id          UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES public.users(id),
  vet_id          UUID REFERENCES public.users(id),
  appointment_at  TIMESTAMPTZ,
  duration_mins   INT DEFAULT 30,
  type            TEXT NOT NULL DEFAULT 'General Checkup',
  status          appointment_status NOT NULL DEFAULT 'pending',
  reason          TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS appointments_updated_at ON public.appointments;
CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. RLS: Pets
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_manage_own_pets" ON public.pets;
CREATE POLICY "clients_manage_own_pets"
  ON public.pets FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "staff_read_all_pets" ON public.pets;
CREATE POLICY "staff_read_all_pets"
  ON public.pets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin','veterinarian','staff')
    )
  );

-- 6. RLS: Appointments
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_manage_own_appointments" ON public.appointments;
CREATE POLICY "clients_manage_own_appointments"
  ON public.appointments FOR ALL
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

DROP POLICY IF EXISTS "staff_read_all_appointments" ON public.appointments;
CREATE POLICY "staff_read_all_appointments"
  ON public.appointments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin','veterinarian','staff')
    )
  );

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_pets_owner_id           ON public.pets(owner_id);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id  ON public.appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status     ON public.appointments(status);
