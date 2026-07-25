-- ============================================================
-- PHVC Seed Data
-- Run AFTER schema.sql
-- Creates 3 internal staff accounts for testing
-- NOTE: Replace UUIDs after running seed.js
-- ============================================================

-- Run seed.js instead of this file directly.
-- seed.js creates Supabase Auth users then inserts below.

-- Example (replace UUIDs with real ones from auth.users):
/*
INSERT INTO public.users (id, email, name, role, phone_number, is_verified) VALUES
  ('UUID_ADMIN', 'admin@phvc.com',  'Admin User',       'admin',        '+639000000001', true),
  ('UUID_VET',   'vet@phvc.com',    'Dr. Jane Smith',   'veterinarian', '+639000000002', true),
  ('UUID_STAFF', 'staff@phvc.com',  'Staff Member',     'staff',        '+639000000003', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.staff_profiles (user_id, license_number, specialization, position) VALUES
  ('UUID_VET',   'PRC-VET-12345', 'General Practice', NULL),
  ('UUID_STAFF', NULL,            NULL,                'assistant')
ON CONFLICT (user_id) DO NOTHING;
*/
