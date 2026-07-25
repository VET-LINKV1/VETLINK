/**
 * bookingService.js
 *
 * Smart Frictionless Booking & Intake.
 *
 * Responsibilities:
 *   1. Expose a normalized list of appointment reasons + the urgency
 *      level each implies (used by the React wizard).
 *   2. Compute available slots for a vet on a date (delegates to the
 *      SQL function get_available_slots) and rank vets near a
 *      preferred time (find_open_vets).
 *   3. Create an appointment with proper triage:
 *        - emergency → notify staff/admin, draft a SOAP note
 *          flagged URGENT on the linked medical record
 *        - urgent / standard / routine → just create the booking
 *   4. Persist pre-visit intake forms and retrieve them for vets.
 *   5. Provide a vet "upcoming with intakes" feed for the
 *      Veterinarian View dashboard.
 *
 * Role rules:
 *   - client: book + submit intake for own pets only
 *   - admin / staff: book on behalf of clients, view everything,
 *     re-triage existing bookings
 *   - vet: view upcoming + intake; cannot book on behalf of others
 */
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

let notificationService = null;
try { notificationService = require('./notificationService'); } catch (_) {}

const STAFF_ROLES = ['admin', 'veterinarian', 'staff'];

/**
 * Reasons exposed to the client UI. The `urgency` here is the
 * DEFAULT — the client may not override emergency-coded reasons.
 */
const REASONS = [
  { code: 'annual_checkup', label: 'Annual Check-up', urgency: 'routine',   durationMins: 30, suggestedSpecialty: null, color: 'blue'    },
  { code: 'vaccination',    label: 'Vaccination',     urgency: 'routine',   durationMins: 20, suggestedSpecialty: null, color: 'emerald' },
  { code: 'grooming',       label: 'Grooming',        urgency: 'routine',   durationMins: 60, suggestedSpecialty: null, color: 'violet'  },
  { code: 'injury',         label: 'Limping / Injury',urgency: 'urgent',    durationMins: 30, suggestedSpecialty: 'Surgery', color: 'amber' },
  { code: 'emergency',      label: 'Emergency',       urgency: 'emergency', durationMins: 45, suggestedSpecialty: 'Emergency & Critical Care', color: 'red' },
  { code: 'other',          label: 'Other',           urgency: 'standard',  durationMins: 30, suggestedSpecialty: null, color: 'slate'   },
];

function findReason(code) {
  return REASONS.find(r => r.code === code) || null;
}

async function assertPetOwnedBy(petId, userId, role) {
  const { data: pet } = await supabaseAdmin
    .from('pets').select('id, owner_id, name').eq('id', petId).single();
  if (!pet) throw new Error('Pet not found.');
  if (role === 'client' && pet.owner_id !== userId) {
    throw new Error('Access denied: not your pet.');
  }
  return pet;
}

