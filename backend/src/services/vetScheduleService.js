const { supabaseAdmin } = require('../config/supabase');
const {
  generateSlots,
  filterAvailableSlots,
  validateSlot,
  dayOfWeekFromLocalDate,
} = require('../utils/slotEngine');

const vetScheduleService = {
  async getSchedule(vetId) {
    const { data, error } = await supabaseAdmin
      .from('vet_schedules')
      .select('*')
      .eq('vet_id', vetId)
      .eq('is_active', true)
      .order('day_of_week');
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getAllVetsWithSchedules() {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, name, email, avatar_url, staff_profiles(license_number, specialization), vet_schedules(day_of_week, start_time, end_time, slot_duration_mins, is_active)')
      .eq('role', 'veterinarian')
      .eq('is_active', true);
    if (error) throw new Error(error.message);
    return data || [];
  },

  /**
   * Get available slots for a vet on a date.
   * `date` is YYYY-MM-DD (clinic-local wall clock).
   */
  async getAvailableSlots(vetId, date) {
    const dow = dayOfWeekFromLocalDate(date);

    const { data: schedule } = await supabaseAdmin
      .from('vet_schedules')
      .select('*')
      .eq('vet_id', vetId)
      .eq('day_of_week', dow)
      .eq('is_active', true)
      .single();

    if (!schedule) return { date, vetId, slots: [] };

    const { data: existing } = await supabaseAdmin
      .from('appointments')
      .select('appointment_at, duration_mins, status')
      .eq('vet_id', vetId)
      .gte('appointment_at', `${date}T00:00:00.000Z`)
      .lte('appointment_at', `${date}T23:59:59.999Z`)
      .not('status', 'in', '("cancelled","completed")');

    const allSlots = generateSlots(schedule.start_time, schedule.end_time, schedule.slot_duration_mins);
    const slots    = filterAvailableSlots(allSlots, existing || [], date);
    return {
      date,
      vetId,
      schedule: {
        startTime:    schedule.start_time,
        endTime:      schedule.end_time,
        slotDuration: schedule.slot_duration_mins,
      },
      slots,
    };
  },

  /**
   * Validate a booking. Pass wall-clock pieces explicitly so TZ never drifts.
   * @param {string} vetId
   * @param {object} args
   * @param {string} args.localDate     YYYY-MM-DD
   * @param {string} args.localTime     HH:MM
   * @param {string} args.appointmentISO ISO instant for storage / past check
   * @param {number} args.durationMins
   */
  async validateBookingSlot(vetId, { localDate, localTime, appointmentISO, durationMins = 30 }) {
    if (!localDate || !localTime) {
      return { valid: false, reason: 'Missing local date/time for validation.' };
    }
    const schedules = await vetScheduleService.getSchedule(vetId);

    const { data: existing } = await supabaseAdmin
      .from('appointments')
      .select('id, appointment_at, duration_mins, status')
      .eq('vet_id', vetId)
      .gte('appointment_at', `${localDate}T00:00:00.000Z`)
      .lte('appointment_at', `${localDate}T23:59:59.999Z`)
      .not('status', 'in', '("cancelled","completed")');

    return validateSlot({
      localDate,
      localTime,
      durationMins,
      vetSchedules: schedules,
      existing: existing || [],
      appointmentISO,
    });
  },

  async setSchedule(vetId, scheduleData) {
    const { dayOfWeek, startTime, endTime, slotDurationMins = 30, isActive = true } = scheduleData;
    const { data, error } = await supabaseAdmin
      .from('vet_schedules')
      .upsert(
        {
          vet_id:             vetId,
          day_of_week:        dayOfWeek,
          start_time:         startTime,
          end_time:           endTime,
          slot_duration_mins: slotDurationMins,
          is_active:          isActive,
        },
        { onConflict: 'vet_id,day_of_week' }
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async setWeeklySchedule(vetId, days) {
    const rows = days.map((d) => ({
      vet_id:             vetId,
      day_of_week:        d.dayOfWeek,
      start_time:         d.startTime,
      end_time:           d.endTime,
      slot_duration_mins: d.slotDurationMins || 30,
      is_active:          d.isActive !== false,
    }));
    const { data, error } = await supabaseAdmin
      .from('vet_schedules')
      .upsert(rows, { onConflict: 'vet_id,day_of_week' })
      .select();
    if (error) throw new Error(error.message);
    return data;
  },
};

module.exports = vetScheduleService;
