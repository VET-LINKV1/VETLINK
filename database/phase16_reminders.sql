-- ============================================================
-- VETLINK Phase 16: Vaccination & Deworming Reminders
-- Run in Supabase SQL Editor AFTER phase9_emr.sql
--
-- Adds:
--   * vaccination category column (vaccination / deworming)
--   * reminder_templates table (configurable reminder schedules)
--   * send_vaccination_reminders() function for the daily cron job
-- ============================================================

-- ── Add category column to vaccinations ─────────────────────
DO $$ BEGIN
  ALTER TABLE public.vaccinations
    ADD COLUMN category TEXT NOT NULL DEFAULT 'vaccination';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Validate: only 'vaccination' or 'deworming'
DO $$ BEGIN
  ALTER TABLE public.vaccinations
    ADD CONSTRAINT chk_vaccination_category
    CHECK (category IN ('vaccination', 'deworming'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_vaccinations_category ON public.vaccinations(category);

-- ── Reminder templates ──────────────────────────────────────
-- Configurable reminder intervals (days before due date).
-- The daily cron job uses these to decide when to send reminders.
CREATE TABLE IF NOT EXISTS public.reminder_templates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category        TEXT NOT NULL CHECK (category IN ('vaccination', 'deworming')),
  days_before_due INT  NOT NULL,   -- e.g. 7 = send reminder 7 days before due
  title_template  TEXT NOT NULL,   -- e.g. 'Vaccination due for {{pet_name}}'
  message_template TEXT NOT NULL,  -- e.g. 'Your pet {{pet_name}} is due for {{vaccine_name}} on {{due_date}}.'
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default reminder templates
INSERT INTO public.reminder_templates (category, days_before_due, title_template, message_template) VALUES
  ('vaccination', 14, 'Upcoming vaccination for {{pet_name}}', '{{pet_name}} is due for {{vaccine_name}} on {{due_date}}. Please schedule a visit with your vet.'),
  ('vaccination', 7,  'Vaccination reminder for {{pet_name}}', '{{pet_name}}''s {{vaccine_name}} is due in 7 days on {{due_date}}. Book an appointment to keep your pet protected.'),
  ('vaccination', 1,  'Tomorrow: {{vaccine_name}} for {{pet_name}}', '{{pet_name}} is due for {{vaccine_name}} tomorrow ({{due_date}}). Please confirm your appointment.'),
  ('vaccination', 0,  'Vaccination due today for {{pet_name}}', '{{pet_name}} is due for {{vaccine_name}} today. Please visit your vet.'),
  ('vaccination', -1, 'OVERDUE: {{vaccine_name}} for {{pet_name}}', '{{pet_name}}''s {{vaccine_name}} was due on {{due_date}} and is now overdue. Please schedule as soon as possible.'),
  ('deworming',  14, 'Upcoming deworming for {{pet_name}}', '{{pet_name}} is due for deworming ({{vaccine_name}}) on {{due_date}}.'),
  ('deworming',  7,  'Deworming reminder for {{pet_name}}', '{{pet_name}}''s deworming is due in 7 days on {{due_date}}. Book a visit to keep your pet healthy.'),
  ('deworming',  1,  'Tomorrow: Deworming for {{pet_name}}', '{{pet_name}} is due for deworming tomorrow ({{due_date}}).'),
  ('deworming',  0,  'Deworming due today for {{pet_name}}', '{{pet_name}} is due for deworming today ({{due_date}}).'),
  ('deworming',  -1, 'OVERDUE: Deworming for {{pet_name}}', '{{pet_name}}''s deworming was due on {{due_date}} and is now overdue. Please schedule soon.')
ON CONFLICT DO NOTHING;

-- Index for quick template lookups
CREATE INDEX IF NOT EXISTS idx_reminder_templates_category ON public.reminder_templates(category, is_active);

-- ── Daily reminder function ─────────────────────────────────
-- Finds all vaccinations/dewormings due within their reminder
-- windows and have NOT yet been notified for that window.
-- Returns a JSONB array of { vaccination_id, pet_id, owner_id,
--   pet_name, vaccine_name, due_date, category, days_until, title, message }
-- so the backend cron job can create notifications + SMS.
CREATE OR REPLACE FUNCTION public.send_vaccination_reminders()
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  results JSONB := '[]'::jsonb;
  row_rec RECORD;
  tmpl_rec RECORD;
  days_diff INT;
  msg TEXT;
  title TEXT;
BEGIN
  FOR row_rec IN
    SELECT
      v.id AS vaccination_id,
      v.pet_id,
      v.vet_id,
      p.owner_id,
      p.name AS pet_name,
      v.vaccine_name,
      v.due_date::text AS due_date_text,
      v.category,
      v.reminder_sent_at,
      (v.due_date - CURRENT_DATE) AS days_until
    FROM public.vaccinations v
    JOIN public.pets p ON p.id = v.pet_id
    WHERE v.status IN ('scheduled', 'overdue')
      AND v.due_date IS NOT NULL
      AND v.administered_date IS NULL
      AND (v.due_date - CURRENT_DATE) BETWEEN -1 AND 14
  LOOP
    days_diff := row_rec.days_until;

    -- Find a matching template for this day offset
    FOR tmpl_rec IN
      SELECT title_template, message_template
      FROM public.reminder_templates
      WHERE category = row_rec.category
        AND days_before_due = days_diff
        AND is_active = true
      LIMIT 1
    LOOP
      -- Only send if not already sent for this exact template window
      -- We use reminder_sent_at as a simple guard: skip if already sent
      -- (a more robust system would track per-window, but this is pragmatic)
      IF row_rec.reminder_sent_at IS NULL
         OR (CURRENT_DATE - row_rec.reminder_sent_at::date) > ABS(days_diff) THEN

        -- Build the notification message from template
        msg := tmpl_rec.message_template;
        msg := replace(msg, '{{pet_name}}',      row_rec.pet_name);
        msg := replace(msg, '{{vaccine_name}}',   row_rec.vaccine_name);
        msg := replace(msg, '{{due_date}}',       row_rec.due_date_text);
        msg := replace(msg, '{{category}}',       row_rec.category);

        title := tmpl_rec.title_template;
        title := replace(title, '{{pet_name}}',    row_rec.pet_name);
        title := replace(title, '{{vaccine_name}}', row_rec.vaccine_name);
        title := replace(title, '{{due_date}}',     row_rec.due_date_text);

        results := results || jsonb_build_object(
          'vaccination_id', row_rec.vaccination_id,
          'pet_id',         row_rec.pet_id,
          'vet_id',         row_rec.vet_id,
          'owner_id',       row_rec.owner_id,
          'pet_name',       row_rec.pet_name,
          'vaccine_name',   row_rec.vaccine_name,
          'due_date',       row_rec.due_date_text,
          'category',       row_rec.category,
          'days_until',     days_diff,
          'title',          title,
          'message',        msg
        );

        -- Mark as sent
        UPDATE public.vaccinations
           SET reminder_sent_at = NOW()
         WHERE id = row_rec.vaccination_id;

      END IF;
    END LOOP;
  END LOOP;

  RETURN results;
END;
$$;

-- ── Mark overdue vaccinations (already exists, just ensure it) ──
CREATE OR REPLACE FUNCTION public.mark_overdue_vaccinations()
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE updated_count INT;
BEGIN
  UPDATE public.vaccinations
     SET status = 'overdue', updated_at = NOW()
   WHERE status = 'scheduled'
     AND due_date IS NOT NULL
     AND due_date < CURRENT_DATE
     AND administered_date IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
