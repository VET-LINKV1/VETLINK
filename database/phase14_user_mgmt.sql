-- ============================================================
-- Phase 14 — User Management (admin)
-- Adds: admin_audit_log + indexes + RLS for read/write
-- Idempotent. Safe to re-run.
-- ============================================================

-- Extensions used elsewhere; ensure they exist.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- ENUM: action_kind  (what an admin did)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_action_kind') THEN
    CREATE TYPE admin_action_kind AS ENUM (
      'create_user',
      'update_user',
      'change_role',
      'suspend',
      'reactivate',
      'delete_user',
      'reset_password',
      'send_invite',
      'verify_user',
      'bulk_import'
    );
  END IF;
END$$;

-- ------------------------------------------------------------
-- TABLE: admin_audit_log
-- Each admin action is recorded here with target user + diff.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  target_id     UUID          REFERENCES public.users(id) ON DELETE SET NULL,
  action        admin_action_kind NOT NULL,
  summary       TEXT,
  before_json   JSONB,
  after_json    JSONB,
  meta          JSONB,
  ip            TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor   ON public.admin_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_target  ON public.admin_audit_log(target_id);
CREATE INDEX IF NOT EXISTS idx_audit_action  ON public.admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.admin_audit_log(created_at DESC);

-- ------------------------------------------------------------
-- Useful indexes on users for search/filter
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_role      ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_active    ON public.users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_email_lc  ON public.users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_name_lc   ON public.users(LOWER(name));

-- ------------------------------------------------------------
-- Helper: is current auth user an admin?
-- (Re-create to make sure it exists; harmless if already there.)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin(uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = uid AND u.role = 'admin'
  );
$$;

-- ------------------------------------------------------------
-- RLS on admin_audit_log: only admins can read; inserts via
-- service role (backend) bypass RLS anyway.
-- ------------------------------------------------------------
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_audit" ON public.admin_audit_log;
CREATE POLICY "admin_read_audit"
  ON public.admin_audit_log FOR SELECT
  USING (public.is_admin(auth.uid()));

-- (No insert/update/delete policy: backend writes with service role.)

-- ------------------------------------------------------------
-- Convenience view: most recent audit row per target user
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_user_last_action AS
SELECT DISTINCT ON (target_id)
  target_id,
  action,
  summary,
  actor_id,
  created_at
FROM public.admin_audit_log
WHERE target_id IS NOT NULL
ORDER BY target_id, created_at DESC;

GRANT SELECT ON public.v_user_last_action TO authenticated;

-- ------------------------------------------------------------
-- Function: log an admin action (used by backend via RPC OR direct insert)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_actor   UUID,
  p_target  UUID,
  p_action  admin_action_kind,
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
    actor_id, target_id, action, summary, before_json, after_json, meta
  )
  VALUES (p_actor, p_target, p_action, p_summary, p_before, p_after, p_meta)
  RETURNING id INTO v_id;
  RETURN v_id;
END$$;

-- Reload PostgREST schema cache:
-- NOTIFY pgrst, 'reload schema';
