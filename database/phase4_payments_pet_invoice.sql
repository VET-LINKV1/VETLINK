-- ============================================================
-- VETLINK Phase 4 — Payments: Pet Association + Invoices
-- Run in Supabase SQL Editor AFTER phase4_payments.sql
-- ============================================================

-- Add pet_id to payments for direct pet association
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS pet_id UUID REFERENCES public.pets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_pet_id ON public.payments(pet_id);

-- ── Invoices table ──
CREATE TABLE IF NOT EXISTS public.invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id      UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  appointment_id  UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id),
  pet_id          UUID NOT NULL REFERENCES public.pets(id),
  invoice_number  TEXT NOT NULL UNIQUE,
  amount          INTEGER NOT NULL,                -- centavos
  currency        TEXT NOT NULL DEFAULT 'PHP',
  status          TEXT NOT NULL DEFAULT 'issued',  -- issued / paid / voided
  items           JSONB NOT NULL DEFAULT '[]',     -- line items for the invoice
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at         TIMESTAMPTZ,
  voided_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS invoices_updated_at ON public.invoices;
CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_invoices_payment_id ON public.invoices(payment_id);
CREATE INDEX IF NOT EXISTS idx_invoices_appointment_id ON public.invoices(appointment_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_pet_id ON public.invoices(pet_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_invoices" ON public.invoices;
CREATE POLICY "users_read_own_invoices"
  ON public.invoices FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admins_read_all_invoices" ON public.invoices;
CREATE POLICY "admins_read_all_invoices"
  ON public.invoices FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','staff')));

-- Helper: generate a friendly invoice number (INV-YYYYMMDD-XXXX)
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  prefix TEXT := 'INV-' || to_char(NOW(), 'YYYYMMDD') || '-';
  seq INTEGER;
  candidate TEXT;
  tries INTEGER := 0;
BEGIN
  LOOP
    EXIT WHEN tries >= 10;
    tries := tries + 1;
    SELECT COUNT(*) + 1 INTO seq
    FROM public.invoices
    WHERE invoice_number LIKE prefix || '%';
    candidate := prefix || LPAD(seq::TEXT, 4, '0');
    IF NOT EXISTS (SELECT 1 FROM public.invoices WHERE invoice_number = candidate) THEN
      RETURN candidate;
    END IF;
    -- extremely rare race, try again
    PERFORM pg_sleep(0.01);
  END LOOP;
  RETURN prefix || LPAD(floor(random() * 9000 + 1000)::INT, 4, '0');
END;
$$ LANGUAGE plpgsql VOLATILE;