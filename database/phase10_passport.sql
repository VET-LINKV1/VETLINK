-- ============================================================
-- VETLINK Phase 10: Multi-Pet Digital Health Passport
-- Run in Supabase SQL Editor AFTER phase9_emr.sql
--
-- Adds:
--   * pet_weights        — historical weight points per pet
--   * passport_shares    — tokenized share links for emailing
--                          a pet's health passport to an
--                          outside vet/owner/recipient
--   * passport_vaccination_status_v — derived view that
--                          classifies each vaccination as
--                          'protected' / 'expiring_soon' /
--                          'overdue' / 'cancelled'
--   * passport_summary_v — one row per pet rolling up the
--                          worst-case vaccination status,
--                          latest weight, file/visit counts
--
-- Relies on tables created by earlier phases:
--   pets, users, vaccinations, medical_records, emr_files
-- ============================================================

-- ── ENUMS ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE share_status AS ENUM ('active', 'revoked', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- "Expiring soon" lookahead window (days). Stored as a config row
-- in case a clinic wants to widen/shorten it without code changes.
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.passport_config (
    id              TEXT PRIMARY KEY DEFAULT 'default',
    expiring_window_days INT NOT NULL DEFAULT 30,
    share_ttl_days  INT NOT NULL DEFAULT 30,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  INSERT INTO public.passport_config (id) VALUES ('default')
    ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN duplicate_table THEN NULL; END $$;


-- ============================================================
-- TABLE: pet_weights
-- Append-only log of weight measurements per pet.
-- Used to draw the growth/weight chart and detect obesity trends.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pet_weights (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id       UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  recorded_by  UUID REFERENCES public.users(id),
  weight_kg    NUMERIC(6,2) NOT NULL CHECK (weight_kg > 0 AND weight_kg < 500),
  body_condition_score INT CHECK (body_condition_score BETWEEN 1 AND 9), -- 9-point BCS scale
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pet_weights_pet  ON public.pet_weights(pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_weights_date ON public.pet_weights(recorded_at DESC);


-- ============================================================
-- TABLE: passport_shares
-- A shareable, tokenized view of a pet's passport. Created when
-- a vet/owner clicks "Email passport"; the recipient receives a
-- link of the form /passport/share/<token> which renders the
-- passport without requiring login.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.passport_shares (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id          UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL REFERENCES public.users(id),
  recipient_email TEXT NOT NULL,
  message         TEXT,
  token           UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
  status          share_status NOT NULL DEFAULT 'active',
  view_count      INT NOT NULL DEFAULT 0,
  last_viewed_at  TIMESTAMPTZ,
  emailed_at      TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_passport_shares_pet    ON public.passport_shares(pet_id);
CREATE INDEX IF NOT EXISTS idx_passport_shares_token  ON public.passport_shares(token);
CREATE INDEX IF NOT EXISTS idx_passport_shares_status ON public.passport_shares(status);


-- ============================================================
-- VIEW: passport_vaccination_status_v
-- Classifies every vaccination row into a passport status used
-- by the Vaccination Timeline UI:
--
--   protected      — administered AND (no due_date OR due_date is
--                    further away than the expiring_window)
--   expiring_soon  — administered AND due_date within window
--   overdue        — scheduled or overdue (due_date is in the past)
--   cancelled      — explicitly cancelled by staff
--   scheduled      — scheduled, due_date still in the future
-- ============================================================
CREATE OR REPLACE VIEW public.passport_vaccination_status_v AS
WITH cfg AS (
  SELECT COALESCE(MAX(expiring_window_days), 30) AS w FROM public.passport_config
)
SELECT
  v.id,
  v.pet_id,
  v.vaccine_name,
  v.manufacturer,
  v.batch_number,
  v.dose,
  v.administered_date,
  v.due_date,
  v.status                       AS raw_status,
  CASE
    WHEN v.status = 'cancelled'                                              THEN 'cancelled'
    WHEN v.status = 'overdue'                                                THEN 'overdue'
    WHEN v.due_date IS NOT NULL AND v.due_date < CURRENT_DATE                THEN 'overdue'
    WHEN v.administered_date IS NOT NULL
      AND (v.due_date IS NULL OR v.due_date >= CURRENT_DATE + (SELECT w FROM cfg))
                                                                             THEN 'protected'
    WHEN v.administered_date IS NOT NULL
      AND v.due_date IS NOT NULL
      AND v.due_date >= CURRENT_DATE
      AND v.due_date <  CURRENT_DATE + (SELECT w FROM cfg)                   THEN 'expiring_soon'
    WHEN v.due_date IS NOT NULL AND v.due_date >= CURRENT_DATE               THEN 'scheduled'
    ELSE 'scheduled'
  END                            AS passport_status,
  CASE
    WHEN v.due_date IS NULL THEN NULL
    ELSE (v.due_date - CURRENT_DATE)
  END                            AS days_until_due,
  v.created_at,
  v.updated_at
FROM public.vaccinations v;


-- ============================================================
-- VIEW: passport_summary_v
-- One row per pet, used by the multi-pet dashboard. Surfaces:
--   * the worst-case vaccination status across all vaccines
--   * latest recorded weight + body_condition_score
--   * a few helpful counts
-- ============================================================
CREATE OR REPLACE VIEW public.passport_summary_v AS
WITH worst AS (
  SELECT
    pet_id,
    CASE
      WHEN BOOL_OR(passport_status = 'overdue')        THEN 'overdue'
      WHEN BOOL_OR(passport_status = 'expiring_soon')  THEN 'expiring_soon'
      WHEN BOOL_OR(passport_status = 'protected')      THEN 'protected'
      WHEN BOOL_OR(passport_status = 'scheduled')      THEN 'scheduled'
      ELSE 'none'
    END AS overall_vax_status,
    COUNT(*) FILTER (WHERE passport_status = 'protected')     AS vax_protected,
    COUNT(*) FILTER (WHERE passport_status = 'expiring_soon') AS vax_expiring,
    COUNT(*) FILTER (WHERE passport_status = 'overdue')       AS vax_overdue
  FROM public.passport_vaccination_status_v
  GROUP BY pet_id
),
latest_w AS (
  SELECT DISTINCT ON (pet_id)
    pet_id, weight_kg, body_condition_score, recorded_at
  FROM public.pet_weights
  ORDER BY pet_id, recorded_at DESC
)
SELECT
  p.id            AS pet_id,
  p.owner_id,
  p.name,
  p.species,
  p.breed,
  p.age,
  p.gender,
  p.color,
  COALESCE(lw.weight_kg, p.weight_kg)        AS current_weight_kg,
  lw.body_condition_score                    AS current_bcs,
  lw.recorded_at                             AS weight_last_at,
  COALESCE(w.overall_vax_status, 'none')     AS overall_vax_status,
  COALESCE(w.vax_protected, 0)               AS vax_protected,
  COALESCE(w.vax_expiring, 0)                AS vax_expiring,
  COALESCE(w.vax_overdue, 0)                 AS vax_overdue,
  (SELECT COUNT(*) FROM public.medical_records m WHERE m.pet_id = p.id) AS visits_total,
  (SELECT COUNT(*) FROM public.emr_files f      WHERE f.pet_id = p.id AND f.is_archived = false) AS files_total
FROM public.pets p
LEFT JOIN worst    w  ON w.pet_id  = p.id
LEFT JOIN latest_w lw ON lw.pet_id = p.id;


-- ============================================================
-- HELPER FUNCTION: token-gated passport read
-- Returns the full passport payload for a given share token, or
-- NULL if the token is expired/revoked. Used by the public
-- /api/passport/shared/:token route.
-- ============================================================
CREATE OR REPLACE FUNCTION public.passport_for_token(p_token UUID)
RETURNS TABLE (
  pet_id            UUID,
  pet_name          TEXT,
  species           TEXT,
  breed             TEXT,
  age               INT,
  gender            TEXT,
  current_weight_kg NUMERIC,
  current_bcs       INT,
  overall_vax_status TEXT,
  share_id          UUID,
  share_expires_at  TIMESTAMPTZ
) LANGUAGE plpgsql STABLE AS $$
DECLARE
  s public.passport_shares%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.passport_shares WHERE token = p_token;
  IF s IS NULL OR s.status <> 'active' OR s.expires_at <= NOW() THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT
      ps.pet_id, ps.name, ps.species, ps.breed, ps.age, ps.gender,
      ps.current_weight_kg, ps.current_bcs,
      ps.overall_vax_status,
      s.id, s.expires_at
    FROM public.passport_summary_v ps
    WHERE ps.pet_id = s.pet_id;
END;
$$;


-- ============================================================
-- ROW LEVEL SECURITY
-- The Express API uses the service role so RLS is bypassed in
-- practice, but we enable it so anon-key reads can't leak data
-- if anyone ever points the React app at Supabase directly.
-- ============================================================
ALTER TABLE public.pet_weights      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_shares  ENABLE ROW LEVEL SECURITY;

-- Reuse is_staff() / owns_pet() helpers from phase9 if present;
-- otherwise create no-op duplicates so this file is idempotent.
CREATE OR REPLACE FUNCTION public.is_staff(uid UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = uid AND u.role IN ('admin','veterinarian','staff')
  );
$$;
CREATE OR REPLACE FUNCTION public.owns_pet(uid UUID, pet UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pets p WHERE p.id = pet AND p.owner_id = uid
  );
$$;

-- ── pet_weights policies ──────────────────────────────────────
DROP POLICY IF EXISTS "weights_staff_all"   ON public.pet_weights;
DROP POLICY IF EXISTS "weights_client_read" ON public.pet_weights;

CREATE POLICY "weights_staff_all"
  ON public.pet_weights FOR ALL
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "weights_client_read"
  ON public.pet_weights FOR SELECT
  USING (public.owns_pet(auth.uid(), pet_id));

-- ── passport_shares policies ──────────────────────────────────
DROP POLICY IF EXISTS "shares_staff_all"  ON public.passport_shares;
DROP POLICY IF EXISTS "shares_owner_read" ON public.passport_shares;

CREATE POLICY "shares_staff_all"
  ON public.passport_shares FOR ALL
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "shares_owner_read"
  ON public.passport_shares FOR SELECT
  USING (public.owns_pet(auth.uid(), pet_id));
