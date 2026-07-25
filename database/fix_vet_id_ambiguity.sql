-- Quick fix: Update get_available_slots and find_open_vets
-- to resolve the "column reference vet_id is ambiguous" error.
-- Run this in Supabase SQL Editor.

-- 1. get_available_slots — alias tables to avoid ambiguity
CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_vet_id  UUID,
  p_date    DATE,
  p_slot_mins INT DEFAULT NULL
)
RETURNS TABLE (
  slot_start TIMESTAMPTZ,
  slot_end   TIMESTAMPTZ
) LANGUAGE plpgsql STABLE AS $$
DECLARE
  sched   public.vet_schedules%ROWTYPE;
  dow     INT := EXTRACT(DOW FROM p_date)::INT;
  step    INTERVAL;
  cur     TIMESTAMPTZ;
  day_end TIMESTAMPTZ;
BEGIN
  SELECT vs.* INTO sched
    FROM public.vet_schedules vs
   WHERE vs.vet_id = p_vet_id
     AND vs.day_of_week = dow
     AND vs.is_active = true
   LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  step := make_interval(mins => COALESCE(p_slot_mins, sched.slot_duration_mins));
  cur     := (p_date::TIMESTAMP + sched.start_time)::TIMESTAMPTZ;
  day_end := (p_date::TIMESTAMP + sched.end_time)::TIMESTAMPTZ;

  WHILE cur + step <= day_end LOOP
    IF cur > NOW() - INTERVAL '5 minutes' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.appointments apt
         WHERE apt.vet_id = p_vet_id
           AND apt.status IN ('pending','confirmed')
           AND apt.appointment_at IS NOT NULL
           AND tstzrange(apt.appointment_at, apt.appointment_at + make_interval(mins => COALESCE(apt.duration_mins, 30)), '[)') && tstzrange(cur, cur + step, '[)')
      ) THEN
        slot_start := cur;
        slot_end   := cur + step;
        RETURN NEXT;
      END IF;
    END IF;
    cur := cur + step;
  END LOOP;
END;
$$;


-- 2. find_open_vets — cast load_today to INT to match RETURNS TABLE
CREATE OR REPLACE FUNCTION public.find_open_vets(
  p_date         DATE,
  p_around_time  TIME    DEFAULT NULL,
  p_limit        INT     DEFAULT 5
)
RETURNS TABLE (
  vet_id     UUID,
  vet_name   TEXT,
  slot_start TIMESTAMPTZ,
  slot_end   TIMESTAMPTZ,
  load_today INT,
  delta_mins INT
) LANGUAGE plpgsql STABLE AS $$
DECLARE
  target TIMESTAMPTZ;
BEGIN
  IF p_around_time IS NOT NULL THEN
    target := (p_date::TIMESTAMP + p_around_time)::TIMESTAMPTZ;
  ELSE
    target := (p_date::TIMESTAMP + TIME '09:00')::TIMESTAMPTZ;
  END IF;

  RETURN QUERY
    WITH ranked_slots AS (
      SELECT
        u.id                                         AS vet_uid,
        u.name                                       AS vet_uname,
        s.slot_start                                 AS vslot_start,
        s.slot_end                                   AS vslot_end,
        COALESCE(l.load_today, 0)::INT               AS vload_today,
        ABS(EXTRACT(EPOCH FROM (s.slot_start - target))/60)::INT AS vdelta_mins,
        ROW_NUMBER() OVER (
          PARTITION BY u.id
          ORDER BY ABS(EXTRACT(EPOCH FROM (s.slot_start - target)))
        ) AS vrn
      FROM public.users u
      LEFT JOIN public.v_vet_load_today l ON l.vet_id = u.id
      CROSS JOIN LATERAL public.get_available_slots(u.id, p_date) AS s
      WHERE u.role = 'veterinarian' AND u.is_active = true
    )
    SELECT
      rs.vet_uid::UUID     AS vet_id,
      rs.vet_uname::TEXT   AS vet_name,
      rs.vslot_start::TIMESTAMPTZ AS slot_start,
      rs.vslot_end::TIMESTAMPTZ   AS slot_end,
      rs.vload_today::INT  AS load_today,
      rs.vdelta_mins::INT  AS delta_mins
    FROM ranked_slots rs
    WHERE rs.vrn = 1
    ORDER BY rs.vdelta_mins ASC, rs.vload_today ASC
    LIMIT p_limit;
END;
$$;
