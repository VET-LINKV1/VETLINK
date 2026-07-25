-- ============================================================
-- VETLINK Phase 8 — Prescriptive Analytics (Action Plan)
-- Run in Supabase SQL Editor AFTER phase7_predictive.sql
--
-- Adds:
--   1. Resource & scheduling tables (rooms, equipment, vet availability,
--      sterilization cycles).
--   2. prescriptive_recommendations cache (audit trail of suggestions).
--   3. Views the recommender engines query directly.
--   4. RPCs for the heavy joins (slot conflicts, demand-from-upcoming).
--
-- The /api/prescriptive/* endpoints aggregate on top of these.
-- Safe to re-run: every CREATE uses IF NOT EXISTS / CREATE OR REPLACE.
-- ============================================================

-- ── 1. RESOURCE TABLES ─────────────────────────────────────

-- rooms — exam rooms / surgery suites
CREATE TABLE IF NOT EXISTS public.rooms (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL UNIQUE,
  room_type       TEXT NOT NULL DEFAULT 'exam'   -- exam / surgery / isolation / dental
                  CHECK (room_type IN ('exam','surgery','isolation','dental','other')),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rooms_active ON public.rooms(is_active);

-- equipment — surgical / diagnostic tools that need sterilization
CREATE TABLE IF NOT EXISTS public.equipment (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                     TEXT NOT NULL UNIQUE,
  category                 TEXT,
  sterilization_cycle_mins INTEGER NOT NULL DEFAULT 45,    -- time required between uses
  is_active                BOOLEAN NOT NULL DEFAULT true,
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_equipment_active ON public.equipment(is_active);

-- equipment_usage — log of when a piece of equipment was last used.
-- "available_after" is computed from used_at + sterilization_cycle_mins.
CREATE TABLE IF NOT EXISTS public.equipment_usage (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id    UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  appointment_id  UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  used_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_by         UUID REFERENCES public.users(id),
  notes           TEXT
);
CREATE INDEX IF NOT EXISTS idx_equipment_usage_equipment ON public.equipment_usage(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_usage_used_at   ON public.equipment_usage(used_at);

-- vet_availability — recurring weekly availability windows per veterinarian.
-- dow: 0 (Sunday) .. 6 (Saturday)
CREATE TABLE IF NOT EXISTS public.vet_availability (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vet_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  dow         INTEGER NOT NULL CHECK (dow BETWEEN 0 AND 6),
  start_time  TIME    NOT NULL,
  end_time    TIME    NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS idx_vet_avail_vet ON public.vet_availability(vet_id);
CREATE INDEX IF NOT EXISTS idx_vet_avail_dow ON public.vet_availability(dow);


-- ── 2. RECOMMENDATIONS CACHE / AUDIT TRAIL ────────────────
CREATE TABLE IF NOT EXISTS public.prescriptive_recommendations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module        TEXT NOT NULL CHECK (module IN ('scheduling','wellness','ordering','summary')),
  subject_type  TEXT,                -- 'appointment' / 'pet' / 'medication' / 'global'
  subject_id    UUID,                -- target entity, nullable for global recs
  payload       JSONB NOT NULL,      -- engine output snapshot
  priority      TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','dismissed','done')),
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acted_at      TIMESTAMPTZ,
  acted_by      UUID REFERENCES public.users(id)
);
CREATE INDEX IF NOT EXISTS idx_rxn_module    ON public.prescriptive_recommendations(module);
CREATE INDEX IF NOT EXISTS idx_rxn_status    ON public.prescriptive_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_rxn_subject   ON public.prescriptive_recommendations(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_rxn_generated ON public.prescriptive_recommendations(generated_at);


-- ── 3. VIEWS ──────────────────────────────────────────────

-- v_presc_upcoming_appointments
-- Slim view of appointments that are still scheduled (not completed, not cancelled).
-- Used by the scheduling recommender to spot conflicts.
CREATE OR REPLACE VIEW public.v_presc_upcoming_appointments AS
SELECT
  a.id,
  a.client_id,
  a.vet_id,
  a.pet_id,
  a.appointment_at,
  COALESCE(a.duration_mins, 30)                                AS duration_mins,
  (a.appointment_at + (COALESCE(a.duration_mins, 30) || ' min')::interval) AS appointment_end_at,
  EXTRACT(DOW  FROM a.appointment_at)::int                     AS dow,
  EXTRACT(HOUR FROM a.appointment_at)::int                     AS hour_of_day,
  COALESCE(a.service, a.type, 'Unspecified')                    AS service,
  a.status::text                                                AS status,
  v.name                                                        AS vet_name,
  c.name                                                        AS client_name,
  p.name                                                        AS pet_name,
  p.species                                                     AS pet_species
FROM public.appointments a
LEFT JOIN public.users v ON v.id = a.vet_id
LEFT JOIN public.users c ON c.id = a.client_id
LEFT JOIN public.pets  p ON p.id = a.pet_id
WHERE a.appointment_at IS NOT NULL
  AND a.appointment_at >= NOW() - INTERVAL '1 day'
  AND a.status::text IN ('pending','confirmed');


-- v_presc_vet_load
-- Per-vet upcoming workload (next 30 days) and weekly availability total.
CREATE OR REPLACE VIEW public.v_presc_vet_load AS
WITH avail AS (
  SELECT vet_id,
         SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 60)::int AS weekly_minutes
  FROM public.vet_availability
  WHERE is_active = true
  GROUP BY vet_id
),
booked AS (
  SELECT a.vet_id,
         COUNT(*)                                AS upcoming_count,
         SUM(COALESCE(a.duration_mins, 30))::int  AS upcoming_minutes
  FROM public.appointments a
  WHERE a.vet_id IS NOT NULL
    AND a.appointment_at BETWEEN NOW() AND NOW() + INTERVAL '30 days'
    AND a.status::text IN ('pending','confirmed')
  GROUP BY a.vet_id
)
SELECT
  u.id                                              AS vet_id,
  u.name                                            AS vet_name,
  COALESCE(avail.weekly_minutes, 0)                 AS weekly_avail_minutes,
  COALESCE(avail.weekly_minutes, 0) * 4             AS monthly_avail_minutes,
  COALESCE(booked.upcoming_count, 0)                AS upcoming_count,
  COALESCE(booked.upcoming_minutes, 0)              AS upcoming_minutes,
  CASE
    WHEN COALESCE(avail.weekly_minutes, 0) * 4 = 0 THEN NULL
    ELSE ROUND(
      100.0 * COALESCE(booked.upcoming_minutes, 0)::numeric
            / (COALESCE(avail.weekly_minutes, 0) * 4)::numeric, 1)
  END                                               AS utilization_pct
FROM public.users u
LEFT JOIN avail  ON avail.vet_id  = u.id
LEFT JOIN booked ON booked.vet_id = u.id
WHERE u.role = 'veterinarian'
  AND u.is_active = true;


-- v_presc_equipment_status
-- Current readiness: when each item was last used + when it's next available.
CREATE OR REPLACE VIEW public.v_presc_equipment_status AS
WITH last_use AS (
  SELECT equipment_id, MAX(used_at) AS last_used_at
  FROM public.equipment_usage
  GROUP BY equipment_id
)
SELECT
  e.id                                                                 AS equipment_id,
  e.name,
  e.category,
  e.sterilization_cycle_mins,
  e.is_active,
  last_use.last_used_at,
  CASE
    WHEN last_use.last_used_at IS NULL THEN NOW()
    ELSE last_use.last_used_at + (e.sterilization_cycle_mins || ' min')::interval
  END                                                                  AS available_after,
  CASE
    WHEN last_use.last_used_at IS NULL THEN 'ready'
    WHEN last_use.last_used_at + (e.sterilization_cycle_mins || ' min')::interval <= NOW()
      THEN 'ready'
    ELSE 'sterilizing'
  END                                                                  AS status
FROM public.equipment e
LEFT JOIN last_use ON last_use.equipment_id = e.id
WHERE e.is_active = true;


-- v_presc_pet_wellness_baseline
-- Per-pet baseline features the wellness recommender uses.
-- (age, species, breed, weight, last visit, last diagnoses, vaccine history)
CREATE OR REPLACE VIEW public.v_presc_pet_wellness_baseline AS
WITH mr_clean AS (
  -- Filter empty diagnoses BEFORE aggregating to avoid FILTER-on-ARRAY_AGG parser quirks
  SELECT pet_id, visit_date, follow_up_date, diagnosis
  FROM public.medical_records
  WHERE diagnosis IS NOT NULL
    AND TRIM(diagnosis) <> ''
),
mr_rolled AS (
  SELECT
    mr.pet_id,
    MAX(mr.visit_date)                  AS last_visit_date,
    MAX(mr.follow_up_date)              AS next_followup_date,
    COUNT(*)                             AS visit_count,
    COUNT(mr.diagnosis)                  AS diagnosis_count,
    -- Diagnoses ordered most-recent-first
    ARRAY_AGG(mr.diagnosis ORDER BY mr.visit_date DESC NULLS LAST) AS recent_diagnoses
  FROM mr_clean mr
  GROUP BY mr.pet_id
)
SELECT
  p.id                AS pet_id,
  p.name              AS pet_name,
  p.species,
  p.breed,
  p.age,
  p.gender,
  p.weight_kg,
  p.owner_id,
  u.name              AS owner_name,
  mr_rolled.last_visit_date,
  mr_rolled.next_followup_date,
  COALESCE(mr_rolled.visit_count, 0)                                    AS visit_count,
  COALESCE(mr_rolled.diagnosis_count, 0)                                AS diagnosis_count,
  COALESCE(mr_rolled.recent_diagnoses, ARRAY[]::text[])                 AS recent_diagnoses,
  -- Days since last visit
  CASE WHEN mr_rolled.last_visit_date IS NULL THEN NULL
       ELSE (CURRENT_DATE - mr_rolled.last_visit_date) END              AS days_since_last_visit
FROM public.pets p
LEFT JOIN public.users u  ON u.id = p.owner_id
LEFT JOIN mr_rolled       ON mr_rolled.pet_id = p.id;


-- v_presc_upcoming_demand
-- For each upcoming appointment, infer the likely service it will consume so
-- we can roll medication / vaccine demand for the next N days.
-- This is heuristic: maps service keywords → medication categories.
CREATE OR REPLACE VIEW public.v_presc_upcoming_demand AS
SELECT
  a.id                                                                  AS appointment_id,
  a.appointment_at,
  a.appointment_at::date                                                AS appointment_date,
  COALESCE(a.service, a.type, 'Unspecified')                             AS service,
  -- Heuristic: pull a category hint from the service name
  CASE
    WHEN LOWER(COALESCE(a.service, a.type, '')) LIKE '%vaccin%' THEN 'vaccine'
    WHEN LOWER(COALESCE(a.service, a.type, '')) LIKE '%rabies%' THEN 'vaccine'
    WHEN LOWER(COALESCE(a.service, a.type, '')) LIKE '%deworm%' THEN 'antiparasitic'
    WHEN LOWER(COALESCE(a.service, a.type, '')) LIKE '%fleas%'  THEN 'antiparasitic'
    WHEN LOWER(COALESCE(a.service, a.type, '')) LIKE '%surgery%' THEN 'antibiotic'
    WHEN LOWER(COALESCE(a.service, a.type, '')) LIKE '%spay%'    THEN 'antibiotic'
    WHEN LOWER(COALESCE(a.service, a.type, '')) LIKE '%neuter%'  THEN 'antibiotic'
    ELSE 'other'
  END                                                                  AS likely_category,
  a.pet_id,
  a.vet_id,
  a.status::text                                                        AS status
FROM public.appointments a
WHERE a.appointment_at >= CURRENT_DATE
  AND a.appointment_at <= CURRENT_DATE + INTERVAL '60 days'
  AND a.status::text IN ('pending','confirmed');


-- ── 4. RPC HELPERS ────────────────────────────────────────

-- fn_presc_demand_from_upcoming(p_horizon_days)
-- Roll the upcoming appointments × medication catalogue to produce
-- per-category projected demand for the next N days.
CREATE OR REPLACE FUNCTION public.fn_presc_demand_from_upcoming(
  p_horizon_days INT DEFAULT 30
)
RETURNS TABLE (
  category           TEXT,
  upcoming_appts     BIGINT,
  estimated_units    NUMERIC,
  category_meds      BIGINT
)
LANGUAGE sql
STABLE
AS $$
  WITH upcoming AS (
    SELECT likely_category, COUNT(*) AS appts
    FROM public.v_presc_upcoming_demand
    WHERE appointment_at <= CURRENT_DATE + (p_horizon_days || ' days')::interval
    GROUP BY likely_category
  ),
  cat_meds AS (
    SELECT category, COUNT(*) AS med_count
    FROM public.medications
    WHERE is_active = true
    GROUP BY category
  )
  SELECT
    COALESCE(upcoming.likely_category, cat_meds.category) AS category,
    COALESCE(upcoming.appts, 0)                            AS upcoming_appts,
    -- Estimate 1 unit per appointment as a baseline (override in app)
    COALESCE(upcoming.appts, 0)::numeric                   AS estimated_units,
    COALESCE(cat_meds.med_count, 0)                        AS category_meds
  FROM upcoming
  FULL OUTER JOIN cat_meds ON cat_meds.category = upcoming.likely_category
  ORDER BY upcoming_appts DESC NULLS LAST;
$$;


-- fn_presc_schedule_conflicts()
-- Pair-find upcoming appointments where the same vet is double-booked
-- (overlapping windows) and return both halves of each conflict.
CREATE OR REPLACE FUNCTION public.fn_presc_schedule_conflicts()
RETURNS TABLE (
  vet_id            UUID,
  vet_name          TEXT,
  appointment_a     UUID,
  appointment_b     UUID,
  start_a           TIMESTAMPTZ,
  end_a             TIMESTAMPTZ,
  start_b           TIMESTAMPTZ,
  end_b             TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    a.vet_id,
    a.vet_name,
    a.id              AS appointment_a,
    b.id              AS appointment_b,
    a.appointment_at  AS start_a,
    a.appointment_end_at AS end_a,
    b.appointment_at  AS start_b,
    b.appointment_end_at AS end_b
  FROM public.v_presc_upcoming_appointments a
  JOIN public.v_presc_upcoming_appointments b
    ON a.vet_id = b.vet_id
   AND a.id < b.id
   AND a.appointment_at      < b.appointment_end_at
   AND b.appointment_at      < a.appointment_end_at
  WHERE a.vet_id IS NOT NULL;
$$;


-- ── 5. SEED DATA (idempotent) ─────────────────────────────
INSERT INTO public.rooms (name, room_type)
SELECT * FROM (VALUES
  ('Exam Room 1',    'exam'),
  ('Exam Room 2',    'exam'),
  ('Surgery Suite',  'surgery'),
  ('Isolation Room', 'isolation'),
  ('Dental Bay',     'dental')
) AS s(name, room_type)
WHERE NOT EXISTS (SELECT 1 FROM public.rooms LIMIT 1);

INSERT INTO public.equipment (name, category, sterilization_cycle_mins)
SELECT * FROM (VALUES
  ('Surgical Kit A',   'surgical',   60),
  ('Surgical Kit B',   'surgical',   60),
  ('Dental Scaler',    'dental',     45),
  ('Endoscope',        'diagnostic', 90),
  ('Anesthesia Machine','surgical',  30),
  ('Ultrasound Probe', 'diagnostic', 15)
) AS s(name, category, sterilization_cycle_mins)
WHERE NOT EXISTS (SELECT 1 FROM public.equipment LIMIT 1);


-- ── 6. RLS ────────────────────────────────────────────────
ALTER TABLE public.rooms                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_usage                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vet_availability               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptive_recommendations   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_rooms" ON public.rooms;
CREATE POLICY "staff_read_rooms" ON public.rooms FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users u
                  WHERE u.id = auth.uid()
                    AND u.role IN ('admin','veterinarian','staff')));

DROP POLICY IF EXISTS "admins_manage_rooms" ON public.rooms;
CREATE POLICY "admins_manage_rooms" ON public.rooms FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users u
                  WHERE u.id = auth.uid() AND u.role = 'admin'));

DROP POLICY IF EXISTS "staff_read_equipment" ON public.equipment;
CREATE POLICY "staff_read_equipment" ON public.equipment FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users u
                  WHERE u.id = auth.uid()
                    AND u.role IN ('admin','veterinarian','staff')));

DROP POLICY IF EXISTS "admins_manage_equipment" ON public.equipment;
CREATE POLICY "admins_manage_equipment" ON public.equipment FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users u
                  WHERE u.id = auth.uid() AND u.role = 'admin'));

DROP POLICY IF EXISTS "staff_read_equipment_usage" ON public.equipment_usage;
CREATE POLICY "staff_read_equipment_usage" ON public.equipment_usage FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users u
                  WHERE u.id = auth.uid()
                    AND u.role IN ('admin','veterinarian','staff')));

DROP POLICY IF EXISTS "staff_write_equipment_usage" ON public.equipment_usage;
CREATE POLICY "staff_write_equipment_usage" ON public.equipment_usage FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u
                       WHERE u.id = auth.uid()
                         AND u.role IN ('admin','veterinarian','staff')));

DROP POLICY IF EXISTS "vet_read_vet_avail" ON public.vet_availability;
CREATE POLICY "vet_read_vet_avail" ON public.vet_availability FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users u
                  WHERE u.id = auth.uid()
                    AND u.role IN ('admin','veterinarian','staff')));

DROP POLICY IF EXISTS "admins_manage_vet_avail" ON public.vet_availability;
CREATE POLICY "admins_manage_vet_avail" ON public.vet_availability FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users u
                  WHERE u.id = auth.uid() AND u.role = 'admin'));

DROP POLICY IF EXISTS "admins_manage_recommendations" ON public.prescriptive_recommendations;
CREATE POLICY "admins_manage_recommendations"
  ON public.prescriptive_recommendations FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users u
                  WHERE u.id = auth.uid()
                    AND u.role IN ('admin','veterinarian')));


