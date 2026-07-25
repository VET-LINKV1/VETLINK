-- ============================================================
-- VETLINK Phase 12: Integrated Post-Care & Pharmacy Hub
-- Run in Supabase SQL Editor AFTER phase9_emr.sql
-- (prescriptions, emr_files, appointments must already exist)
--
-- Adds:
--   * discharge_instructions     — post-treatment care guide per appointment
--   * discharge_files            — many-to-many between discharges & emr_files
--   * refill_requests            — client-initiated refill workflow
--   * medication_reminders       — per-prescription dose schedule
--   * reminder_dispatch_log      — audit log of every reminder sent
--   * v_due_reminders            — reminders eligible to fire right now
-- ============================================================

-- ── ENUMS ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE refill_status AS ENUM (
    'pending', 'approved', 'denied', 'dispensed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE reminder_channel AS ENUM ('in_app', 'sms', 'email');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dispatch_status AS ENUM ('sent', 'failed', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- TABLE: discharge_instructions
-- One discharge per appointment. Vet writes it, client reads it.
-- "body" is rich text (markdown-ish). "steps" / "feeding" /
-- "videos" are structured so the UI can render them as cards.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.discharge_instructions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id  UUID NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  pet_id          UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  vet_id          UUID NOT NULL REFERENCES public.users(id),
  title           TEXT NOT NULL DEFAULT 'Discharge Instructions',
  body            TEXT,                            -- free-form notes
  -- Structured care plan (each is JSON so the UI can render rich cards)
  steps           JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{ title, detail, when }]
  feeding         JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{ food, amount, frequency, notes }]
  videos          JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{ title, url, kind }]
  follow_up_date  DATE,
  is_published    BOOLEAN NOT NULL DEFAULT false,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS discharge_instructions_updated_at ON public.discharge_instructions;
CREATE TRIGGER discharge_instructions_updated_at
  BEFORE UPDATE ON public.discharge_instructions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_discharge_appt ON public.discharge_instructions(appointment_id);
CREATE INDEX IF NOT EXISTS idx_discharge_pet  ON public.discharge_instructions(pet_id);


-- ============================================================
-- TABLE: discharge_files
-- Join table — reuses the emr-files bucket so we don't duplicate
-- storage logic. A discharge may have N attached files (X-rays,
-- printable handouts, etc.).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.discharge_files (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  discharge_id UUID NOT NULL REFERENCES public.discharge_instructions(id) ON DELETE CASCADE,
  file_id      UUID NOT NULL REFERENCES public.emr_files(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (discharge_id, file_id)
);

CREATE INDEX IF NOT EXISTS idx_discharge_files_discharge ON public.discharge_files(discharge_id);


-- ============================================================
-- TABLE: refill_requests
-- Client clicks "Request refill" on an active prescription.
-- Pending → clinic dashboard → vet/admin/staff approve/deny.
-- Approval increments prescriptions.refills_used (handled in app code).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.refill_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prescription_id UUID NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  pet_id          UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  requested_by    UUID NOT NULL REFERENCES public.users(id),
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status          refill_status NOT NULL DEFAULT 'pending',
  notes           TEXT,
  processed_by    UUID REFERENCES public.users(id),
  processed_at    TIMESTAMPTZ,
  denial_reason   TEXT,
  pickup_ready_at TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS refill_requests_updated_at ON public.refill_requests;
CREATE TRIGGER refill_requests_updated_at
  BEFORE UPDATE ON public.refill_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_refill_rx     ON public.refill_requests(prescription_id);
CREATE INDEX IF NOT EXISTS idx_refill_status ON public.refill_requests(status);
CREATE INDEX IF NOT EXISTS idx_refill_pet    ON public.refill_requests(pet_id);


-- ============================================================
-- TABLE: medication_reminders
-- Per-prescription schedule of when the owner should administer
-- a dose. times_of_day is an array of TIMEs (e.g. {08:00,20:00}).
-- next_fire_at is pre-computed for fast tick-scanning.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.medication_reminders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prescription_id UUID NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  pet_id          UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  owner_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  times_of_day    TIME[] NOT NULL,                      -- {08:00, 14:00, 20:00}
  food_instruction TEXT,                                -- e.g. "give with food"
  message_override TEXT,                                -- custom message (else auto)
  channels        reminder_channel[] NOT NULL DEFAULT ARRAY['in_app']::reminder_channel[],
  start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date        DATE,
  next_fire_at    TIMESTAMPTZ,
  last_fired_at   TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS medication_reminders_updated_at ON public.medication_reminders;
CREATE TRIGGER medication_reminders_updated_at
  BEFORE UPDATE ON public.medication_reminders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_medrem_owner    ON public.medication_reminders(owner_id);
CREATE INDEX IF NOT EXISTS idx_medrem_pet      ON public.medication_reminders(pet_id);
CREATE INDEX IF NOT EXISTS idx_medrem_active   ON public.medication_reminders(is_active);
CREATE INDEX IF NOT EXISTS idx_medrem_next     ON public.medication_reminders(next_fire_at)
  WHERE is_active = true;


-- ============================================================
-- TABLE: reminder_dispatch_log
-- Append-only audit of every reminder send attempt.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reminder_dispatch_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reminder_id   UUID REFERENCES public.medication_reminders(id) ON DELETE CASCADE,
  fired_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  channel       reminder_channel NOT NULL,
  status        dispatch_status NOT NULL,
  message       TEXT,
  error         TEXT
);

