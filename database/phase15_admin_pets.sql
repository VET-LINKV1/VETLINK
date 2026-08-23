-- phase15_admin_pets.sql
-- Adds columns referenced by the Admin Pet Records feature.
-- These are non-destructive ALTERs; safe to re-run (IF NOT EXISTS guarded).

-- 1. microchip number on pets
ALTER TABLE IF EXISTS public.pets
  ADD COLUMN IF NOT EXISTS microchip_no TEXT;

-- 2. date of birth (kept for future use; adminCreate currently stores in notes as fallback)
ALTER TABLE IF EXISTS public.pets
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- 3. spay / neuter status
ALTER TABLE IF EXISTS public.pets
  ADD COLUMN IF NOT EXISTS spay_neuter TEXT
    CHECK (spay_neuter IN ('unknown','intact','neutered','spayed')) DEFAULT 'unknown';

-- 4. emergency contact (stored on pet row for clinic-wide visibility)
ALTER TABLE IF EXISTS public.pets
  ADD COLUMN IF NOT EXISTS emergency_name TEXT;
ALTER TABLE IF EXISTS public.pets
  ADD COLUMN IF NOT EXISTS emergency_contact TEXT;

-- 5. explicit active flag (optional; currently derived from last-visit recency)
ALTER TABLE IF EXISTS public.pets
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
