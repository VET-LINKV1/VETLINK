-- ============================================================
-- Phase 20 — Admin Settings module (real backend data)
-- ------------------------------------------------------------
-- Creates:
--   • settings_clinic          — single-row clinic identity/address/hours
--   • settings_appointments    — appointment policies
--   • settings_pets            — species/breeds/vaccines/units/BCS
--   • settings_prescriptions   — med catalog, dosage, refill, approval
--   • settings_laboratory      — test types, ranges, statuses, approval
--   • settings_billing         — currency/tax/invoice/payments/paymongo
--   • settings_notifications   — ClickSend/SMS/email/templates
--   • settings_security        — password/lockout/2FA policy
--   • settings_system          — localization/pagination/preferences
--   • roles                    — catalog of staff roles
--   • role_permissions         — RBAC matrix (role × module × permission)
--   • branches                 — clinic branches
--   • rooms                    — consultation/surgery/lab rooms
--
-- Also EXTENDS admin_audit_log (enum + module/entity columns) and adds a
-- log_settings_change() helper so every config write is recorded.
--
-- Idempotent. Safe to re-run.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. EXTEND AUDIT LOG
-- ============================================================

-- Append new action kinds for the broader activity the Settings module
-- (and the rest of the system) needs to record. Existing enum values are
-- preserved; PostgreSQL ALTER TYPE ADD VALUE is append-only and safe.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e
                 JOIN pg_type t ON e.enumtypid = t.oid
                 WHERE t.typname = 'admin_action_kind' AND e.enumlabel = 'login') THEN
    ALTER TYPE admin_action_kind ADD VALUE 'login';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e
                 JOIN pg_type t ON e.enumtypid = t.oid
                 WHERE t.typname = 'admin_action_kind' AND e.enumlabel = 'logout') THEN
    ALTER TYPE admin_action_kind ADD VALUE 'logout';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e
                 JOIN pg_type t ON e.enumtypid = t.oid
                 WHERE t.typname = 'admin_action_kind' AND e.enumlabel = 'config_change') THEN
    ALTER TYPE admin_action_kind ADD VALUE 'config_change';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e
                 JOIN pg_type t ON e.enumtypid = t.oid
                 WHERE t.typname = 'admin_action_kind' AND e.enumlabel = 'permission_change') THEN
    ALTER TYPE admin_action_kind ADD VALUE 'permission_change';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e
                 JOIN pg_type t ON e.enumtypid = t.oid
                 WHERE t.typname = 'admin_action_kind' AND e.enumlabel = 'pet_update') THEN
    ALTER TYPE admin_action_kind ADD VALUE 'pet_update';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e
                 JOIN pg_type t ON e.enumtypid = t.oid
                 WHERE t.typname = 'admin_action_kind' AND e.enumlabel = 'medical_update') THEN
    ALTER TYPE admin_action_kind ADD VALUE 'medical_update';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e
                 JOIN pg_type t ON e.enumtypid = t.oid
                 WHERE t.typname = 'admin_action_kind' AND e.enumlabel = 'appointment_change') THEN
    ALTER TYPE admin_action_kind ADD VALUE 'appointment_change';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e
                 JOIN pg_type t ON e.enumtypid = t.oid
                 WHERE t.typname = 'admin_action_kind' AND e.enumlabel = 'prescription_change') THEN
    ALTER TYPE admin_action_kind ADD VALUE 'prescription_change';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e
                 JOIN pg_type t ON e.enumtypid = t.oid
                 WHERE t.typname = 'admin_action_kind' AND e.enumlabel = 'payment_change') THEN
    ALTER TYPE admin_action_kind ADD VALUE 'payment_change';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e
                 JOIN pg_type t ON e.enumtypid = t.oid
                 WHERE t.typname = 'admin_action_kind' AND e.enumlabel = 'branch_change') THEN
    ALTER TYPE admin_action_kind ADD VALUE 'branch_change';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e
                 JOIN pg_type t ON e.enumtypid = t.oid
                 WHERE t.typname = 'admin_action_kind' AND e.enumlabel = 'service_change') THEN
    ALTER TYPE admin_action_kind ADD VALUE 'service_change';
  END IF;
END$$;

