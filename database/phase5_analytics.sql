-- ============================================================
-- VETLINK Phase 5 — Descriptive Analytics ("The Health Check")
-- Run in Supabase SQL Editor AFTER phase4_payments.sql
--
-- This migration adds:
--   1. Indexes that make the aggregation queries cheap
--   2. Read-only convenience VIEWs the backend can query directly
--      (the backend uses the service-role key, so RLS is bypassed
--       and admins/staff/vets/clients are filtered in app code).
--   3. Helper RPC functions for the heaviest cross-table rollups.
--
-- The /api/analytics/health-check/* endpoints aggregate on top of these.
-- Safe to re-run: every CREATE uses IF NOT EXISTS / CREATE OR REPLACE.
-- ============================================================

-- ── 1. INDEXES tuned for analytics ──────────────────────────
CREATE INDEX IF NOT EXISTS idx_appt_created_at        ON public.appointments(created_at);
CREATE INDEX IF NOT EXISTS idx_appt_completed_at      ON public.appointments(completed_at);
CREATE INDEX IF NOT EXISTS idx_appt_type              ON public.appointments(type);
CREATE INDEX IF NOT EXISTS idx_appt_payment_status    ON public.appointments(payment_status);

CREATE INDEX IF NOT EXISTS idx_pets_species           ON public.pets(species);
CREATE INDEX IF NOT EXISTS idx_pets_created_at        ON public.pets(created_at);

CREATE INDEX IF NOT EXISTS idx_mr_diagnosis           ON public.medical_records(diagnosis);
CREATE INDEX IF NOT EXISTS idx_mr_follow_up           ON public.medical_records(follow_up_date);

CREATE INDEX IF NOT EXISTS idx_payments_paid_at       ON public.payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_payments_method        ON public.payments(payment_method);


-- ── 2. CONVENIENCE VIEWS ─────────────────────────────────────

-- v_appointments_enriched
-- Flattens the joins the analytics service repeatedly needs.
CREATE OR REPLACE VIEW public.v_appointments_enriched AS
SELECT
  a.id,
  a.pet_id,
  a.client_id,
  a.vet_id,
  a.appointment_at,
  COALESCE(a.completed_at, a.appointment_at, a.created_at) AS effective_at,
  a.status,
  a.type,
  a.service,
  a.amount,
  a.payment_status,
  a.duration_mins,
  a.created_at,
  a.completed_at,
  p.name        AS pet_name,
  p.species     AS pet_species,
  p.breed       AS pet_breed,
  c.name        AS client_name,
  v.name        AS vet_name
FROM public.appointments a
LEFT JOIN public.pets    p ON p.id = a.pet_id
LEFT JOIN public.users   c ON c.id = a.client_id
LEFT JOIN public.users   v ON v.id = a.vet_id;

-- v_revenue_monthly
-- Monthly successful revenue, one row per month with PHP totals (centavos / 100).
CREATE OR REPLACE VIEW public.v_revenue_monthly AS
SELECT
  date_trunc('month', COALESCE(p.paid_at, p.created_at))::date AS month,
  COUNT(*) FILTER (WHERE p.status = 'paid')                   AS paid_count,
  COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'paid'), 0) AS paid_amount_centavos
FROM public.payments p
GROUP BY 1
ORDER BY 1;

-- v_top_diagnoses
-- Most-common diagnoses across all medical records.
CREATE OR REPLACE VIEW public.v_top_diagnoses AS
SELECT
  TRIM(LOWER(diagnosis)) AS diagnosis_key,
  -- preserve first-seen casing for display
  (ARRAY_AGG(diagnosis ORDER BY created_at))[1] AS diagnosis_label,
  COUNT(*)                                       AS occurrences,
  COUNT(DISTINCT pet_id)                         AS pets_affected,
  MIN(visit_date)                                AS first_seen,
  MAX(visit_date)                                AS last_seen
FROM public.medical_records
WHERE diagnosis IS NOT NULL AND TRIM(diagnosis) <> ''
GROUP BY 1
ORDER BY occurrences DESC;

-- v_pet_visit_frequency
-- Per-pet visit cadence (used by client + vet dashboards).
CREATE OR REPLACE VIEW public.v_pet_visit_frequency AS
SELECT
  p.id            AS pet_id,
  p.owner_id,
  p.name          AS pet_name,
  p.species,
  p.breed,
  COUNT(mr.id)                              AS total_visits,
  MIN(mr.visit_date)                        AS first_visit,
  MAX(mr.visit_date)                        AS last_visit,
  CASE
    WHEN COUNT(mr.id) < 2 THEN NULL
    ELSE EXTRACT(EPOCH FROM (MAX(mr.visit_date)::timestamp - MIN(mr.visit_date)::timestamp))
         / NULLIF(86400 * (COUNT(mr.id) - 1), 0)
  END AS avg_days_between_visits
FROM public.pets p
LEFT JOIN public.medical_records mr ON mr.pet_id = p.id
GROUP BY p.id, p.owner_id, p.name, p.species, p.breed;


-- ── 3. HELPER RPC FUNCTIONS ──────────────────────────────────
-- Called from the analytics service via supabase.rpc(...) to keep
-- the JS code small for the heaviest rollups.

-- fn_appointments_by_day(start_date, end_date)
-- Returns one row per day with status counts; useful for the
-- appointment-volume chart.
CREATE OR REPLACE FUNCTION public.fn_appointments_by_day(
  p_start DATE,
  p_end   DATE
)
RETURNS TABLE (
  day        DATE,
  total      BIGINT,
  pending    BIGINT,
  confirmed  BIGINT,
  completed  BIGINT,
  cancelled  BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    d.day::date,
    COUNT(a.id),
    COUNT(a.id) FILTER (WHERE a.status = 'pending'),
    COUNT(a.id) FILTER (WHERE a.status = 'confirmed'),
    COUNT(a.id) FILTER (WHERE a.status = 'completed'),
    COUNT(a.id) FILTER (WHERE a.status = 'cancelled')
  FROM generate_series(p_start, p_end, '1 day'::interval) AS d(day)
  LEFT JOIN public.appointments a
    ON date_trunc('day', COALESCE(a.appointment_at, a.created_at))::date = d.day::date
  GROUP BY d.day
  ORDER BY d.day;
$$;

-- fn_vaccination_compliance()
-- A pet is "current" if they have ≥1 medical record in the last 365 days
-- whose diagnosis OR treatment OR prescription mentions vaccination keywords.
-- Returns a single row.
CREATE OR REPLACE FUNCTION public.fn_vaccination_compliance()
RETURNS TABLE (
  total_pets         BIGINT,
  vaccinated_pets    BIGINT,
  compliance_percent NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH vaccinated AS (
    SELECT DISTINCT mr.pet_id
    FROM public.medical_records mr
    WHERE mr.visit_date >= CURRENT_DATE - INTERVAL '365 days'
      AND (
        mr.diagnosis    ILIKE '%vaccin%' OR
        mr.treatment    ILIKE '%vaccin%' OR
        mr.prescription ILIKE '%vaccin%' OR
        mr.diagnosis    ILIKE '%booster%' OR
        mr.treatment    ILIKE '%booster%' OR
        mr.diagnosis    ILIKE '%immuniz%' OR
        mr.treatment    ILIKE '%immuniz%'
      )
  )
  SELECT
    (SELECT COUNT(*) FROM public.pets)                                AS total_pets,
    (SELECT COUNT(*) FROM vaccinated)                                  AS vaccinated_pets,
    CASE
      WHEN (SELECT COUNT(*) FROM public.pets) = 0 THEN 0
      ELSE ROUND(
        100.0 * (SELECT COUNT(*) FROM vaccinated)::numeric
              / (SELECT COUNT(*) FROM public.pets)::numeric, 1)
    END AS compliance_percent;
$$;

-- ── 4. DONE ──
-- After running this file, the backend can query:
--   supabaseAdmin.from('v_appointments_enriched').select(...)
--   supabaseAdmin.rpc('fn_appointments_by_day', { p_start, p_end })
--   supabaseAdmin.rpc('fn_vaccination_compliance')
