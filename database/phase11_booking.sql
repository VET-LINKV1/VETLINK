-- ============================================================
-- VETLINK Phase 11: Smart Frictionless Booking & Intake
-- Run in Supabase SQL Editor AFTER phase1_schema.sql
-- (the appointments / vet_schedules tables must already exist)
--
-- Adds:
--   * appointment_reason enum  (annual_checkup / vaccination / grooming / injury / emergency / other)
--   * urgency_level     enum   (routine / standard / urgent / emergency)
--   * appointment columns      reason_code, urgency, triaged_at, triaged_by
--   * appointment_intakes      one row per appointment, captures pre-visit form
--   * get_available_slots(...) function returning open slot starts for a vet on a date
--   * find_open_vets(...)      function ranking vets by free-near-target time
--   * v_vet_load_today         per-vet appointment count for the day (used for tiebreak)
-- ============================================================

-- ── ENUMS ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE appointment_reason AS ENUM (
    'annual_checkup', 'vaccination', 'grooming', 'injury', 'emergency', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE urgency_level AS ENUM ('routine', 'standard', 'urgent', 'emergency');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ── COLUMNS ON public.appointments ───────────────────────────
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reason_code   appointment_reason,
  ADD COLUMN IF NOT EXISTS urgency       urgency_level NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS triaged_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS triaged_by    UUID REFERENCES public.users(id);

CREATE INDEX IF NOT EXISTS idx_appt_urgency     ON public.appointments(urgency);
CREATE INDEX IF NOT EXISTS idx_appt_reason_code ON public.appointments(reason_code);


-- ============================================================
-- TABLE: appointment_intakes
-- One pre-visit intake form per appointment. Holds structured
-- self-report data from the client/owner.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.appointment_intakes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id    UUID NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  pet_id            UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  submitted_by      UUID REFERENCES public.users(id),
  symptoms          TEXT,
  symptom_onset     TEXT,             -- "2 days ago", "this morning"
  symptom_severity  INT CHECK (symptom_severity BETWEEN 1 AND 10),
  diet_info         TEXT,
  current_medications TEXT,
  allergies         TEXT,
  behavioral_notes  TEXT,
  recent_changes    TEXT,             -- new environment, new food, travel, etc.
  fasting_status    TEXT,             -- e.g. for surgery
  consent_given     BOOLEAN NOT NULL DEFAULT false,
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS appt_intakes_updated_at ON public.appointment_intakes;
CREATE TRIGGER appt_intakes_updated_at
  BEFORE UPDATE ON public.appointment_intakes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_appt_intakes_appt ON public.appointment_intakes(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appt_intakes_pet  ON public.appointment_intakes(pet_id);


-- ============================================================
-- FUNCTION: get_available_slots(vet, date, slot_mins)
-- Returns the list of slot start times that are inside the vet's
-- working hours for the day, NOT clashing with an existing
-- (confirmed or pending) appointment.
--
-- - slot_mins defaults to the vet_schedule's slot_duration_mins
-- - excludes any past times when called for "today"
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_vet_id  UUID,
  p_date    DATE,
  p_slot_mins INT DEFAULT NULL
)
RETURNS TABLE (
  slot_start TIMESTAMPTZ,
  slot_end   TIMESTAMPTZ
) LANGUAGE plpgsql STABLE AS $$
DECLARE
  sched   public.vet_schedules%ROWTYPE;
  dow     INT := EXTRACT(DOW FROM p_date)::INT;  -- 0..6
  step    INTERVAL;
  cur     TIMESTAMPTZ;
  day_end TIMESTAMPTZ;
BEGIN
  SELECT vs.* INTO sched
    FROM public.vet_schedules vs
   WHERE vs.vet_id = p_vet_id AND vs.day_of_week = dow AND vs.is_active = true
   LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  step := make_interval(mins => COALESCE(p_slot_mins, sched.slot_duration_mins));

  cur     := (p_date::TIMESTAMP + sched.start_time)::TIMESTAMPTZ;
  day_end := (p_date::TIMESTAMP + sched.end_time)::TIMESTAMPTZ;

  WHILE cur + step <= day_end LOOP
    -- skip past times when computing today's slots
    IF cur > NOW() - INTERVAL '5 minutes' THEN
      -- collision check against existing non-cancelled appointments
      IF NOT EXISTS (
        SELECT 1
          FROM public.appointments apt
         WHERE apt.vet_id  = p_vet_id
           AND apt.status IN ('pending','confirmed')
           AND apt.appointment_at IS NOT NULL
           AND tstzrange(
                 apt.appointment_at,
                 apt.appointment_at + make_interval(mins => COALESCE(apt.duration_mins, 30)),
                 '[)'
               )
               &&
               tstzrange(cur, cur + step, '[)')
      ) THEN
        slot_start := cur;
        slot_end   := cur + step;
        RETURN NEXT;
      END IF;
    END IF;
    cur := cur + step;
  END LOOP;
END;
$$;


-- ============================================================
-- VIEW: v_vet_load_today
-- Per-vet count of pending/confirmed appointments today.
-- Used as a tiebreaker for nearest-vet scoring.
-- ============================================================
CREATE OR REPLACE VIEW public.v_vet_load_today AS
SELECT
  u.id                       AS vet_id,
  u.name                     AS vet_name,
  COUNT(a.id) FILTER (
    WHERE a.appointment_at::date = CURRENT_DATE
      AND a.status IN ('pending','confirmed')
  )                          AS load_today
FROM public.users u
LEFT JOIN public.appointments a ON a.vet_id = u.id
WHERE u.role = 'veterinarian' AND u.is_active = true
GROUP BY u.id, u.name;


-- ============================================================
-- FUNCTION: find_open_vets(p_date, p_around_time, p_limit)
-- For each on-schedule vet, return their closest available slot
-- to p_around_time (TIME). Caller can sort & pick top N.
-- ============================================================
CREATE OR REPLACE FUNCTION public.find_open_vets(
  p_date         DATE,
  p_around_time  TIME    DEFAULT NULL,
  p_limit        INT     DEFAULT 5
)
RETURNS TABLE (
  vet_id     UUID,
  vet_name   TEXT,
  slot_start TIMESTAMPTZ,
  slot_end   TIMESTAMPTZ,
  load_today INT,
  delta_mins INT
) LANGUAGE plpgsql STABLE AS $$
DECLARE
  target TIMESTAMPTZ;
BEGIN
  IF p_around_time IS NOT NULL THEN
    target := (p_date::TIMESTAMP + p_around_time)::TIMESTAMPTZ;
  ELSE
    target := (p_date::TIMESTAMP + TIME '09:00')::TIMESTAMPTZ;
  END IF;

  RETURN QUERY
    WITH ranked AS (
      SELECT
        u.id                                AS vet_id,
        u.name                              AS vet_name,
        s.slot_start, s.slot_end,
        COALESCE(l.load_today, 0)           AS load_today,
        ABS(EXTRACT(EPOCH FROM (s.slot_start - target))/60)::INT AS delta_mins,
        ROW_NUMBER() OVER (
          PARTITION BY u.id
          ORDER BY ABS(EXTRACT(EPOCH FROM (s.slot_start - target)))
        ) AS rn
      FROM public.users u
      LEFT JOIN public.v_vet_load_today l ON l.vet_id = u.id
      CROSS JOIN LATERAL public.get_available_slots(u.id, p_date) AS s
      WHERE u.role = 'veterinarian' AND u.is_active = true
    )
    SELECT r.vet_id, r.vet_name, r.slot_start, r.slot_end, r.load_today, r.delta_mins
      FROM ranked r
     WHERE r.rn = 1
     ORDER BY r.delta_mins ASC, r.load_today ASC
     LIMIT p_limit;
END;
$$;


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.appointment_intakes ENABLE ROW LEVEL SECURITY;

-- Reuse helpers (idempotent definitions)
CREATE OR REPLACE FUNCTION public.is_staff(uid UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = uid AND u.role IN ('admin','veterinarian','staff'));
$$;
CREATE OR REPLACE FUNCTION public.owns_pet(uid UUID, pet UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet AND p.owner_id = uid);
$$;

DROP POLICY IF EXISTS "intake_staff_all"    ON public.appointment_intakes;
DROP POLICY IF EXISTS "intake_owner_rw"     ON public.appointment_intakes;

CREATE POLICY "intake_staff_all"
  ON public.appointment_intakes FOR ALL
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "intake_owner_rw"
  ON public.appointment_intakes FOR ALL
  USING (public.owns_pet(auth.uid(), pet_id))
  WITH CHECK (public.owns_pet(auth.uid(), pet_id));
