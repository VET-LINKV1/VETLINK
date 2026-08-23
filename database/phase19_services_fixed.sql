-- ============================================================
-- VETLINK Phase 19: Configurable Services / Appointment Reasons
-- Run in Supabase SQL Editor AFTER phase11_booking.sql
-- SAFE VERSION - handles re-runs gracefully
-- ============================================================

-- ── services table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.services (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code                TEXT NOT NULL UNIQUE,
  label               TEXT NOT NULL,
  description         TEXT,
  urgency             TEXT NOT NULL DEFAULT 'standard'
                        CHECK (urgency IN ('routine','standard','urgent','emergency')),
  duration_mins       INT NOT NULL DEFAULT 30,
  suggested_specialty TEXT,
  color               TEXT NOT NULL DEFAULT 'slate'
                        CHECK (color IN ('blue','emerald','violet','amber','red','slate')),
  price               NUMERIC(10,2),
  is_active           BOOLEAN NOT NULL DEFAULT true,
  display_order       INT NOT NULL DEFAULT 999,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for updated_at (idempotent)
DROP TRIGGER IF EXISTS services_updated_at ON public.services;
CREATE TRIGGER services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_services_active_order ON public.services(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_services_code ON public.services(code);

-- ── RLS ─────────────────────────────────────────────────────────
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Helper: is_clinical_staff (admin, staff, or veterinarian) (idempotent)
-- SECURITY DEFINER: bypasses RLS on public.users to avoid the
-- "infinite recursion detected in policy for relation users" error
-- (the users table has self-referencing admin/staff policies).
CREATE OR REPLACE FUNCTION public.is_clinical_staff(uid UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = uid AND u.role IN ('admin','staff','veterinarian'));
$$;

-- Drop existing policies first (safe - IF EXISTS)
DROP POLICY IF EXISTS "services_admin_all" ON public.services;
DROP POLICY IF EXISTS "services_staff_all" ON public.services;
DROP POLICY IF EXISTS "services_client_read" ON public.services;

-- Clinical staff (admin/staff/vet): full CRUD
CREATE POLICY "services_staff_all"
  ON public.services FOR ALL
  USING (public.is_clinical_staff(auth.uid()))
  WITH CHECK (public.is_clinical_staff(auth.uid()));

-- Clients: read only active services
CREATE POLICY "services_client_read"
  ON public.services FOR SELECT
  USING (is_active = true);

-- ── Seed current hardcoded reasons ──────────────────────────────
INSERT INTO public.services (code, label, description, urgency, duration_mins, suggested_specialty, color, price, display_order) VALUES
  ('annual_checkup', 'Annual Check-up', 'Comprehensive wellness examination for your pet', 'routine', 30, NULL, 'blue', 500.00, 10),
  ('vaccination',    'Vaccination',     'Core and non-core vaccines to protect your pet', 'routine', 20, NULL, 'emerald', 350.00, 20),
  ('grooming',       'Grooming',        'Bath, haircut, nail trim, and ear cleaning', 'routine', 60, NULL, 'violet', 450.00, 30),
  ('injury',         'Limping / Injury', 'Urgent evaluation for limping, wounds, or trauma', 'urgent', 30, 'Surgery', 'amber', 800.00, 40),
  ('emergency',      'Emergency',       'Life-threatening conditions — immediate care', 'emergency', 45, 'Emergency & Critical Care', 'red', 1500.00, 50),
  ('other',          'Other',           'Any other reason not listed above', 'standard', 30, NULL, 'slate', NULL, 99)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  urgency = EXCLUDED.urgency,
  duration_mins = EXCLUDED.duration_mins,
  suggested_specialty = EXCLUDED.suggested_specialty,
  color = EXCLUDED.color,
  price = EXCLUDED.price,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- ── View for booking API ────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_services_for_booking AS
SELECT id, code, label, description, urgency, duration_mins,
       suggested_specialty, color, price, is_active
FROM public.services
WHERE is_active = true
ORDER BY display_order, label;

-- Verify
SELECT 'Services table created/updated successfully' AS status;
SELECT * FROM public.services ORDER BY display_order;