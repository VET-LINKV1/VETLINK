/**
 * appointmentService.js
 * Full appointment lifecycle — booking, status, conflict prevention.
 */
const { supabaseAdmin } = require('../config/supabase');
const vetScheduleService = require('./vetScheduleService');
const notificationService = require('./notificationService');
const logger = require('../utils/logger');
const { getPrice } = require('../config/pricing');

const VALID_TRANSITIONS = {
  pending:   ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled', 'no_show'],
  completed: [],
  cancelled: [],
  declined:  [],
};

// Vet-specific transition map — vets can decline pending bookings
const VET_ACTIONS = {
  pending:   ['declined'],   // vet can decline pending bookings they can't accommodate
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  declined:  [],
};

/**
 * Extract the wall-clock date and time strings from a request payload.
 * Frontend may send either:
 *   - explicit `appointmentLocalDate` (YYYY-MM-DD) + `appointmentLocalTime` (HH:MM)
 *   - or a single ISO `appointmentAt` (we'll fall back to UTC components)
 */
function resolveWallClock(payload) {
  let localDate = payload.appointmentLocalDate || null;
  let localTime = payload.appointmentLocalTime || null;
  if (!localDate || !localTime) {
    const iso = payload.appointmentAt;
    if (!iso) return { localDate: null, localTime: null };
    const d = new Date(iso);
    if (isNaN(d.getTime())) return { localDate: null, localTime: null };
    // Fall back to UTC components — caller should ideally pass explicit fields.
    localDate = d.toISOString().slice(0, 10);
    localTime = d.toISOString().slice(11, 16);
  }
  return { localDate, localTime };
}

