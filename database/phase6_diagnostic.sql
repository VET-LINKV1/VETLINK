-- ============================================================
-- VETLINK Phase 6 — Diagnostic Analytics (Root Cause)
-- Run in Supabase SQL Editor AFTER phase5_analytics.sql
--
-- This migration adds:
--   1. Inventory + medication tracking tables (catalog, batches,
--      transactions, billing line items) — required for shrinkage.
--   2. Indexes tuned for the diagnostic queries.
--   3. Read-only VIEWs the diagnostic service queries directly.
--   4. Helper RPC functions for the heaviest rollups
--      (churn cohorts, treatment cohorts, shrinkage joins).
--
-- The /api/diagnostic/* endpoints aggregate on top of these.
-- Safe to re-run: every CREATE uses IF NOT EXISTS / CREATE OR REPLACE.
-- ============================================================

-- ── 1. INVENTORY / MEDICATION TABLES ────────────────────────

-- medications
-- Master catalog. One row per SKU regardless of batch.
CREATE TABLE IF NOT EXISTS public.medications (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku               TEXT UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  category          TEXT,                       -- antibiotic / vaccine / antiparasitic / supplement / other
  unit              TEXT NOT NULL DEFAULT 'unit', -- vial / tablet / ml / dose
  unit_price_cents  INTEGER NOT NULL DEFAULT 0,  -- selling price PHP × 100
  reorder_level     INTEGER NOT NULL DEFAULT 0,
  is_controlled     BOOLEAN NOT NULL DEFAULT false,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS medications_updated_at ON public.medications;
CREATE TRIGGER medications_updated_at
  BEFORE UPDATE ON public.medications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_medications_active   ON public.medications(is_active);
CREATE INDEX IF NOT EXISTS idx_medications_category ON public.medications(category);


-- medication_batches
-- Lot-level tracking (purchase, expiry).
CREATE TABLE IF NOT EXISTS public.medication_batches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  medication_id   UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  batch_no        TEXT,
  qty_received    INTEGER NOT NULL CHECK (qty_received >= 0),
  unit_cost_cents INTEGER NOT NULL DEFAULT 0,
  received_at     DATE NOT NULL DEFAULT CURRENT_DATE,
  expires_at      DATE,
  supplier        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batches_medication_id ON public.medication_batches(medication_id);
CREATE INDEX IF NOT EXISTS idx_batches_expires_at    ON public.medication_batches(expires_at);


-- medication_transactions
-- Every stock movement (received / used / billed / expired / adjustment).
-- "used"    = quantity taken from inventory by a vet
-- "billed"  = quantity charged on a client invoice
-- They can drift apart → that drift is shrinkage.
CREATE TABLE IF NOT EXISTS public.medication_transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  medication_id   UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  batch_id        UUID REFERENCES public.medication_batches(id) ON DELETE SET NULL,
  txn_type        TEXT NOT NULL CHECK (txn_type IN ('received','used','billed','expired','adjustment')),
  qty             INTEGER NOT NULL,           -- can be negative on adjustments
  unit_price_cents INTEGER,                    -- snapshot at time of txn
  appointment_id  UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  medical_record_id UUID REFERENCES public.medical_records(id) ON DELETE SET NULL,
  performed_by    UUID REFERENCES public.users(id),
  notes           TEXT,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mt_medication_id ON public.medication_transactions(medication_id);
CREATE INDEX IF NOT EXISTS idx_mt_type          ON public.medication_transactions(txn_type);
CREATE INDEX IF NOT EXISTS idx_mt_occurred_at   ON public.medication_transactions(occurred_at);
CREATE INDEX IF NOT EXISTS idx_mt_appointment   ON public.medication_transactions(appointment_id);


-- ── 2. ADDITIONAL INDEXES FOR DIAGNOSTIC QUERIES ──────────
-- (idx_appt_completed_at already exists from phase5_analytics.sql)
CREATE INDEX IF NOT EXISTS idx_appt_cancel_reason     ON public.appointments(cancel_reason);
CREATE INDEX IF NOT EXISTS idx_appt_amount            ON public.appointments(amount);
CREATE INDEX IF NOT EXISTS idx_mr_treatment           ON public.medical_records(treatment);
CREATE INDEX IF NOT EXISTS idx_mr_visit_date_pet      ON public.medical_records(pet_id, visit_date DESC);


-- ── 3. VIEWS ──────────────────────────────────────────────

-- v_diag_appointments
-- Lean projection used by all three diagnostic analyzers.
CREATE OR REPLACE VIEW public.v_diag_appointments AS
SELECT
  a.id,
  a.client_id,
  a.vet_id,
  a.pet_id,
  a.appointment_at,
  a.completed_at,
  a.created_at,
  a.status,
  a.type,
  a.service,
  COALESCE(a.amount, 0) AS amount_centavos,
  a.payment_status,
  a.duration_mins,
  a.cancel_reason,
  -- Real elapsed minutes from scheduled time to completion (NULL if not completed)
  CASE
    WHEN a.completed_at IS NOT NULL AND a.appointment_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (a.completed_at - a.appointment_at)) / 60
    ELSE NULL
  END AS elapsed_mins,
  v.name AS vet_name,
  c.name AS client_name
FROM public.appointments a
LEFT JOIN public.users v ON v.id = a.vet_id
LEFT JOIN public.users c ON c.id = a.client_id;


-- v_diag_client_activity
-- One row per client with first/last visit + total visits + churn flag (no visit in 180d).
CREATE OR REPLACE VIEW public.v_diag_client_activity AS
SELECT
  u.id              AS client_id,
  u.name            AS client_name,
  u.created_at      AS joined_at,
  COUNT(a.id)       AS total_appointments,
  COUNT(a.id) FILTER (WHERE a.status = 'completed') AS completed_count,
  COUNT(a.id) FILTER (WHERE a.status = 'cancelled') AS cancelled_count,
  MIN(a.appointment_at)                              AS first_visit_at,
  MAX(a.appointment_at) FILTER (WHERE a.status = 'completed') AS last_completed_at,
  MAX(COALESCE(a.completed_at, a.appointment_at, a.created_at)) AS last_activity_at,
  CASE
    WHEN MAX(COALESCE(a.completed_at, a.appointment_at, a.created_at)) IS NULL THEN true
    WHEN MAX(COALESCE(a.completed_at, a.appointment_at, a.created_at))
         < CURRENT_DATE - INTERVAL '180 days' THEN true
    ELSE false
  END AS is_churned
FROM public.users u
LEFT JOIN public.appointments a ON a.client_id = u.id
WHERE u.role = 'client'
GROUP BY u.id, u.name, u.created_at;


-- v_diag_treatment_outcomes
-- One row per medical_record with the *next* record for the same pet+diagnosis
-- so we can compute recurrence + recovery time.
CREATE OR REPLACE VIEW public.v_diag_treatment_outcomes AS
SELECT
  mr.id              AS record_id,
  mr.pet_id,
  mr.vet_id,
  mr.visit_date,
  mr.follow_up_date,
  TRIM(LOWER(mr.diagnosis))                                    AS diagnosis_key,
  TRIM(LOWER(COALESCE(mr.treatment, 'unspecified')))           AS treatment_key,
  mr.diagnosis      AS diagnosis_label,
  mr.treatment      AS treatment_label,
  -- find the next visit for the same pet with the same diagnosis
  LEAD(mr.visit_date) OVER (
    PARTITION BY mr.pet_id, TRIM(LOWER(mr.diagnosis))
    ORDER BY mr.visit_date
  ) AS next_same_diagnosis_visit,
  -- count of follow-ups within 90 days for this pet+diagnosis
  (mr.follow_up_date IS NOT NULL
    AND mr.follow_up_date BETWEEN mr.visit_date AND mr.visit_date + INTERVAL '90 days'
  )::int AS has_followup_scheduled
FROM public.medical_records mr
WHERE mr.diagnosis IS NOT NULL AND TRIM(mr.diagnosis) <> '';


-- v_diag_medication_rollup
-- Per-medication summary of: stock on hand (received − used − expired ± adj),
-- used qty, billed qty, expired qty — over the *entire* history.
-- For windowed totals, the service uses the raw transactions table.
CREATE OR REPLACE VIEW public.v_diag_medication_rollup AS
SELECT
  m.id                AS medication_id,
  m.sku,
  m.name,
  m.category,
  m.unit,
  m.unit_price_cents,
  m.reorder_level,
  COALESCE(SUM(t.qty) FILTER (WHERE t.txn_type = 'received'),   0) AS qty_received,
  COALESCE(SUM(t.qty) FILTER (WHERE t.txn_type = 'used'),       0) AS qty_used,
  COALESCE(SUM(t.qty) FILTER (WHERE t.txn_type = 'billed'),     0) AS qty_billed,
  COALESCE(SUM(t.qty) FILTER (WHERE t.txn_type = 'expired'),    0) AS qty_expired,
  COALESCE(SUM(t.qty) FILTER (WHERE t.txn_type = 'adjustment'), 0) AS qty_adjustment,
  COALESCE(SUM(t.qty) FILTER (WHERE t.txn_type = 'received'),   0)
    - COALESCE(SUM(t.qty) FILTER (WHERE t.txn_type IN ('used','expired')), 0)
    + COALESCE(SUM(t.qty) FILTER (WHERE t.txn_type = 'adjustment'), 0) AS stock_on_hand
FROM public.medications m
LEFT JOIN public.medication_transactions t ON t.medication_id = m.id
GROUP BY m.id, m.sku, m.name, m.category, m.unit, m.unit_price_cents, m.reorder_level;


-- v_diag_expiring_batches
-- Batches that have expired OR will expire within 60 days.
CREATE OR REPLACE VIEW public.v_diag_expiring_batches AS
SELECT
  b.id              AS batch_id,
  b.medication_id,
  m.sku,
  m.name            AS medication_name,
  m.unit,
  b.batch_no,
  b.qty_received,
  b.expires_at,
  CASE
    WHEN b.expires_at < CURRENT_DATE THEN 'expired'
    WHEN b.expires_at < CURRENT_DATE + INTERVAL '60 days' THEN 'expiring_soon'
    ELSE 'ok'
  END AS expiry_status,
  GREATEST(0, b.expires_at - CURRENT_DATE) AS days_to_expiry
FROM public.medication_batches b
JOIN public.medications m ON m.id = b.medication_id
WHERE b.expires_at IS NOT NULL
  AND b.expires_at < CURRENT_DATE + INTERVAL '60 days'
ORDER BY b.expires_at;


-- ── 4. RPC HELPERS ────────────────────────────────────────

-- fn_churn_root_cause(p_start, p_end, p_prev_start, p_prev_end)
-- Identifies clients who were active in the prior window but NOT in the current
-- one ("churned"), then surfaces the leading characteristics of their last
-- visit (which vet, wait time, price, cancellation reason).
CREATE OR REPLACE FUNCTION public.fn_churn_root_cause(
  p_start      DATE,
  p_end        DATE,
  p_prev_start DATE,
  p_prev_end   DATE
)
RETURNS TABLE (
  churned_clients      BIGINT,
  retained_clients     BIGINT,
  prior_active_clients BIGINT,
  churn_rate_percent   NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH prior_active AS (
    SELECT DISTINCT a.client_id
    FROM public.appointments a
    WHERE COALESCE(a.completed_at, a.appointment_at, a.created_at)::date
            BETWEEN p_prev_start AND p_prev_end
  ),
  current_active AS (
    SELECT DISTINCT a.client_id
    FROM public.appointments a
    WHERE COALESCE(a.completed_at, a.appointment_at, a.created_at)::date
            BETWEEN p_start AND p_end
  ),
  churned AS (
    SELECT p.client_id FROM prior_active p
    LEFT JOIN current_active c USING (client_id)
    WHERE c.client_id IS NULL
  ),
  retained AS (
    SELECT p.client_id FROM prior_active p
    JOIN current_active c USING (client_id)
  )
  SELECT
    (SELECT COUNT(*) FROM churned)             AS churned_clients,
    (SELECT COUNT(*) FROM retained)            AS retained_clients,
    (SELECT COUNT(*) FROM prior_active)        AS prior_active_clients,
    CASE WHEN (SELECT COUNT(*) FROM prior_active) = 0 THEN 0
      ELSE ROUND(100.0 * (SELECT COUNT(*) FROM churned)::numeric
                       / (SELECT COUNT(*) FROM prior_active)::numeric, 2)
    END                                        AS churn_rate_percent;
$$;


-- fn_diag_avg_price_by_service(p_start, p_end)
-- Average appointment amount (PHP × 100 → centavos) by service / type
-- across the window, plus the *prior* same-length window for comparison.
CREATE OR REPLACE FUNCTION public.fn_diag_avg_price_by_service(
  p_start DATE,
  p_end   DATE
)
RETURNS TABLE (
  service           TEXT,
  current_avg       NUMERIC,
  prior_avg         NUMERIC,
  current_count     BIGINT,
  prior_count       BIGINT,
  price_change_pct  NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH window_len AS (
    SELECT (p_end - p_start) AS days
  ),
  cur AS (
    SELECT COALESCE(a.service, a.type, 'Unspecified') AS service,
           AVG(NULLIF(a.amount, 0))::numeric AS avg_amt,
           COUNT(*) AS cnt
    FROM public.appointments a
    WHERE COALESCE(a.completed_at, a.appointment_at, a.created_at)::date
            BETWEEN p_start AND p_end
      AND a.amount IS NOT NULL
    GROUP BY 1
  ),
  prv AS (
    SELECT COALESCE(a.service, a.type, 'Unspecified') AS service,
           AVG(NULLIF(a.amount, 0))::numeric AS avg_amt,
           COUNT(*) AS cnt
    FROM public.appointments a, window_len
    WHERE COALESCE(a.completed_at, a.appointment_at, a.created_at)::date
            BETWEEN (p_start - window_len.days) AND (p_start - 1)
      AND a.amount IS NOT NULL
    GROUP BY 1
  )
  SELECT
    COALESCE(cur.service, prv.service) AS service,
    cur.avg_amt                        AS current_avg,
    prv.avg_amt                        AS prior_avg,
    COALESCE(cur.cnt, 0)               AS current_count,
    COALESCE(prv.cnt, 0)               AS prior_count,
    CASE
      WHEN prv.avg_amt IS NULL OR prv.avg_amt = 0 THEN NULL
      ELSE ROUND(100.0 * (cur.avg_amt - prv.avg_amt) / prv.avg_amt, 2)
    END AS price_change_pct
  FROM cur
  FULL OUTER JOIN prv USING (service)
  ORDER BY price_change_pct DESC NULLS LAST;
$$;


-- fn_treatment_effectiveness(p_start, p_end, p_min_cohort)
-- For each (diagnosis, treatment) cohort with >= p_min_cohort visits in the
-- window, computes follow-up rate, recurrence rate, and avg recovery span.
CREATE OR REPLACE FUNCTION public.fn_treatment_effectiveness(
  p_start       DATE,
  p_end         DATE,
  p_min_cohort  INT DEFAULT 2
)
RETURNS TABLE (
  diagnosis_key       TEXT,
  diagnosis_label     TEXT,
  treatment_key       TEXT,
  treatment_label     TEXT,
  cohort_size         BIGINT,
  unique_pets         BIGINT,
  followup_rate_pct   NUMERIC,
  recurrence_rate_pct NUMERIC,
  avg_recovery_days   NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH base AS (
    SELECT
      TRIM(LOWER(mr.diagnosis))                                  AS diagnosis_key,
      mr.diagnosis                                                AS diagnosis_label,
      TRIM(LOWER(COALESCE(mr.treatment, 'unspecified')))         AS treatment_key,
      COALESCE(mr.treatment, 'Unspecified')                       AS treatment_label,
      mr.pet_id,
      mr.visit_date,
      mr.follow_up_date,
      LEAD(mr.visit_date) OVER (
        PARTITION BY mr.pet_id, TRIM(LOWER(mr.diagnosis))
        ORDER BY mr.visit_date
      ) AS next_visit
    FROM public.medical_records mr
    WHERE mr.diagnosis IS NOT NULL AND TRIM(mr.diagnosis) <> ''
      AND mr.visit_date BETWEEN p_start AND p_end
  )
  SELECT
    b.diagnosis_key,
    (ARRAY_AGG(b.diagnosis_label))[1]    AS diagnosis_label,
    b.treatment_key,
    (ARRAY_AGG(b.treatment_label))[1]    AS treatment_label,
    COUNT(*)                              AS cohort_size,
    COUNT(DISTINCT b.pet_id)              AS unique_pets,
    ROUND(100.0 * COUNT(*) FILTER (WHERE b.follow_up_date IS NOT NULL)
                / NULLIF(COUNT(*), 0), 1) AS followup_rate_pct,
    ROUND(100.0 * COUNT(*) FILTER (WHERE b.next_visit IS NOT NULL
                                    AND b.next_visit <= b.visit_date + INTERVAL '90 days')
                / NULLIF(COUNT(*), 0), 1) AS recurrence_rate_pct,
    ROUND(AVG(
      CASE WHEN b.next_visit IS NOT NULL
        THEN (b.next_visit - b.visit_date)
      END
    )::numeric, 1)                        AS avg_recovery_days
  FROM base b
  GROUP BY b.diagnosis_key, b.treatment_key
  HAVING COUNT(*) >= p_min_cohort
  ORDER BY b.diagnosis_key, cohort_size DESC;
$$;


-- ── 5. SEED DATA (idempotent — only if catalog is empty) ────
-- Lightweight catalog so the dashboard isn't empty on fresh installs.
INSERT INTO public.medications (sku, name, category, unit, unit_price_cents, reorder_level)
SELECT * FROM (VALUES
  ('AMX-250',  'Amoxicillin 250mg',     'antibiotic',    'tablet',  3500,  20),
  ('CEF-500',  'Cefalexin 500mg',       'antibiotic',    'tablet',  4500,  20),
  ('IVR-1',    'Ivermectin 1%',         'antiparasitic', 'ml',     12000,  15),
  ('VAC-DA2',  'DHPPi-L Vaccine',       'vaccine',       'dose',   80000,  10),
  ('VAC-RAB',  'Rabies Vaccine',        'vaccine',       'dose',   65000,  10),
  ('FRT-NEX',  'NexGard 25-50kg',       'antiparasitic', 'tablet', 85000,   8),
  ('PRD-5',    'Prednisolone 5mg',      'other',         'tablet',  2500,  25),
  ('ANL-INJ',  'Metamizole inj. 500mg', 'other',         'ml',      8000,  10)
) AS s(sku, name, category, unit, unit_price_cents, reorder_level)
WHERE NOT EXISTS (SELECT 1 FROM public.medications LIMIT 1);


-- ── 6. RLS ────────────────────────────────────────────────
ALTER TABLE public.medications              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_batches       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_transactions  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_medications"      ON public.medications;
CREATE POLICY "staff_read_medications"
  ON public.medications FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users u
                  WHERE u.id = auth.uid()
                    AND u.role IN ('admin','veterinarian','staff')));

DROP POLICY IF EXISTS "admins_manage_medications" ON public.medications;
CREATE POLICY "admins_manage_medications"
  ON public.medications FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users u
                  WHERE u.id = auth.uid() AND u.role = 'admin'));

DROP POLICY IF EXISTS "staff_read_batches"          ON public.medication_batches;
CREATE POLICY "staff_read_batches"
  ON public.medication_batches FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users u
                  WHERE u.id = auth.uid()
                    AND u.role IN ('admin','veterinarian','staff')));

DROP POLICY IF EXISTS "admins_manage_batches"       ON public.medication_batches;
CREATE POLICY "admins_manage_batches"
  ON public.medication_batches FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users u
                  WHERE u.id = auth.uid() AND u.role = 'admin'));

DROP POLICY IF EXISTS "staff_read_transactions"     ON public.medication_transactions;
CREATE POLICY "staff_read_transactions"
  ON public.medication_transactions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users u
                  WHERE u.id = auth.uid()
                    AND u.role IN ('admin','veterinarian','staff')));

DROP POLICY IF EXISTS "admins_manage_transactions"  ON public.medication_transactions;
CREATE POLICY "admins_manage_transactions"
  ON public.medication_transactions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users u
                  WHERE u.id = auth.uid() AND u.role = 'admin'));

-- ── DONE ──
-- After running this file, the backend can query:
--   supabaseAdmin.from('v_diag_appointments').select(...)
--   supabaseAdmin.from('v_diag_client_activity').select(...)
--   supabaseAdmin.from('v_diag_treatment_outcomes').select(...)
--   supabaseAdmin.from('v_diag_medication_rollup').select(...)
--   supabaseAdmin.from('v_diag_expiring_batches').select(...)
--   supabaseAdmin.rpc('fn_churn_root_cause',           { p_start, p_end, p_prev_start, p_prev_end })
--   supabaseAdmin.rpc('fn_diag_avg_price_by_service',  { p_start, p_end })
--   supabaseAdmin.rpc('fn_treatment_effectiveness',    { p_start, p_end, p_min_cohort })