-- Add module + entity columns so the audit log can describe WHICH part of
-- the system an action touched (e.g. module='settings', entity='billing').
ALTER TABLE public.admin_audit_log
  ADD COLUMN IF NOT EXISTS module   TEXT,
  ADD COLUMN IF NOT EXISTS entity_id UUID;

CREATE INDEX IF NOT EXISTS idx_audit_module ON public.admin_audit_log(module);

-- ============================================================
-- 2. HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Record a settings/config change (used by the backend settings service).
CREATE OR REPLACE FUNCTION public.log_settings_change(
  p_actor   UUID,
  p_module  TEXT,
  p_summary TEXT  DEFAULT NULL,
  p_before  JSONB DEFAULT NULL,
  p_after   JSONB DEFAULT NULL,
  p_meta    JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.admin_audit_log (
    actor_id, action, module, summary, before_json, after_json, meta
  )
  VALUES (p_actor, 'config_change', p_module, p_summary, p_before, p_after, p_meta)
  RETURNING id INTO v_id;
  RETURN v_id;
END$$;

-- ============================================================
-- 3. SETTINGS TABLES
-- Each "config" table is keyed by a constant text id ('default') so the
-- clinic can have a single active configuration row. Reference lists
-- (species, breeds, etc.) live as JSONB arrays inside their table — this
-- matches the chip-list editing UX and avoids dozens of small join tables.
-- ============================================================

-- 3a. Clinic --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settings_clinic (
  id               TEXT PRIMARY KEY DEFAULT 'default',
  name             TEXT NOT NULL,
  short_name       TEXT,
  email            TEXT,
  phone            TEXT,
  mobile           TEXT,
  website          TEXT,
  logo_url         TEXT,
  address_line     TEXT,
  city             TEXT,
  state            TEXT,
  postal_code      TEXT,
  country          TEXT,
  timezone         TEXT NOT NULL DEFAULT 'Asia/Manila',
  currency         TEXT NOT NULL DEFAULT 'PHP',
  emergency_name   TEXT,
  emergency_phone  TEXT,
  operating_hours  JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3b. Appointments --------------------------------------------
CREATE TABLE IF NOT EXISTS public.settings_appointments (
  id                    TEXT PRIMARY KEY DEFAULT 'default',
  default_duration      INTEGER NOT NULL DEFAULT 30,
  allow_custom_duration BOOLEAN NOT NULL DEFAULT true,
  custom_durations      JSONB NOT NULL DEFAULT '[15,20,30,45,60,90]'::jsonb,
  appointment_types     JSONB NOT NULL DEFAULT '[]'::jsonb,
  cancellation_hours    INTEGER NOT NULL DEFAULT 24,
  reschedule_limit      INTEGER NOT NULL DEFAULT 3,
  check_in_window       INTEGER NOT NULL DEFAULT 15,
  no_show_grace         INTEGER NOT NULL DEFAULT 10,
  no_show_action        TEXT NOT NULL DEFAULT 'mark_no_show',
  online_booking        BOOLEAN NOT NULL DEFAULT true,
  booking_lead_days     INTEGER NOT NULL DEFAULT 60,
  require_deposit       BOOLEAN NOT NULL DEFAULT false,
  deposit_percent       INTEGER NOT NULL DEFAULT 20,
  vet_scheduling_mode   TEXT NOT NULL DEFAULT 'open',
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3c. Pets & Medical ------------------------------------------
CREATE TABLE IF NOT EXISTS public.settings_pets (
  id                 TEXT PRIMARY KEY DEFAULT 'default',
  weight_unit        TEXT NOT NULL DEFAULT 'kg',
  temp_unit          TEXT NOT NULL DEFAULT 'celsius',
  species            JSONB NOT NULL DEFAULT '[]'::jsonb,
  breeds             JSONB NOT NULL DEFAULT '[]'::jsonb,
  vaccine_types      JSONB NOT NULL DEFAULT '[]'::jsonb,
  allergy_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  record_categories  JSONB NOT NULL DEFAULT '[]'::jsonb,
  id_fields          JSONB NOT NULL DEFAULT '[]'::jsonb,
  bcs_scale          TEXT NOT NULL DEFAULT '9-point',
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3d. Prescriptions -------------------------------------------
CREATE TABLE IF NOT EXISTS public.settings_prescriptions (
  id               TEXT PRIMARY KEY DEFAULT 'default',
  medication_catalog JSONB NOT NULL DEFAULT '[]'::jsonb,
  dosage_units       JSONB NOT NULL DEFAULT '[]'::jsonb,
  frequency_options  JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_refills        INTEGER NOT NULL DEFAULT 3,
  refill_lead_days   INTEGER NOT NULL DEFAULT 5,
  validity_days      INTEGER NOT NULL DEFAULT 30,
  require_vet_approval BOOLEAN NOT NULL DEFAULT true,
  approval_threshold   NUMERIC NOT NULL DEFAULT 0,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3e. Laboratory ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.settings_laboratory (
  id                TEXT PRIMARY KEY DEFAULT 'default',
  test_types        JSONB NOT NULL DEFAULT '[]'::jsonb,
  categories        JSONB NOT NULL DEFAULT '[]'::jsonb,
  units             JSONB NOT NULL DEFAULT '[]'::jsonb,
  reference_ranges  JSONB NOT NULL DEFAULT '[]'::jsonb,
  result_statuses   JSONB NOT NULL DEFAULT '["pending","partial","final","verified","rejected"]'::jsonb,
  require_approval  BOOLEAN NOT NULL DEFAULT true,
  auto_verify_below BOOLEAN NOT NULL DEFAULT false,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3f. Billing & Payment --------------------------------------
CREATE TABLE IF NOT EXISTS public.settings_billing (
  id                  TEXT PRIMARY KEY DEFAULT 'default',
  currency            TEXT NOT NULL DEFAULT 'PHP',
  tax_enabled         BOOLEAN NOT NULL DEFAULT true,
  tax_rate            NUMERIC NOT NULL DEFAULT 12,
  tax_label           TEXT NOT NULL DEFAULT 'VAT',
  service_charge_enabled BOOLEAN NOT NULL DEFAULT false,
  service_charge_rate    NUMERIC NOT NULL DEFAULT 5,
  invoice_prefix      TEXT NOT NULL DEFAULT 'INV-',
  invoice_start       INTEGER NOT NULL DEFAULT 1001,
  payment_methods     JSONB NOT NULL DEFAULT '["Cash","GCash","Bank Transfer","Credit Card","PayMongo"]'::jsonb,
  refund_policy       TEXT NOT NULL DEFAULT 'refund_7d',
  refund_window_days  INTEGER NOT NULL DEFAULT 7,
  paymongo_connected  BOOLEAN NOT NULL DEFAULT false,
  paymongo_mode       TEXT NOT NULL DEFAULT 'test',
  paymongo_public_key TEXT,
  paymongo_secret_set BOOLEAN NOT NULL DEFAULT false,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3g. Notifications -------------------------------------------
CREATE TABLE IF NOT EXISTS public.settings_notifications (
  id               TEXT PRIMARY KEY DEFAULT 'default',
  clicksend_enabled BOOLEAN NOT NULL DEFAULT false,
  clicksend_from    TEXT,
  clicksend_sender_id TEXT,
  clicksend_connected BOOLEAN NOT NULL DEFAULT false,
  email_from        TEXT,
  channels          JSONB NOT NULL DEFAULT '{}'::jsonb,
  reminder_lead_hours JSONB NOT NULL DEFAULT '[24,2]'::jsonb,
  templates         JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3h. Security ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settings_security (
  id                    TEXT PRIMARY KEY DEFAULT 'default',
  min_length            INTEGER NOT NULL DEFAULT 10,
  require_uppercase     BOOLEAN NOT NULL DEFAULT true,
  require_number        BOOLEAN NOT NULL DEFAULT true,
  require_symbol        BOOLEAN NOT NULL DEFAULT true,
  password_expiry_days  INTEGER NOT NULL DEFAULT 90,
  session_timeout_min   INTEGER NOT NULL DEFAULT 30,
  max_login_attempts    INTEGER NOT NULL DEFAULT 5,
  lockout_minutes       INTEGER NOT NULL DEFAULT 15,
  two_factor_required   BOOLEAN NOT NULL DEFAULT true,
  two_factor_method     TEXT NOT NULL DEFAULT 'app',
  lockout_enabled       BOOLEAN NOT NULL DEFAULT true,
  notify_on_new_login   BOOLEAN NOT NULL DEFAULT true,
  notify_on_permission_change BOOLEAN NOT NULL DEFAULT true,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3i. System Preferences -------------------------------------
CREATE TABLE IF NOT EXISTS public.settings_system (
  id                    TEXT PRIMARY KEY DEFAULT 'default',
  date_format           TEXT NOT NULL DEFAULT 'MMM D, YYYY',
  time_format           TEXT NOT NULL DEFAULT '12h',
  timezone              TEXT NOT NULL DEFAULT 'Asia/Manila',
  currency              TEXT NOT NULL DEFAULT 'PHP',
  language              TEXT NOT NULL DEFAULT 'en',
  week_start            TEXT NOT NULL DEFAULT 'monday',
  pagination            INTEGER NOT NULL DEFAULT 25,
  dashboard_refresh_sec INTEGER NOT NULL DEFAULT 30,
  compact_tables        BOOLEAN NOT NULL DEFAULT false,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. ROLES & PERMISSIONS (RBAC)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.roles (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  description TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role       TEXT NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  module     TEXT NOT NULL,
  can_view   BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit   BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  can_approve BOOLEAN NOT NULL DEFAULT false,
  can_manage BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role, module)
);

-- Seed the six staff roles.
INSERT INTO public.roles (id, label, description, is_system) VALUES
  ('admin',        'Administrators',         'Full access to all modules and configuration.', true),
  ('veterinarian', 'Veterinarians',          'Clinical care, medical records, prescriptions.', true),
  ('technician',   'Veterinary Technicians', 'Assist vets, manage records and samples.',       true),
  ('receptionist', 'Receptionists',          'Appointments, clients, billing front-desk.',     true),
  ('cashier',      'Cashiers',               'Payments, invoices, refunds.',                  true),
  ('lab',          'Laboratory Staff',       'Lab orders, results, and approvals.',           true)
ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description;

-- ============================================================
-- 5. BRANCHES & ROOMS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.branches (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  address     TEXT,
  phone       TEXT,
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  open_time   TIME NOT NULL DEFAULT '08:00',
  close_time  TIME NOT NULL DEFAULT '18:00',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rooms (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id   UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  room_type   TEXT NOT NULL CHECK (room_type IN ('consultation','surgery','laboratory')),
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS settings_appointments_updated_at ON public.settings_appointments;
CREATE TRIGGER settings_appointments_updated_at
  BEFORE UPDATE ON public.settings_appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS settings_pets_updated_at ON public.settings_pets;
CREATE TRIGGER settings_pets_updated_at
  BEFORE UPDATE ON public.settings_pets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS settings_prescriptions_updated_at ON public.settings_prescriptions;
CREATE TRIGGER settings_prescriptions_updated_at
  BEFORE UPDATE ON public.settings_prescriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS settings_laboratory_updated_at ON public.settings_laboratory;
CREATE TRIGGER settings_laboratory_updated_at
  BEFORE UPDATE ON public.settings_laboratory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS settings_billing_updated_at ON public.settings_billing;
CREATE TRIGGER settings_billing_updated_at
  BEFORE UPDATE ON public.settings_billing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS settings_notifications_updated_at ON public.settings_notifications;
CREATE TRIGGER settings_notifications_updated_at
  BEFORE UPDATE ON public.settings_notifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS settings_security_updated_at ON public.settings_security;
CREATE TRIGGER settings_security_updated_at
  BEFORE UPDATE ON public.settings_security
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS settings_system_updated_at ON public.settings_system;
CREATE TRIGGER settings_system_updated_at
  BEFORE UPDATE ON public.settings_system
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS role_permissions_updated_at ON public.role_permissions;
CREATE TRIGGER role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS branches_updated_at ON public.branches;
CREATE TRIGGER branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS rooms_updated_at ON public.rooms;
CREATE TRIGGER rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 7. ROW LEVEL SECURITY
-- Settings are managed by admins only. The backend writes via the service
-- role (bypasses RLS); this RLS ensures even an authenticated non-admin
-- client token can never read or write these tables directly.
-- ============================================================

ALTER TABLE public.settings_clinic          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_appointments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_pets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_prescriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_laboratory      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_billing         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_notifications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_security        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_system          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms                    ENABLE ROW LEVEL SECURITY;

-- Deny all direct access; everything goes through the admin API (service role).
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'settings_clinic','settings_appointments','settings_pets','settings_prescriptions',
    'settings_laboratory','settings_billing','settings_notifications','settings_security',
    'settings_system','roles','role_permissions','branches','rooms'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS admin_only ON public.%I;', t);
    EXECUTE format(
      'CREATE POLICY admin_only ON public.%I FOR ALL TO authenticated USING (false) WITH CHECK (false);',
      t
    );
  END LOOP;
END$$;

-- ============================================================
-- 8. SEED DEFAULT ROWS (id = 'default')
-- ============================================================

INSERT INTO public.settings_clinic (id, name, short_name, email, phone, mobile, website, timezone, currency, operating_hours)
VALUES (
  'default',
  'Paw Health Veterinary Clinic',
  'PHVC',
  'frontdesk@pawhealth.vet',
  '+63 2 8555 0199',
  '+63 917 555 0142',
  'https://pawhealth.vet',
  'Asia/Manila',
  'PHP',
  '[
    {"day":"Monday","open":"08:00","close":"18:00","closed":false},
    {"day":"Tuesday","open":"08:00","close":"18:00","closed":false},
    {"day":"Wednesday","open":"08:00","close":"18:00","closed":false},
    {"day":"Thursday","open":"08:00","close":"18:00","closed":false},
    {"day":"Friday","open":"08:00","close":"18:00","closed":false},
    {"day":"Saturday","open":"09:00","close":"15:00","closed":false},
    {"day":"Sunday","open":"09:00","close":"12:00","closed":true}
  ]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.settings_appointments (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.settings_pets (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.settings_prescriptions (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.settings_laboratory (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.settings_billing (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.settings_notifications (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.settings_security (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.settings_system (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- Seed RBAC matrix with recommended defaults.
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_approve, can_manage)
SELECT r.id, m.module,
       CASE WHEN r.id = 'admin' THEN true
            WHEN r.id = 'veterinarian' AND m.module IN ('dashboard','appointments','pets','medical','prescriptions','laboratory') THEN true
            WHEN r.id = 'technician' AND m.module IN ('pets','medical','laboratory','appointments') THEN true
            WHEN r.id = 'receptionist' AND m.module IN ('appointments','pets','billing') THEN true
            WHEN r.id = 'cashier' AND m.module = 'billing' THEN true
            WHEN r.id = 'lab' AND m.module = 'laboratory' THEN true
            ELSE false END,
       CASE WHEN r.id = 'admin' THEN true
            WHEN r.id IN ('veterinarian','technician') AND m.module IN ('pets','medical','appointments','laboratory') THEN true
            WHEN r.id = 'receptionist' AND m.module IN ('appointments','pets','billing') THEN true
            WHEN r.id = 'cashier' AND m.module = 'billing' THEN true
            WHEN r.id = 'lab' AND m.module = 'laboratory' THEN true
            ELSE false END,
       CASE WHEN r.id = 'admin' THEN true
            WHEN r.id IN ('veterinarian','technician') AND m.module IN ('pets','medical','appointments','laboratory') THEN true
            WHEN r.id = 'receptionist' AND m.module IN ('appointments','pets','billing') THEN true
            WHEN r.id = 'cashier' AND m.module = 'billing' THEN true
            WHEN r.id = 'lab' AND m.module = 'laboratory' THEN true
            ELSE false END,
       CASE WHEN r.id = 'admin' THEN true
            WHEN r.id = 'cashier' AND m.module = 'billing' THEN true
            ELSE false END,
       CASE WHEN r.id = 'admin' THEN true
            WHEN r.id = 'veterinarian' AND m.module = 'prescriptions' THEN true
            WHEN r.id = 'lab' AND m.module = 'laboratory' THEN true
            ELSE false END,
       CASE WHEN r.id = 'admin' THEN true ELSE false END
FROM public.roles r
CROSS JOIN (VALUES
  ('dashboard'),('appointments'),('pets'),('medical'),
  ('prescriptions'),('laboratory'),('billing'),('users'),('settings')
) AS m(module)
ON CONFLICT (role, module) DO NOTHING;

-- Reload PostgREST schema cache so the new tables/enums are visible.
NOTIFY pgrst, 'reload schema';