const appointmentService = {
  async book(clientId, payload) {
    const { petId, vetId, type, notes, durationMins = 30 } = payload;
    const { appointmentAt } = payload;

    if (!petId || !vetId || !appointmentAt || !type) {
      throw new Error('Missing required fields: petId, vetId, appointmentAt, type.');
    }

    const appointmentDate = new Date(appointmentAt);
    if (isNaN(appointmentDate.getTime())) throw new Error('Invalid appointment date.');

    // Verify pet ownership
    const { data: pet } = await supabaseAdmin
      .from('pets').select('id, name, owner_id').eq('id', petId).single();
    if (!pet)                      throw new Error('Pet not found.');
    if (pet.owner_id !== clientId) throw new Error('You can only book for your own pets.');

    // Verify vet
    const { data: vet } = await supabaseAdmin
      .from('users').select('id, name').eq('id', vetId).eq('role', 'veterinarian').single();
    if (!vet) throw new Error('Veterinarian not found.');

    // Wall-clock pieces for schedule comparison
    const { localDate, localTime } = resolveWallClock(payload);

    logger.info('appointment.book', 'validating slot', {
      vetId, localDate, localTime, durationMins, appointmentAt,
    });

    // Conflict + schedule + past-time check
    const validation = await vetScheduleService.validateBookingSlot(vetId, {
      localDate,
      localTime,
      appointmentISO: appointmentDate.toISOString(),
      durationMins,
    });
    if (!validation.valid) throw new Error(validation.reason);

    // ── Double-booking protection (application-level) ──
    // Re-check for overlapping slots right before insert.
    // This is a tight race-window guard: two requests may both
    // pass validateBookingSlot and only the first insert succeeds
    // (the DB unique index catches the loser with a 23505 error).
    const endISO = new Date(appointmentDate.getTime() + durationMins * 60000).toISOString();
    const { data: overlaps } = await supabaseAdmin
      .from('appointments')
      .select('id, status')
      .eq('vet_id', vetId)
      .in('status', ['pending', 'confirmed'])
      .lt('appointment_at', endISO)
      .gt('appointment_at', new Date(appointmentDate.getTime() - durationMins * 60000).toISOString());
    if (overlaps && overlaps.length > 0) {
      throw new Error('This time slot was just taken by another booking. Please choose a different time.');
    }

    const initialHistory = [{
      status: 'pending',
      at:     new Date().toISOString(),
      by:     clientId,
      note:   'Appointment created',
    }];

    const { data: appt, error } = await supabaseAdmin
      .from('appointments')
      .insert({
        pet_id:            petId,
        client_id:         clientId,
        vet_id:            vetId,
        appointment_at:    appointmentDate.toISOString(),
        duration_mins:     durationMins,
        type,
        service:           type,                   // alias for clarity / payment lookup
        amount:            getPrice(type) ?? 0,    // centavos
        payment_status:    'pending',
        notes:             notes || null,
        status:            'pending',
        status_updated_at: new Date().toISOString(),
        // JSONB column — pass the JS array directly, do NOT JSON.stringify
        status_history:    initialHistory,
      })
      .select('*, pets(name), users!appointments_vet_id_fkey(name)')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('This slot was just taken. Please choose another time.');
      }
      throw new Error('Failed to create appointment: ' + error.message);
    }

    // Notify client + vet
    const dateStr = appointmentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const timeStr = localTime || appointmentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    await notificationService.createWithSMS(clientId, {
      title:   'Appointment Booked',
      message: `${type} for ${pet.name} on ${dateStr} at ${timeStr} with ${vet.name}.`,
      type:    'success',
      link:    '/client/appointments',
      smsBody: `PHVC: Booking received for ${pet.name} on ${dateStr} at ${timeStr} with ${vet.name}. We'll confirm shortly.`,
    });
    await notificationService.createWithSMS(vetId, {
      title:   'New Appointment',
      message: `${type} for ${pet.name} on ${dateStr} at ${timeStr}.`,
      type:    'info',
      link:    '/dashboard',
      smsBody: `PHVC: New booking — ${type} for ${pet.name} on ${dateStr} at ${timeStr}. Open your dashboard to approve or decline.`,
    });

    return appt;
  },

  async getAll(userId, role, filters = {}) {
    let query = supabaseAdmin
      .from('appointments')
      .select(`
        *,
        pets (id, name, species, breed),
        client:users!appointments_client_id_fkey (id, name, email, phone_number),
        vet:users!appointments_vet_id_fkey (id, name, email)
      `)
      .order('appointment_at', { ascending: false });

    if (role === 'client')       query = query.eq('client_id', userId);
    if (role === 'veterinarian') query = query.eq('vet_id', userId);

    // Cast status to text for filtering so any status value works even if
    // the DB enum hasn't been updated yet (e.g. 'declined', 'no_show').
    // Without the cast, querying an enum value that doesn't exist crashes.
    if (filters.status) {
      query = query.filter('status::text', 'eq', filters.status);
    }
    if (filters.vetId)           query = query.eq('vet_id', filters.vetId);
    if (filters.date) {
      query = query
        .gte('appointment_at', `${filters.date}T00:00:00.000Z`)
        .lte('appointment_at', `${filters.date}T23:59:59.999Z`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getById(id, userId, role) {
    const { data, error } = await supabaseAdmin
      .from('appointments')
      .select(`
        *, pets (id, name, species, breed, age, gender),
        client:users!appointments_client_id_fkey (id, name, email, phone_number),
        vet:users!appointments_vet_id_fkey (id, name, email)
      `)
      .eq('id', id)
      .single();
    if (error || !data) throw new Error('Appointment not found.');

    if (role === 'client'       && data.client_id !== userId) throw new Error('Access denied.');
    if (role === 'veterinarian' && data.vet_id    !== userId) throw new Error('Access denied.');

    return data;
  },

  /**
   * Reschedule an appointment to a new date/time and optionally a different vet.
   * If the original vet is not available at the new time, the caller may
   * specify a different `newVetId`. The new slot is validated against the
   * vet's schedule, working hours, and existing bookings.
   */
  async reschedule(appointmentId, payload, actorId, actorRole) {
    const { appointmentAt, vetId, durationMins, notes } = payload;

    if (!appointmentAt) throw new Error('appointmentAt is required.');

    // 1. Fetch current appointment
    const { data: current } = await supabaseAdmin
      .from('appointments')
      .select('id, status, vet_id, pet_id, client_id, duration_mins, type, reason_code, urgency, status_history')
      .eq('id', appointmentId)
      .single();
    if (!current) throw new Error('Appointment not found.');

    // 2. Only pending or confirmed appointments can be rescheduled
    if (!['pending', 'confirmed'].includes(current.status)) {
      throw new Error(`Cannot reschedule an appointment with status "${current.status}".`);
    }

    // 3. Role permissions
    const finalVetId = vetId || current.vet_id;
    if (actorRole === 'client' && current.client_id !== actorId) {
      throw new Error('Access denied.');
    }
    if (actorRole === 'veterinarian' && current.vet_id !== actorId) {
      throw new Error('Access denied.');
    }

    // 4. Validate the new slot against the (possibly new) vet's schedule
    const newDate = new Date(appointmentAt);
    if (isNaN(newDate.getTime())) throw new Error('Invalid appointment date.');

    const finalDuration = durationMins || current.duration_mins || 30;

    // Wall-clock pieces for schedule validation
    let localDate = null;
    let localTime = null;
    if (payload.appointmentLocalDate && payload.appointmentLocalTime) {
      localDate = payload.appointmentLocalDate;
      localTime = payload.appointmentLocalTime;
    } else {
      localDate = newDate.toISOString().slice(0, 10);
      localTime = newDate.toISOString().slice(11, 16);
    }

    const validation = await vetScheduleService.validateBookingSlot(finalVetId, {
      localDate,
      localTime,
      appointmentISO: newDate.toISOString(),
      durationMins: finalDuration,
    });
    if (!validation.valid) throw new Error(validation.reason);

    // 5. Update the appointment
    const patch = {
      appointment_at:    newDate.toISOString(),
      vet_id:            finalVetId,
      duration_mins:     finalDuration,
      status_updated_at: new Date().toISOString(),
    };
    if (notes !== undefined) patch.notes = notes;

    // Append to status_history
    const history = [
      ...(Array.isArray(current.status_history) ? current.status_history : []),
      {
        from:    current.status,
        to:      current.status,   // status doesn't change, only time/vet
        at:      new Date().toISOString(),
        by:      actorId,
        byRole:  actorRole,
        reason:  `Rescheduled to ${localDate} ${localTime}`,
        type:    'reschedule',
      },
    ];
    patch.status_history = history;

    const { data: updated, error } = await supabaseAdmin
      .from('appointments')
      .update(patch)
      .eq('id', appointmentId)
      .select('*, pets(name), client:users!appointments_client_id_fkey(id,name), vet:users!appointments_vet_id_fkey(id,name)')
      .single();
    if (error) throw new Error(error.message);

    // 6. Notify affected parties
    const petName = updated.pets?.name || 'your pet';
    const dateStr = newDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const timeStr = localTime || newDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // Notify client (if staff/vet rescheduled)
    if (actorRole !== 'client' && updated.client?.id) {
      await notificationService.createWithSMS(updated.client.id, {
        title:   'Appointment Rescheduled',
        message: `Your appointment for ${petName} has been rescheduled to ${dateStr} at ${timeStr}.`,
        type:    'info',
        link:    '/client/appointments',
        smsBody: `PHVC: Your appointment for ${petName} has been rescheduled to ${dateStr} at ${timeStr}.`,
      });
    }
    // Notify vet (if client rescheduled)
    if (actorRole !== 'veterinarian' && updated.vet?.id) {
      await notificationService.create(updated.vet.id, {
        title:   'Appointment Rescheduled',
        message: `Appointment for ${petName} has been rescheduled to ${dateStr} at ${timeStr}.`,
        type:    'info',
        link:    '/dashboard',
      });
    }

    return updated;
  },

  async updateStatus(appointmentId, newStatus, actorId, actorRole, reason) {
    const { data: current } = await supabaseAdmin
      .from('appointments')
      .select('id, status, status_history, client_id, vet_id')
      .eq('id', appointmentId)
      .single();
    if (!current) throw new Error('Appointment not found.');

    const allowed = VALID_TRANSITIONS[current.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Cannot change from "${current.status}" to "${newStatus}".`);
    }

    // Role permissions
    if (actorRole === 'client') {
      if (current.client_id !== actorId)  throw new Error('Access denied.');
      if (newStatus !== 'cancelled')      throw new Error('Clients can only cancel appointments.');
    }
    if (actorRole === 'veterinarian') {
      if (current.vet_id !== actorId)                     throw new Error('Access denied.');
      const vetAllowed = VET_ACTIONS[current.status] || [];
      if (!vetAllowed.includes(newStatus))                throw new Error('Vets can only complete, cancel, or decline.');
    }
    // admin and staff can transition anything within VALID_TRANSITIONS

    // status_history is JSONB — start from existing array (already parsed by supabase-js)
    const history = [
      ...(Array.isArray(current.status_history) ? current.status_history : []),
      {
        from:    current.status,
        to:      newStatus,
        at:      new Date().toISOString(),
        by:      actorId,
        byRole:  actorRole,
        reason:  reason || null,
      },
    ];

    const patch = {
      status:            newStatus,
      status_updated_at: new Date().toISOString(),
      status_history:    history,
    };
    if (newStatus === 'confirmed') patch.approved_by   = actorId;
    if (newStatus === 'cancelled') {
      patch.cancelled_by  = actorId;
      patch.cancel_reason = reason || null;
    }
    if (newStatus === 'completed') patch.completed_at  = new Date().toISOString();
    if (newStatus === 'no_show') {
      patch.cancelled_by  = actorId || null;
      patch.cancel_reason = reason || 'No-show';
    }
    if (newStatus === 'declined') {
      patch.declined_by   = actorId;
      patch.declined_at   = new Date().toISOString();
      patch.declined_reason = reason || null;
    }

    const { data: updated, error } = await supabaseAdmin
      .from('appointments')
      .update(patch)
      .eq('id', appointmentId)
      .select('*, pets(name), client:users!appointments_client_id_fkey(id,name), vet:users!appointments_vet_id_fkey(id,name)')
      .single();
    if (error) throw new Error(error.message);

    // Notifications
    const petName = updated.pets?.name || 'your pet';
    const dateStr = updated.appointment_at
      ? new Date(updated.appointment_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '';

    if (newStatus === 'confirmed' && updated.client?.id) {
      await notificationService.createWithSMS(updated.client.id, {
        title:   'Appointment Confirmed',
        message: `Your appointment for ${petName} on ${dateStr} has been confirmed!`,
        type:    'success',
        link:    '/client/appointments',
        smsBody: `PHVC: Your appointment for ${petName} on ${dateStr} is CONFIRMED. See you then!`,
      });
    }
    if (newStatus === 'cancelled') {
      if (actorRole !== 'client' && updated.client?.id) {
        await notificationService.createWithSMS(updated.client.id, {
          title:   'Appointment Cancelled',
          message: `Your appointment for ${petName} on ${dateStr} was cancelled.${reason ? ' Reason: ' + reason : ''}`,
          type:    'warning',
          link:    '/client/appointments',
          smsBody: `PHVC: Your appointment for ${petName} on ${dateStr} was CANCELLED.${reason ? ' Reason: ' + reason : ''}`,
        });
      }
      if (actorRole !== 'veterinarian' && updated.vet?.id) {
        await notificationService.create(updated.vet.id, {
          title:   'Appointment Cancelled',
          message: `Appointment for ${petName} on ${dateStr} was cancelled.`,
          type:    'warning',
          link:    '/dashboard',
        });
      }
    }
    if (newStatus === 'completed' && updated.client?.id) {
      await notificationService.create(updated.client.id, {
        title:   'Visit Completed',
        message: `Your appointment for ${petName} on ${dateStr} is complete. Thank you!`,
        type:    'info',
        link:    '/client/appointments',
      });
    }
    if (newStatus === 'no_show') {
      if (actorRole !== 'client' && updated.client?.id) {
        await notificationService.createWithSMS(updated.client.id, {
          title:   'Missed Appointment — No Show',
          message: `Your appointment for ${petName} on ${dateStr} was marked as no-show. Please reschedule if you still need care.`,
          type:    'warning',
          link:    '/client/appointments',
          smsBody: `PHVC: Your appointment for ${petName} on ${dateStr} was marked as no-show. Please reschedule.`,
        });
      }
      if (actorRole !== 'veterinarian' && updated.vet?.id) {
        await notificationService.create(updated.vet.id, {
          title:   'Patient No-Show',
          message: `${petName} did not show for their appointment on ${dateStr}.`,
          type:    'info',
          link:    '/dashboard',
        });
      }
    }
    if (newStatus === 'declined' && updated.client?.id) {
      const vetName = updated.vet?.name || 'The veterinarian';
      await notificationService.createWithSMS(updated.client.id, {
        title:   'Booking Declined',
        message: `${vetName} was unable to accommodate your ${petName} appointment on ${dateStr}. Please choose a different time or vet.`,
        type:    'warning',
        link:    '/client/appointments',
        smsBody: `PHVC: Your appointment for ${petName} on ${dateStr} was declined by ${vetName}. Please choose a different time or vet.`,
      });
    }

    return updated;
  },
};

module.exports = appointmentService;
