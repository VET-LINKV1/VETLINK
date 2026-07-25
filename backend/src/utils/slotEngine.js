/**
 * slotEngine.js
 * Pure functions for vet-schedule slot generation, availability filtering,
 * and booking validation.
 *
 * IMPORTANT: All schedule math is done in WALL-CLOCK (clinic-local) time.
 * Pass `localDate` (YYYY-MM-DD) and `localTime` (HH:MM) to validateSlot,
 * not a JS Date — that way TZ between server / client / DB cannot drift.
 */

function timeToMins(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
function minsToTime(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}
function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Day-of-week from a YYYY-MM-DD string.
 * Uses UTC math to avoid TZ drift on the server.
 */
function dayOfWeekFromLocalDate(localDate) {
  const [y, mo, d] = localDate.split('-').map(Number);
  // UTC Date — stable on any server TZ
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

function generateSlots(startTime, endTime, durationMins = 30) {
  const slots = [];
  let cur = timeToMins(startTime);
  const end = timeToMins(endTime);
  while (cur + durationMins <= end) {
    slots.push({ start: minsToTime(cur), end: minsToTime(cur + durationMins) });
    cur += durationMins;
  }
  return slots;
}

/**
 * Mark each slot available/unavailable based on existing bookings.
 * `existing` rows must contain `appointment_at` (TIMESTAMPTZ) and `status`.
 * `localDate` is the YYYY-MM-DD we're rendering slots for.
 *
 * The comparison is TZ-safe: we extract the existing appointment's
 * minute-range using the same UTC instant arithmetic the booking will use.
 */
function filterAvailableSlots(allSlots, booked, localDate) {
  return allSlots.map((slot) => {
    const ss = timeToMins(slot.start);
    const se = timeToMins(slot.end);
    const isBooked = booked.some((a) => {
      if (!a.appointment_at) return false;
      if (['cancelled', 'completed'].includes(a.status)) return false;
      const d = new Date(a.appointment_at);
      // For the same calendar date, compute wall-clock-equivalent minutes
      // by interpreting the timestamp consistently (local).
      const as = d.getHours() * 60 + d.getMinutes();
      const ae = as + (a.duration_mins || 30);
      return rangesOverlap(ss, se, as, ae);
    });
    return { ...slot, available: !isBooked };
  });
}

/**
 * Validate a booking attempt against:
 *   1. Past-time rejection
 *   2. Vet's working day
 *   3. Within working hours
 *   4. On a slot boundary
 *   5. No overlap with existing same-day bookings
 *
 * @param {string} localDate   YYYY-MM-DD (wall clock for clinic)
 * @param {string} localTime   HH:MM      (wall clock)
 * @param {number} durationMins
 * @param {Array}  vetSchedules  rows from vet_schedules
 * @param {Array}  existing      rows from appointments (same date, vet)
 * @param {Date}   nowUTC        injected for testability; defaults to now
 * @param {string} appointmentISO  the ISO timestamp the row will be inserted with
 *                                 (used for past-time check, comparing instants)
 */
function validateSlot({
  localDate,
  localTime,
  durationMins,
  vetSchedules,
  existing,
  nowUTC = new Date(),
  appointmentISO,
}) {
  // 1. Past-time check (instant comparison, TZ-safe)
  if (appointmentISO) {
    const apptInstant = new Date(appointmentISO);
    if (apptInstant <= nowUTC) {
      return { valid: false, reason: 'Appointment must be in the future.' };
    }
  }

  // 2. Vet's working day
  const dow = dayOfWeekFromLocalDate(localDate);
  const sched = vetSchedules.find((s) => s.day_of_week === dow && s.is_active);
  if (!sched) {
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    return { valid: false, reason: `Veterinarian is not available on ${days[dow]}.` };
  }

  // 3. Within working hours
  const asm = timeToMins(localTime);
  const aem = asm + durationMins;
  const ss  = timeToMins(sched.start_time);
  const se  = timeToMins(sched.end_time);
  if (asm < ss || aem > se) {
    return {
      valid: false,
      reason: `Booking must be within clinic hours (${sched.start_time}–${sched.end_time}).`,
    };
  }

  // 4. On slot boundary
  const dur = sched.slot_duration_mins || 30;
  if ((asm - ss) % dur !== 0) {
    return { valid: false, reason: `Booking must start on ${dur}-minute intervals.` };
  }

  // 5. Conflict — overlap against existing same-day bookings (instant compare)
  const apptInstant = appointmentISO ? new Date(appointmentISO).getTime() : null;
  for (const e of existing) {
    if (!e.appointment_at) continue;
    if (['cancelled','completed'].includes(e.status)) continue;
    const eStart = new Date(e.appointment_at).getTime();
    const eEnd   = eStart + (e.duration_mins || 30) * 60 * 1000;
    if (apptInstant !== null) {
      const apptEnd = apptInstant + durationMins * 60 * 1000;
      if (apptInstant < eEnd && eStart < apptEnd) {
        return { valid: false, reason: 'This time slot is already booked.' };
      }
    }
  }

  return { valid: true };
}

module.exports = {
  generateSlots,
  filterAvailableSlots,
  validateSlot,
  minsToTime,
  timeToMins,
  dayOfWeekFromLocalDate,
};
