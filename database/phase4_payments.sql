-- ============================================================
-- VETLINK Phase 4 — Payments
-- Run in Supabase SQL Editor
-- ============================================================

-- Add payment fields to appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS amount         INTEGER,                 -- centavos (PHP × 100)
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS service        TEXT;                    -- canonical service key (alias of `type`)

CREATE INDEX IF NOT EXISTS idx_appointments_payment_status ON public.appointments(payment_status);

-- ── Payments table ──
CREATE TABLE IF NOT EXISTS public.payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id  UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id),
  transaction_id  TEXT UNIQUE,                                     -- PayMongo checkout session ID (cs_xxx)
  payment_method  TEXT,                                            -- card / gcash / paymaya / grab_pay
  amount          INTEGER NOT NULL,                                -- centavos
  currency        TEXT NOT NULL DEFAULT 'PHP',
  status          TEXT NOT NULL DEFAULT 'pending',                 -- pending / paid / failed / refunded
  raw_event       JSONB,                                           -- last webhook payload (for debugging)
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS payments_updated_at ON public.payments;
CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_payments_appointment_id ON public.payments(appointment_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id        ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status         ON public.payments(status);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_payments" ON public.payments;
CREATE POLICY "users_read_own_payments"
  ON public.payments FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admins_read_all_payments" ON public.payments;
CREATE POLICY "admins_read_all_payments"
  ON public.payments FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','staff')));
-- Note: backend writes via service-role key (bypasses RLS).
