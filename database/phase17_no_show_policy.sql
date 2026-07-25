-- ============================================================
-- VETLINK Phase 17: No-Show Policy & Auto-Cancellation
-- Run in Supabase SQL Editor AFTER all previous phases.
--
-- Adds:
--   * 'no_show' to the appointment_status enum
--   * no_show_policy config table (grace period, etc.)
--   * auto_cancel_no_shows() function (runs via cron or API)
--   * client_no_show_summary view
-- ============================================================

-- ── Add new status values to the enum (safe to re-run) ─────
DO $$ BEGIN
  ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'no_show';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN invalid_text_representation THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'declined';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN invalid_text_representation THEN NULL; END $$;

-- ── No-show policy configuration ────────────────────────────
CREATE TABLE IF NOT EXISTS public.no_show_policy (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grace_period_mins    INT NOT NULL DEFAULT 30,
  notify_client        BOOLEAN NOT NULL DEFAULT true,
  notify_vet           BOOLEAN NOT NULL DEFAULT true,
  auto_cancel_after_mins INT NOT NULL DEFAULT 30,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS no_show_policy_updated_at ON public.no_show_policy;
CREATE TRIGGER no_show_policy_updated_at
  BEFORE UPDATE ON public.no_show_policy
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed default policy (only if table is empty)
INSERT INTO public.no_show_policy (grace_period_mins, auto_cancel_after_mins)
SELECT 30, 30
WHERE NOT EXISTS (SELECT 1 FROM public.no_show_policy LIMIT 1);

-- ── SQL function: auto-cancel no-shows ──────────────────────
-- Uses status::text casts so it works even if the enum hasn't
-- been updated yet (returns 0 rows instead of crashing).
CREATE OR REPLACE FUNCTION public.auto_cancel_no_shows(p_grace_mins INT DEFAULT 30)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  updated_count INT;
  cutoff TIMESTAMPTZ;
BEGIN
  cutoff := NOW() - (p_grace_mins || ' minutes')::interval;

  UPDATE public.appointments
     SET status            = 'no_show'::appointment_status,
         status_updated_at = NOW(),
         status_history    = COALESCE(status_history, '[]'::jsonb)
           || jsonb_build_object(
               'from', status::text,
               'to',   'no_show',
               'at',   NOW()::text,
               'by',   NULL,
               'byRole', 'system',
               'reason', 'Auto no-show: appointment time + ' || p_grace_mins || 'min grace period elapsed'
             )
   WHERE status::text IN ('pending', 'confirmed')
     AND appointment_at IS NOT NULL
     AND appointment_at < cutoff;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- ── View: client no-show summary ────────────────────────────
-- Casts status to text so the view can be created even if the
-- 'no_show' enum value was just added in this transaction.
CREATE OR REPLACE VIEW public.client_no_show_summary AS
SELECT
  a.client_id,
  u.name AS client_name,
  COUNT(*) FILTER (WHERE a.status::text = 'no_show') AS no_show_count,
  COUNT(*) FILTER (WHERE a.status::text = 'cancelled') AS cancelled_count,
  COUNT(*) AS total_appointments
FROM public.appointments a
JOIN public.users u ON u.id = a.client_id
GROUP BY a.client_id, u.name;

-- ── Index for the auto-cancel query ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_appt_noshow_lookup
  ON public.appointments(status, appointment_at)
  WHERE status IN ('pending', 'confirmed');

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.no_show_policy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nsp_staff_all" ON public.no_show_policy;
CREATE POLICY "nsp_staff_all"
  ON public.no_show_policy FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','staff'))
  );