const bookingService = {

  /* ──────────────────── REASONS ────────────────────────────── */

  listReasons() {
    return REASONS;
  },

  /* ──────────────────── SLOTS / VET SUGGESTION ─────────────── */

  /**
   * All available slots for a given vet on a given date.
   * `slotMins` overrides the vet's default slot duration; the
   * SQL function falls back to vet_schedules.slot_duration_mins
   * when omitted.
   */
  async getAvailableSlots(vetId, date, { slotMins = null } = {}) {
    if (!vetId)  throw new Error('vetId is required.');
    if (!date)   throw new Error('date is required.');

    const { data, error } = await supabaseAdmin.rpc('get_available_slots', {
      p_vet_id: vetId,
      p_date:   date,
      p_slot_mins: slotMins,
    });
    if (error) throw new Error(error.message);
    return data || [];
  },

  /**
   * Suggest a ranked list of vets and their nearest open slot to
   * the requested time. Emergency-coded reasons skip the time
   * preference and force the earliest slot on the target date.
   *
   * Optionally filters to vets matching the reason's suggested
   * specialty (e.g. injury → Surgery), with a fallback to ANY
   * available vet if no specialist is free.
   */
  async suggestVets({ reasonCode, date, preferredTime, limit = 5 }) {
    if (!date)       throw new Error('date is required.');
    const reason = findReason(reasonCode);
    if (!reason)     throw new Error('Unknown reason code: ' + reasonCode);

    // Emergencies always grab the earliest slot, regardless of time pref.
    const around = (reason.code === 'emergency') ? null : (preferredTime || null);

    const { data: rows, error } = await supabaseAdmin.rpc('find_open_vets', {
      p_date:        date,
      p_around_time: around,
      p_limit:       Math.min(Math.max(limit, 1), 20),
    });
    if (error) throw new Error(error.message);

    let suggestions = rows || [];

    // Specialty filter (soft): if a specialty hint is present and there's
    // at least one vet of that specialty in the list, keep only those.
    if (reason.suggestedSpecialty && suggestions.length > 0) {
      const vetIds = suggestions.map(s => s.vet_id);
      const { data: profiles } = await supabaseAdmin
        .from('staff_profiles')
        .select('user_id, specialization')
        .in('user_id', vetIds);
      const specMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p.specialization]));

      const specMatches = suggestions.filter(s =>
        (specMap[s.vet_id] || '').toLowerCase().includes(reason.suggestedSpecialty.toLowerCase())
      );
      if (specMatches.length > 0) suggestions = specMatches;
      // attach specialization for the UI
      suggestions = suggestions.map(s => ({ ...s, specialization: specMap[s.vet_id] || null }));
    }

    return {
      reason,
      preferredDate: date,
      preferredTime: preferredTime || null,
      suggestions,
    };
  },

  /* ──────────────────── CREATE BOOKING ─────────────────────── */

  /**
   * Create an appointment. The caller may pass:
   *   { petId, reasonCode, appointmentAt, vetId?, durationMins?, notes? }
   *
   * - Client role: only books for their own pets; appointment defaults
   *   to status='pending', client_id=actor.
   * - Staff/Admin: may book on behalf — must pass clientId.
   * - Vet role: NOT allowed to call this (would conflict-of-interest).
   *
   * Triage:
   *   - emergency reason → urgency='emergency', status='confirmed' (skip approval),
   *     notify admin/staff in-app, optional draft SOAP note flagged URGENT.
   *   - otherwise urgency = reason default.
   */
  async createBooking(actorId, actorRole, payload) {
    const {
      petId, clientId, vetId, reasonCode,
      appointmentAt, durationMins, notes,
    } = payload;

    if (actorRole === 'veterinarian') throw new Error('Vets cannot create client bookings.');
    if (!petId)         throw new Error('petId is required.');
    if (!reasonCode)    throw new Error('reasonCode is required.');
    if (!appointmentAt) throw new Error('appointmentAt is required.');

    const reason = findReason(reasonCode);
    if (!reason) throw new Error('Unknown reason code: ' + reasonCode);

    const pet = await assertPetOwnedBy(petId, actorId, actorRole);

    // Determine client_id: client role → self; staff → must pass clientId or use pet owner
    const finalClientId = actorRole === 'client' ? actorId : (clientId || pet.owner_id);

    // Conflict pre-check: if vet specified, make sure the slot is still free
    if (vetId) {
      const startISO = new Date(appointmentAt).toISOString();
      const dur = durationMins || reason.durationMins;
      const endISO = new Date(new Date(appointmentAt).getTime() + dur * 60000).toISOString();

      // Tight overlap check: any existing booking that overlaps the requested window
      const { data: clash } = await supabaseAdmin
        .from('appointments')
        .select('id, status, appointment_at, duration_mins')
        .eq('vet_id', vetId)
        .in('status', ['pending', 'confirmed'])
        .lt('appointment_at', endISO)
        .gt('appointment_at', new Date(new Date(appointmentAt).getTime() - dur * 60000).toISOString());

      if (clash && clash.length > 0) {
        const clashTime = new Date(clash[0].appointment_at).toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit'
        });
        throw new Error(`This time slot was just taken. The vet has another booking at ${clashTime}. Please choose a different time.`);
      }
    }

    const insertPayload = {
      pet_id:         petId,
      client_id:      finalClientId,
      vet_id:         vetId || null,
      appointment_at: new Date(appointmentAt).toISOString(),
      duration_mins:  durationMins || reason.durationMins,
      type:           reason.label,
      reason:         notes || null,            // legacy free-text field (kept)
      reason_code:    reason.code,
      urgency:        reason.urgency,
      status:         reason.code === 'emergency' ? 'confirmed' : 'pending',
      notes:          notes || null,
    };

    const { data: appt, error } = await supabaseAdmin
      .from('appointments').insert(insertPayload).select().single();
    if (error) {
      // Unique constraint violation = race condition caught by DB
      if (error.code === '23505') {
        throw new Error('This time slot was just taken by another booking. Please choose a different time.');
      }
      throw new Error(error.message);
    }

    logger.info('booking', 'created', { id: appt.id, urgency: appt.urgency, reason: appt.reason_code });

    // ── Emergency triage workflow ──
    if (reason.code === 'emergency' && notificationService) {
      try {
        const { data: staff } = await supabaseAdmin
          .from('users').select('id').in('role', ['admin', 'staff']).eq('is_active', true);
        await Promise.all((staff || []).map(s =>
          notificationService.create(s.id, {
            title:   '🚨 EMERGENCY booking',
            message: `Emergency appointment booked for ${pet.name} at ${new Date(appt.appointment_at).toLocaleString()}.`,
            type:    'warning',
            link:    `/appointments`,
          }).catch(() => null)
        ));
      } catch (e) { logger.warn('booking', 'emergency notify failed', { msg: e.message }); }

      // Also draft a medical record + (placeholder) SOAP note flagged URGENT.
      // Only do this if we have an assigned vet — otherwise it'd violate the
      // medical_records.vet_id NOT NULL constraint.
      if (appt.vet_id) {
        try {
          const { data: rec } = await supabaseAdmin.from('medical_records').insert({
            pet_id:        appt.pet_id,
            vet_id:        appt.vet_id,
            appointment_id: appt.id,
            visit_date:    new Date().toISOString().slice(0, 10),
            diagnosis:     'PENDING — emergency intake',
            notes:         '⚠️ URGENT: draft created on emergency booking. Vet to complete after triage.',
          }).select().single();

          if (rec) {
            await supabaseAdmin.from('soap_notes').insert({
              medical_record_id: rec.id,
              pet_id:            rec.pet_id,
              vet_id:            rec.vet_id,
              subjective:        '🚨 EMERGENCY — see intake form on appointment for symptoms & history.',
              objective:         '',
              assessment:        '',
              plan:              '',
            });
          }
        } catch (e) { logger.warn('booking', 'emergency SOAP draft failed', { msg: e.message }); }
      }
    }

    return appt;
  },

  /* ──────────────────── INTAKE ─────────────────────────────── */

  async submitIntake(actorId, actorRole, payload) {
    const { appointmentId } = payload;
    if (!appointmentId) throw new Error('appointmentId is required.');

    // Look up the appointment to determine pet + permission
    const { data: appt } = await supabaseAdmin
      .from('appointments').select('id, pet_id, client_id, vet_id, status')
      .eq('id', appointmentId).single();
    if (!appt) throw new Error('Appointment not found.');

    if (actorRole === 'client' && appt.client_id !== actorId) {
      throw new Error('Access denied: not your appointment.');
    }
    if (!STAFF_ROLES.includes(actorRole) && actorRole !== 'client') {
      throw new Error('Access denied.');
    }

    // Upsert (one intake per appointment)
    const row = {
      appointment_id:    appointmentId,
      pet_id:            appt.pet_id,
      submitted_by:      actorId,
      symptoms:          payload.symptoms          || null,
      symptom_onset:     payload.symptomOnset      || null,
      symptom_severity:  payload.symptomSeverity   || null,
      diet_info:         payload.dietInfo          || null,
      current_medications: payload.currentMedications || null,
      allergies:         payload.allergies         || null,
      behavioral_notes:  payload.behavioralNotes   || null,
      recent_changes:    payload.recentChanges     || null,
      fasting_status:    payload.fastingStatus     || null,
      consent_given:     payload.consentGiven === true,
    };
    const { data, error } = await supabaseAdmin
      .from('appointment_intakes')
      .upsert(row, { onConflict: 'appointment_id' })
      .select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async getIntakeByAppointment(appointmentId, actorId, actorRole) {
    if (!appointmentId) throw new Error('appointmentId is required.');

    const { data: appt } = await supabaseAdmin
      .from('appointments').select('id, pet_id, client_id, vet_id')
      .eq('id', appointmentId).single();
    if (!appt) throw new Error('Appointment not found.');

    // Permission:
    //   client → only own
    //   vet    → only their assigned appointments
    //   staff/admin → all
    if (actorRole === 'client' && appt.client_id !== actorId) throw new Error('Access denied.');
    if (actorRole === 'veterinarian' && appt.vet_id !== actorId) throw new Error('Access denied.');

    const { data, error } = await supabaseAdmin
      .from('appointment_intakes')
      .select('*')
      .eq('appointment_id', appointmentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data || null;
  },

  /* ──────────────────── VET DASHBOARD ──────────────────────── */

  /**
   * Upcoming appointments for a vet with their intake (if any).
   * Used by VetIntakeReviewPage.
   */
  async vetUpcoming(vetId, role, { days = 7 } = {}) {
    if (!STAFF_ROLES.includes(role)) throw new Error('Access denied.');

    const start = new Date().toISOString();
    const end   = new Date(Date.now() + days * 86400000).toISOString();

    let q = supabaseAdmin
      .from('appointments')
      .select(`
        id, appointment_at, duration_mins, type, reason_code, urgency, status, notes,
        pet:pets ( id, name, species, breed, age, gender, weight_kg ),
        client:users!appointments_client_id_fkey ( id, name, email, phone_number ),
        intake:appointment_intakes ( * )
      `)
      .gte('appointment_at', start)
      .lte('appointment_at', end)
      .in('status', ['pending', 'confirmed'])
      .order('appointment_at', { ascending: true });

    if (role === 'veterinarian') q = q.eq('vet_id', vetId);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
  },

  /* ──────────────────── TRIAGE OVERRIDE ────────────────────── */

  async retriage(appointmentId, actorId, actorRole, urgency) {
    if (!STAFF_ROLES.includes(actorRole)) throw new Error('Access denied.');
    if (!['routine','standard','urgent','emergency'].includes(urgency)) throw new Error('Invalid urgency.');

    const { data, error } = await supabaseAdmin
      .from('appointments')
      .update({
        urgency,
        triaged_at: new Date().toISOString(),
        triaged_by: actorId,
      })
      .eq('id', appointmentId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

};

module.exports = bookingService;
