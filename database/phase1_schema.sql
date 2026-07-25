-- ============================================================
-- VETLINK Phase 1: Vet Schedule + Enhanced Appointments
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vet_schedules (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vet_id              UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  day_of_week         INT  NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time          TIME NOT NULL,
  end_time            TIME NOT NULL,
  slot_duration_mins  INT  NOT NULL DEFAULT 30,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vet_schedules_times_check CHECK (end_time > start_time),
  UNIQUE (vet_id, day_of_week)
);

DROP TRIGGER IF EXISTS vet_schedules_updated_at ON public.vet_schedules;
CREATE TRIGGER vet_schedules_updated_at
  BEFORE UPDATE ON public.vet_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS vet_id             UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS appointment_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duration_mins      INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS status_updated_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by        UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS cancelled_by       UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS cancel_reason      TEXT,
  ADD COLUMN IF NOT EXISTS completed_at       TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_vet_schedules_vet_id   ON public.vet_schedules(vet_id);
CREATE INDEX IF NOT EXISTS idx_vet_schedules_day      ON public.vet_schedules(day_of_week);
CREATE INDEX IF NOT EXISTS idx_appointments_vet_id    ON public.appointments(vet_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled ON public.appointments(appointment_at);

ALTER TABLE public.vet_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vets_manage_own_schedule" ON public.vet_schedules;
CREATE POLICY "vets_manage_own_schedule"
  ON public.vet_schedules FOR ALL
  USING (vet_id = auth.uid())
  WITH CHECK (vet_id = auth.uid());

DROP POLICY IF EXISTS "all_read_vet_schedule" ON public.vet_schedules;
CREATE POLICY "all_read_vet_schedule"
  ON public.vet_schedules FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "admins_manage_all_schedules" ON public.vet_schedules;
CREATE POLICY "admins_manage_all_schedules"
  ON public.vet_schedules FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

-- Seed default Mon-Fri schedule for vet
INSERT INTO public.vet_schedules (vet_id, day_of_week, start_time, end_time, slot_duration_mins)
SELECT u.id, dow.day, '09:00'::TIME, '17:00'::TIME, 30
FROM public.users u
CROSS JOIN (VALUES (1),(2),(3),(4),(5)) AS dow(day)
WHERE u.email = 'vet@phvc.com'
ON CONFLICT (vet_id, day_of_week) DO NOTHING;
