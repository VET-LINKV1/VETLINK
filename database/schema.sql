-- ============================================================
-- PHVC — Pet Healthcare Veterinary Clinic
-- Full Database Schema (Section 2)
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── ENUMS ─────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'veterinarian', 'staff', 'client');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE staff_position AS ENUM ('assistant', 'technician');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── FUNCTION: auto-update updated_at ──────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABLE: users
-- Links to Supabase auth.users via id (UUID)
-- Covers ALL roles: admin, veterinarian, staff, client
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email          TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  role           user_role NOT NULL DEFAULT 'client',
  phone_number   TEXT UNIQUE,
  address        TEXT,
  avatar_url     TEXT,
  is_verified    BOOLEAN NOT NULL DEFAULT false,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS users_updated_at ON public.users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE: staff_profiles
-- Extended info for veterinarians and clinical staff
-- One-to-one with users (only for vet/staff roles)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.staff_profiles (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,

  -- Veterinarian fields
  license_number   TEXT UNIQUE,
  specialization   TEXT,

  -- Staff fields
  position         staff_position,

  -- Shared
  department       TEXT,
  hired_at         DATE,
  notes            TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS staff_profiles_updated_at ON public.staff_profiles;
CREATE TRIGGER staff_profiles_updated_at
  BEFORE UPDATE ON public.staff_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE: otp_verifications
-- Stores hashed OTPs for phone verification
-- OTPs are NEVER stored in plain text
-- ============================================================
CREATE TABLE IF NOT EXISTS public.otp_verifications (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number   TEXT NOT NULL UNIQUE,
  otp_hash       TEXT NOT NULL,              -- bcrypt hash of the 6-digit OTP
  expires_at     TIMESTAMPTZ NOT NULL,        -- OTP expires in 5 minutes
  attempts       INT NOT NULL DEFAULT 0,      -- Track failed attempts (max 5)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast phone number lookups
CREATE INDEX IF NOT EXISTS idx_otp_phone ON public.otp_verifications(phone_number);

-- ============================================================
-- TABLE: pending_registrations
-- Temporarily stores form data before OTP is verified.
-- Real user is NOT created until OTP verification succeeds.
-- Records expire after 15 minutes.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pending_registrations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email            TEXT NOT NULL,
  full_name        TEXT NOT NULL,
  password_plain   TEXT NOT NULL,    -- Used once to create Supabase Auth user, then deleted
  role             user_role NOT NULL,
  phone_number     TEXT NOT NULL UNIQUE,

  -- Role-specific fields
  license_number   TEXT,
  specialization   TEXT,
  position         TEXT,

  expires_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_phone ON public.pending_registrations(phone_number);
CREATE INDEX IF NOT EXISTS idx_pending_email ON public.pending_registrations(email);

-- ============================================================
-- TABLE: pets
-- Owned by clients
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pets (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  species        TEXT NOT NULL,
  breed          TEXT,
  age            INT CHECK (age >= 0 AND age <= 50),
  gender         TEXT CHECK (gender IN ('male','female','unknown')) DEFAULT 'unknown',
  weight_kg      NUMERIC(5,2),
  color          TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS pets_updated_at ON public.pets;
CREATE TRIGGER pets_updated_at
  BEFORE UPDATE ON public.pets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_pets_owner_id ON public.pets(owner_id);

-- ============================================================
-- TABLE: appointments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.appointments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id           UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  client_id        UUID NOT NULL REFERENCES public.users(id),
  vet_id           UUID REFERENCES public.users(id),
  appointment_at   TIMESTAMPTZ,
  duration_mins    INT DEFAULT 30,
  type             TEXT NOT NULL DEFAULT 'General Checkup',
  status           appointment_status NOT NULL DEFAULT 'pending',
  reason           TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS appointments_updated_at ON public.appointments;
CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_appt_client_id   ON public.appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appt_vet_id       ON public.appointments(vet_id);
CREATE INDEX IF NOT EXISTS idx_appt_pet_id       ON public.appointments(pet_id);
CREATE INDEX IF NOT EXISTS idx_appt_status       ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_appt_scheduled_at ON public.appointments(appointment_at);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- USERS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own"        ON public.users;
DROP POLICY IF EXISTS "admins_read_all_users"  ON public.users;
DROP POLICY IF EXISTS "staff_read_all_users"   ON public.users;

CREATE POLICY "users_read_own"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "admins_read_all_users"
  ON public.users FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

CREATE POLICY "staff_read_all_users"
  ON public.users FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('veterinarian','staff'))
  );

-- STAFF PROFILES
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_profiles_read_own"   ON public.staff_profiles;
DROP POLICY IF EXISTS "admins_manage_staff"        ON public.staff_profiles;

CREATE POLICY "staff_profiles_read_own"
  ON public.staff_profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "admins_manage_staff"
  ON public.staff_profiles FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- PETS
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_manage_own_pets" ON public.pets;
DROP POLICY IF EXISTS "staff_read_all_pets"     ON public.pets;

CREATE POLICY "clients_manage_own_pets"
  ON public.pets FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "staff_read_all_pets"
  ON public.pets FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','veterinarian','staff'))
  );

-- APPOINTMENTS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_manage_own_appointments" ON public.appointments;
DROP POLICY IF EXISTS "staff_read_all_appointments"     ON public.appointments;
DROP POLICY IF EXISTS "vet_manage_assigned"             ON public.appointments;

CREATE POLICY "clients_manage_own_appointments"
  ON public.appointments FOR ALL
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "staff_read_all_appointments"
  ON public.appointments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','staff'))
  );

CREATE POLICY "vet_manage_assigned"
  ON public.appointments FOR ALL
  USING (
    vet_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- OTP and pending tables — accessible by service role only (backend bypasses RLS)
ALTER TABLE public.otp_verifications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY;
-- No client-facing policies needed — backend uses supabaseAdmin (service role) for these