CREATE INDEX IF NOT EXISTS idx_dispatch_log_reminder ON public.reminder_dispatch_log(reminder_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_log_fired    ON public.reminder_dispatch_log(fired_at DESC);


-- ============================================================
-- VIEW: v_due_reminders
-- Reminders that should fire right now. Used by the cron tick.
-- ============================================================
CREATE OR REPLACE VIEW public.v_due_reminders AS
SELECT
  r.*,
  rx.medication_name,
  rx.dosage,
  rx.frequency,
  rx.route,
  p.name        AS pet_name,
  u.name        AS owner_name,
  u.email       AS owner_email,
  u.phone_number AS owner_phone
FROM public.medication_reminders r
JOIN public.prescriptions  rx ON rx.id = r.prescription_id
JOIN public.pets           p  ON p.id  = r.pet_id
JOIN public.users          u  ON u.id  = r.owner_id
WHERE r.is_active = true
  AND r.next_fire_at IS NOT NULL
  AND r.next_fire_at <= NOW() + INTERVAL '1 minute'
  AND (r.end_date IS NULL OR r.end_date >= CURRENT_DATE)
  AND r.start_date <= CURRENT_DATE
  AND rx.status = 'active';


-- ============================================================
-- HELPER: compute_next_fire_at(times_of_day, from_at)
-- Given the owner's schedule and a starting timestamp, returns
-- the next datetime when a dose should be administered.
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_next_fire_at(
  p_times TIME[],
  p_from  TIMESTAMPTZ DEFAULT NOW()
) RETURNS TIMESTAMPTZ LANGUAGE plpgsql STABLE AS $$
DECLARE
  t TIME;
  candidate TIMESTAMPTZ;
  best TIMESTAMPTZ := NULL;
BEGIN
  IF p_times IS NULL OR array_length(p_times, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  -- Try each scheduled time today and tomorrow; take the earliest
  -- one strictly in the future of p_from.
  FOREACH t IN ARRAY p_times LOOP
    candidate := (p_from::date + t)::timestamptz;
    IF candidate > p_from THEN
      IF best IS NULL OR candidate < best THEN best := candidate; END IF;
    END IF;
    candidate := ((p_from::date + 1) + t)::timestamptz;
    IF candidate > p_from THEN
      IF best IS NULL OR candidate < best THEN best := candidate; END IF;
    END IF;
  END LOOP;

  RETURN best;
END;
$$;

-- ============================================================
-- TRIGGER: keep next_fire_at fresh when schedule changes
-- ============================================================
CREATE OR REPLACE FUNCTION public.medrem_set_next_fire()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.next_fire_at IS NULL
     OR NEW.times_of_day IS DISTINCT FROM OLD.times_of_day
     OR NEW.is_active   IS DISTINCT FROM OLD.is_active
     OR NEW.start_date  IS DISTINCT FROM OLD.start_date THEN
    IF NEW.is_active THEN
      NEW.next_fire_at := public.compute_next_fire_at(NEW.times_of_day, GREATEST(NOW(), NEW.start_date::timestamptz));
    ELSE
      NEW.next_fire_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS medrem_bi ON public.medication_reminders;
CREATE TRIGGER medrem_bi
  BEFORE INSERT OR UPDATE ON public.medication_reminders
  FOR EACH ROW EXECUTE FUNCTION public.medrem_set_next_fire();


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.discharge_instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discharge_files        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refill_requests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_reminders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_dispatch_log  ENABLE ROW LEVEL SECURITY;

-- Reuse helpers if present
CREATE OR REPLACE FUNCTION public.is_staff(uid UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = uid AND u.role IN ('admin','veterinarian','staff'));
$$;
CREATE OR REPLACE FUNCTION public.owns_pet(uid UUID, pet UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet AND p.owner_id = uid);
$$;

-- discharge_instructions: staff full; client reads only own pet's PUBLISHED rows
DROP POLICY IF EXISTS "disc_staff_all"  ON public.discharge_instructions;
DROP POLICY IF EXISTS "disc_client_read" ON public.discharge_instructions;
CREATE POLICY "disc_staff_all"   ON public.discharge_instructions FOR ALL
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "disc_client_read" ON public.discharge_instructions FOR SELECT
  USING (public.owns_pet(auth.uid(), pet_id) AND is_published = true);

-- discharge_files inherit access from parent discharge
DROP POLICY IF EXISTS "disc_files_staff_all"  ON public.discharge_files;
DROP POLICY IF EXISTS "disc_files_client_read" ON public.discharge_files;
CREATE POLICY "disc_files_staff_all"  ON public.discharge_files FOR ALL
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "disc_files_client_read" ON public.discharge_files FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.discharge_instructions d
     WHERE d.id = discharge_id
       AND d.is_published = true
       AND public.owns_pet(auth.uid(), d.pet_id)
  ));

