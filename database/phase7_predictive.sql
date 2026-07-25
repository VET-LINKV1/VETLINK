-- ============================================================
-- VETLINK Phase 7 — Predictive Analytics
-- Run in Supabase SQL Editor AFTER phase6_diagnostic.sql
--
-- Adds:
--   1. predictive_cache table   — optional persistence of model output.
--   2. Helper VIEWS              — pre-shaped feature tables consumed
--                                   by the predictive engines.
--   3. RPC helpers               — heaviest rollups (per-client
--                                   churn features, monthly demand,
--                                   appointment density, pet risk).
--
-- Safe to re-run: every CREATE uses IF NOT EXISTS / CREATE OR REPLACE.
-- ============================================================

-- ── 1. CACHE TABLE (optional) ─────────────────────────────
-- Models are cheap; cache exists so the dashboard can render
-- instantly after the first run without re-training.
CREATE TABLE IF NOT EXISTS public.predictive_cache (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module      TEXT NOT NULL CHECK (module IN ('churn','inventory','appointments','treatment_risk','summary')),
  cache_key   TEXT NOT NULL,
  payload     JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_predictive_cache_module ON public.predictive_cache(module);
CREATE INDEX IF NOT EXISTS idx_predictive_cache_key    ON public.predictive_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_predictive_cache_exp    ON public.predictive_cache(expires_at);


-- ── 2. VIEWS ──────────────────────────────────────────────

-- v_pred_client_features
-- One row per CLIENT with rolling features used by the churn classifier.
-- (Decision-tree / logistic-style features — service computes the score.)
--
-- NOTE on "missed" appointments:
-- The appointment_status enum is ('pending','confirmed','completed','cancelled')
-- — there is no explicit no-show / missed value. We approximate a "missed"
-- appointment as one whose scheduled time has passed without being completed
-- or cancelled (i.e. still 'pending' or 'confirmed' after the fact).
CREATE OR REPLACE VIEW public.v_pred_client_features AS
WITH appt AS (
  SELECT
    a.client_id,
    a.id,
    a.status,
    a.amount,
    COALESCE(a.completed_at, a.appointment_at, a.created_at) AS activity_at,
    a.appointment_at,
    a.completed_at,
    a.created_at,
    -- Proxy: appointment date passed, not completed and not cancelled → missed
    (a.appointment_at IS NOT NULL
      AND a.appointment_at < NOW()
      AND a.status::text IN ('pending','confirmed')
      AND a.completed_at IS NULL) AS is_missed_proxy
  FROM public.appointments a
  WHERE a.client_id IS NOT NULL
)
SELECT
  u.id                                                                AS client_id,
  u.name                                                              AS client_name,
  u.email                                                             AS client_email,
  u.created_at                                                        AS joined_at,
  COUNT(appt.id)                                                      AS total_appointments,
  COUNT(appt.id) FILTER (WHERE appt.status = 'completed')             AS completed_count,
  COUNT(appt.id) FILTER (WHERE appt.status = 'cancelled')             AS cancelled_count,
  COUNT(appt.id) FILTER (WHERE appt.status = 'pending')               AS pending_count,
  COUNT(appt.id) FILTER (WHERE appt.is_missed_proxy)                  AS missed_count,
  -- Missed (proxy) + cancellations in the last 180 days
  COUNT(appt.id) FILTER (
    WHERE (appt.status = 'cancelled' OR appt.is_missed_proxy)
      AND appt.activity_at >= CURRENT_DATE - INTERVAL '180 days'
  )                                                                   AS recent_missed_count,
  MAX(appt.activity_at)                                               AS last_activity_at,
  MIN(appt.activity_at)                                               AS first_activity_at,
  -- Days since last activity (inactivity signal)
  CASE
    WHEN MAX(appt.activity_at) IS NULL THEN NULL
    ELSE (CURRENT_DATE - MAX(appt.activity_at)::date)
  END                                                                 AS days_since_last_visit,
  -- Lifetime spending in centavos
  COALESCE(SUM(appt.amount), 0)                                       AS lifetime_spend_centavos,
  -- Spend trend — last 90 days vs prior 90 days
  COALESCE(SUM(appt.amount) FILTER (
    WHERE appt.activity_at >= CURRENT_DATE - INTERVAL '90 days'
  ), 0)                                                               AS spend_recent_centavos,
  COALESCE(SUM(appt.amount) FILTER (
    WHERE appt.activity_at < CURRENT_DATE - INTERVAL '90 days'
      AND appt.activity_at >= CURRENT_DATE - INTERVAL '180 days'
  ), 0)                                                               AS spend_prior_centavos,
  COUNT(appt.id) FILTER (
    WHERE appt.activity_at >= CURRENT_DATE - INTERVAL '90 days'
  )                                                                   AS visits_recent_90d,
  COUNT(appt.id) FILTER (
    WHERE appt.activity_at < CURRENT_DATE - INTERVAL '90 days'
      AND appt.activity_at >= CURRENT_DATE - INTERVAL '180 days'
  )                                                                   AS visits_prior_90d
FROM public.users u
LEFT JOIN appt ON appt.client_id = u.id
WHERE u.role = 'client'
GROUP BY u.id, u.name, u.email, u.created_at;


-- v_pred_monthly_service_demand
-- Per-(year, month, service) appointment counts — drives seasonal demand
-- forecasting and appointment forecasting alike.
CREATE OR REPLACE VIEW public.v_pred_monthly_service_demand AS
SELECT
  EXTRACT(YEAR  FROM COALESCE(a.completed_at, a.appointment_at, a.created_at))::int AS year,
  EXTRACT(MONTH FROM COALESCE(a.completed_at, a.appointment_at, a.created_at))::int AS month,
  COALESCE(a.service, a.type, 'Unspecified')                                          AS service,
  COUNT(*)                                                                            AS appointment_count,
  COUNT(*) FILTER (WHERE a.status = 'completed')                                      AS completed_count,
  COUNT(*) FILTER (WHERE a.status = 'cancelled')                                      AS cancelled_count,
  COUNT(DISTINCT a.client_id)                                                         AS unique_clients
FROM public.appointments a
WHERE COALESCE(a.completed_at, a.appointment_at, a.created_at) IS NOT NULL
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;


-- v_pred_inventory_usage_monthly
-- Per-(year, month, medication_id) usage rollup. Drives inventory forecast.
-- Falls back to medication_transactions of type 'used' OR 'billed'.
CREATE OR REPLACE VIEW public.v_pred_inventory_usage_monthly AS
SELECT
  EXTRACT(YEAR  FROM t.occurred_at)::int AS year,
  EXTRACT(MONTH FROM t.occurred_at)::int AS month,
  t.medication_id,
  m.sku,
  m.name              AS medication_name,
  m.category,
  m.unit,
  m.reorder_level,
  SUM(t.qty) FILTER (WHERE t.txn_type IN ('used','billed')) AS qty_used,
  SUM(t.qty) FILTER (WHERE t.txn_type = 'received')         AS qty_received,
  COUNT(*)                                                  AS txn_count
FROM public.medication_transactions t
JOIN public.medications m ON m.id = t.medication_id
GROUP BY 1, 2, t.medication_id, m.sku, m.name, m.category, m.unit, m.reorder_level
ORDER BY 1, 2, m.name;


-- v_pred_appointment_density
-- Per (dow, hour) appointment counts across the trailing 365 days.
-- Drives the "busy hours / busy days" heatmap forecast.
CREATE OR REPLACE VIEW public.v_pred_appointment_density AS
SELECT
  EXTRACT(DOW  FROM a.appointment_at)::int  AS dow,    -- 0 = Sunday
  EXTRACT(HOUR FROM a.appointment_at)::int  AS hour_of_day,
  COUNT(*)                                  AS appointment_count,
  COUNT(*) FILTER (WHERE a.status = 'completed')  AS completed_count,
  COUNT(*) FILTER (WHERE a.status = 'cancelled')  AS cancelled_count,
  COUNT(DISTINCT a.client_id)               AS unique_clients
FROM public.appointments a
WHERE a.appointment_at IS NOT NULL
  AND a.appointment_at >= CURRENT_DATE - INTERVAL '365 days'
GROUP BY 1, 2
ORDER BY 1, 2;


-- v_pred_pet_risk_features
-- Per-pet treatment-risk features.
CREATE OR REPLACE VIEW public.v_pred_pet_risk_features AS
WITH mr_rolled AS (
  SELECT
    mr.pet_id,
    COUNT(*)                                            AS visit_count,
    COUNT(DISTINCT TRIM(LOWER(mr.diagnosis)))           AS distinct_diagnoses,
    COUNT(*) FILTER (WHERE mr.follow_up_date IS NOT NULL) AS followups_scheduled,
    MAX(mr.visit_date)                                  AS last_visit_date,
    MIN(mr.visit_date)                                  AS first_visit_date,
    MAX(mr.follow_up_date)                              AS next_followup_date
  FROM public.medical_records mr
  GROUP BY mr.pet_id
),
recurring AS (
  -- Diagnoses that appear ≥ 2 times for the same pet within 180 days
  SELECT
    mr.pet_id,
    COUNT(*)                                            AS recurring_events
  FROM (
    SELECT
      pet_id,
      TRIM(LOWER(diagnosis)) AS dx_key,
      visit_date,
      LEAD(visit_date) OVER (
        PARTITION BY pet_id, TRIM(LOWER(diagnosis))
        ORDER BY visit_date
      ) AS next_visit
    FROM public.medical_records
    WHERE diagnosis IS NOT NULL AND TRIM(diagnosis) <> ''
  ) mr
  WHERE mr.next_visit IS NOT NULL
    AND (mr.next_visit - mr.visit_date) <= 180
  GROUP BY mr.pet_id
)
SELECT
  p.id              AS pet_id,
  p.name            AS pet_name,
  p.species,
  p.breed,
  p.age,
  p.gender,
  p.weight_kg,
  p.owner_id,
  u.name            AS owner_name,
  COALESCE(mr_rolled.visit_count,         0)  AS visit_count,
  COALESCE(mr_rolled.distinct_diagnoses,  0)  AS distinct_diagnoses,
  COALESCE(mr_rolled.followups_scheduled, 0)  AS followups_scheduled,
  mr_rolled.last_visit_date,
  mr_rolled.first_visit_date,
  mr_rolled.next_followup_date,
  COALESCE(recurring.recurring_events,    0)  AS recurring_events
FROM public.pets p
LEFT JOIN public.users     u  ON u.id = p.owner_id
LEFT JOIN mr_rolled            ON mr_rolled.pet_id = p.id
LEFT JOIN recurring            ON recurring.pet_id = p.id;


-- ── 3. RPC HELPERS ────────────────────────────────────────

-- fn_pred_demand_seasonality(p_lookback_months)
-- Returns per-(service, month_of_year) average appointment_count across
-- the trailing N months. The service uses this for naive seasonal forecasts.
CREATE OR REPLACE FUNCTION public.fn_pred_demand_seasonality(
  p_lookback_months INT DEFAULT 24
)
RETURNS TABLE (
  service          TEXT,
  month_of_year    INT,
  avg_demand       NUMERIC,
  sample_size      BIGINT
)
LANGUAGE sql
STABLE
AS $$
  WITH base AS (
    SELECT
      EXTRACT(MONTH FROM COALESCE(a.completed_at, a.appointment_at, a.created_at))::int AS month_of_year,
      COALESCE(a.service, a.type, 'Unspecified')                                         AS service,
      COUNT(*)                                                                           AS demand
    FROM public.appointments a
    WHERE COALESCE(a.completed_at, a.appointment_at, a.created_at)
            >= CURRENT_DATE - (p_lookback_months || ' months')::interval
    GROUP BY
      EXTRACT(YEAR  FROM COALESCE(a.completed_at, a.appointment_at, a.created_at)),
      EXTRACT(MONTH FROM COALESCE(a.completed_at, a.appointment_at, a.created_at)),
      COALESCE(a.service, a.type, 'Unspecified')
  )
  SELECT service,
         month_of_year,
         ROUND(AVG(demand)::numeric, 2) AS avg_demand,
         COUNT(*)                       AS sample_size
  FROM base
  GROUP BY service, month_of_year
  ORDER BY service, month_of_year;
$$;


-- fn_pred_appointment_density()
-- Lightweight RPC wrapper so the service can call it without crafting
-- a view query manually. Returns identical data to v_pred_appointment_density.
CREATE OR REPLACE FUNCTION public.fn_pred_appointment_density()
RETURNS TABLE (
  dow                INT,
  hour_of_day        INT,
  appointment_count  BIGINT,
  completed_count    BIGINT,
  cancelled_count    BIGINT,
  unique_clients     BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT * FROM public.v_pred_appointment_density;
$$;


-- ── 4. RLS ────────────────────────────────────────────────
ALTER TABLE public.predictive_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_predictive_cache" ON public.predictive_cache;
CREATE POLICY "admins_manage_predictive_cache"
  ON public.predictive_cache FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users u
                  WHERE u.id = auth.uid() AND u.role = 'admin'));


-- ── DONE ──
-- After this migration, the backend can query:
--   supabaseAdmin.from('v_pred_client_features').select(...)
--   supabaseAdmin.from('v_pred_monthly_service_demand').select(...)
--   supabaseAdmin.from('v_pred_inventory_usage_monthly').select(...)
--   supabaseAdmin.from('v_pred_appointment_density').select(...)
--   supabaseAdmin.from('v_pred_pet_risk_features').select(...)
--   supabaseAdmin.rpc('fn_pred_demand_seasonality', { p_lookback_months: 24 })
--   supabaseAdmin.rpc('fn_pred_appointment_density')