-- refill_requests: staff all; client manages own pets' requests
DROP POLICY IF EXISTS "refill_staff_all"  ON public.refill_requests;
DROP POLICY IF EXISTS "refill_owner_rw"   ON public.refill_requests;
CREATE POLICY "refill_staff_all" ON public.refill_requests FOR ALL
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "refill_owner_rw" ON public.refill_requests FOR ALL
  USING (public.owns_pet(auth.uid(), pet_id))
  WITH CHECK (public.owns_pet(auth.uid(), pet_id));

-- medication_reminders: staff all; owner manages own
DROP POLICY IF EXISTS "medrem_staff_all" ON public.medication_reminders;
DROP POLICY IF EXISTS "medrem_owner_rw"  ON public.medication_reminders;
CREATE POLICY "medrem_staff_all" ON public.medication_reminders FOR ALL
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "medrem_owner_rw"  ON public.medication_reminders FOR ALL
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- dispatch log: read-only for staff; owner can read their own
DROP POLICY IF EXISTS "dispatch_staff_read" ON public.reminder_dispatch_log;
DROP POLICY IF EXISTS "dispatch_owner_read" ON public.reminder_dispatch_log;
CREATE POLICY "dispatch_staff_read" ON public.reminder_dispatch_log FOR SELECT
  USING (public.is_staff(auth.uid()));
CREATE POLICY "dispatch_owner_read" ON public.reminder_dispatch_log FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.medication_reminders m
     WHERE m.id = reminder_id AND m.owner_id = auth.uid()
  ));
