/**
 * postCareService.js
 *
 * Integrated Post-Care & Pharmacy Hub.
 *
 * Three concerns, one service:
 *   1. Digital discharge instructions (CRUD + publish)
 *   2. Prescription refill requests (client → clinic queue → approve/deny)
 *   3. Medication reminders (per-prescription schedule + cron-tick dispatcher)
 *
 * Reuses existing services:
 *   - notificationService  → in-app reminders + refill-status alerts
 *   - smsService           → SMS reminder channel (respects SMS_DISABLED)
 *   - emailService         → email reminder channel (no-ops if SMTP not set)
 *
 * Role rules:
 *   admin / vet           full read/write on everything
 *   staff                 read all, approve refills, dispatch tick
 *   client                read own pets' discharges (published only),
 *                         create refill requests, CRUD their own
 *                         medication_reminders
 */
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

let notificationService = null;
let smsService = null;
let emailService = null;
try { notificationService = require('./notificationService'); } catch (_) {}
try { smsService          = require('./smsService');          } catch (_) {}
try { emailService        = require('./emailService');        } catch (_) {}

const STAFF_ROLES = ['admin', 'veterinarian', 'staff'];
const WRITE_ROLES = ['admin', 'veterinarian'];

function assertStaff(role) {
  if (!STAFF_ROLES.includes(role)) throw new Error('Access denied.');
}
function assertWriter(role) {
  if (!WRITE_ROLES.includes(role)) throw new Error('Access denied: requires admin or veterinarian.');
}
async function assertPetVisible(petId, userId, role) {
  if (!STAFF_ROLES.includes(role) && role !== 'client') throw new Error('Access denied.');
  const { data: pet } = await supabaseAdmin
    .from('pets').select('id, owner_id, name').eq('id', petId).single();
  if (!pet) throw new Error('Pet not found.');
  if (role === 'client' && pet.owner_id !== userId) throw new Error('Access denied: not your pet.');
  return pet;
}

const postCareService = {

  /* ──────────────────────────────────────────────────────────────
   * DISCHARGE INSTRUCTIONS
   * ────────────────────────────────────────────────────────────── */

  async getDischargeByAppointment(appointmentId, userId, role) {
    const { data: appt } = await supabaseAdmin
      .from('appointments').select('id, pet_id, client_id, vet_id').eq('id', appointmentId).single();
    if (!appt) throw new Error('Appointment not found.');

    if (role === 'client' && appt.client_id !== userId) throw new Error('Access denied.');
    if (role === 'veterinarian' && appt.vet_id !== userId && appt.vet_id) {
      // vet may still view their own appointments' discharges only
      // (admin/staff fall through)
    }

    const { data, error } = await supabaseAdmin
      .from('discharge_instructions')
      .select('*, files:discharge_files(file:emr_files(id, kind, title, mime_type, size_bytes, storage_path))')
      .eq('appointment_id', appointmentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;

    // Clients only see published discharges
    if (role === 'client' && !data.is_published) return null;
    return data;
  },

  async listDischargesForPet(petId, userId, role) {
    await assertPetVisible(petId, userId, role);
    let q = supabaseAdmin.from('discharge_instructions')
      .select('id, appointment_id, title, follow_up_date, is_published, published_at, created_at, updated_at')
      .eq('pet_id', petId)
      .order('created_at', { ascending: false });
    if (role === 'client') q = q.eq('is_published', true);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async upsertDischarge(actorId, role, payload) {
    assertWriter(role);
    const { appointmentId } = payload;
    if (!appointmentId) throw new Error('appointmentId is required.');

    const { data: appt } = await supabaseAdmin
      .from('appointments').select('id, pet_id, vet_id, client_id').eq('id', appointmentId).single();
    if (!appt) throw new Error('Appointment not found.');

    const row = {
      appointment_id: appointmentId,
      pet_id:         appt.pet_id,
      vet_id:         appt.vet_id || actorId,
      title:          payload.title || 'Discharge Instructions',
      body:           payload.body  || null,
      steps:          payload.steps   || [],
      feeding:        payload.feeding || [],
      videos:         payload.videos  || [],
      follow_up_date: payload.followUpDate || null,
      is_published:   payload.isPublished === true,
      published_at:   payload.isPublished === true ? new Date().toISOString() : null,
    };

    const { data, error } = await supabaseAdmin
      .from('discharge_instructions')
      .upsert(row, { onConflict: 'appointment_id' })
      .select().single();
    if (error) throw new Error(error.message);

    // Notify owner when first published
    if (row.is_published && appt.client_id && notificationService) {
      try {
        await notificationService.create(appt.client_id, {
          title:   'New discharge instructions',
          message: `Your vet posted post-care instructions for the recent visit.`,
          type:    'info',
          link:    `/client/postcare`,
        });
      } catch (_) {}
    }

    return data;
  },

  async attachDischargeFile(actorId, role, dischargeId, fileId) {
    assertWriter(role);
    if (!dischargeId || !fileId) throw new Error('dischargeId and fileId are required.');
    const { data, error } = await supabaseAdmin
      .from('discharge_files')
      .insert({ discharge_id: dischargeId, file_id: fileId })
      .select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async detachDischargeFile(role, joinId) {
    assertWriter(role);
    const { error } = await supabaseAdmin
      .from('discharge_files').delete().eq('id', joinId);
    if (error) throw new Error(error.message);
    return { detached: true };
  },


  /* ──────────────────────────────────────────────────────────────
   * REFILL REQUESTS
   * ────────────────────────────────────────────────────────────── */

  /**
   * Client requests a refill on an active prescription they own.
   */
  async requestRefill(actorId, role, payload) {
    if (role !== 'client' && !STAFF_ROLES.includes(role)) throw new Error('Access denied.');
    const { prescriptionId, notes } = payload;
    if (!prescriptionId) throw new Error('prescriptionId is required.');

    const { data: rx } = await supabaseAdmin
      .from('prescriptions').select('id, pet_id, status, refills_allowed, refills_used, medication_name')
      .eq('id', prescriptionId).single();
    if (!rx) throw new Error('Prescription not found.');

    const pet = await assertPetVisible(rx.pet_id, actorId, role);

    if (rx.status !== 'active')
      throw new Error('Only active prescriptions can be refilled.');
    if (rx.refills_used >= rx.refills_allowed)
      throw new Error('No refills remaining on this prescription.');

    // Block duplicate pending requests
    const { data: dup } = await supabaseAdmin
      .from('refill_requests').select('id')
      .eq('prescription_id', prescriptionId)
      .eq('status', 'pending').maybeSingle();
    if (dup) throw new Error('A pending refill request already exists for this prescription.');

    const { data, error } = await supabaseAdmin
      .from('refill_requests').insert({
        prescription_id: prescriptionId,
        pet_id:          rx.pet_id,
        requested_by:    actorId,
        notes:           notes || null,
      }).select().single();
    if (error) throw new Error(error.message);

    // Notify clinic staff/admin
    if (notificationService) {
      try {
        const { data: staff } = await supabaseAdmin
          .from('users').select('id').in('role', ['admin','staff','veterinarian']).eq('is_active', true);
        await Promise.all((staff || []).map(s =>
          notificationService.create(s.id, {
            title:   'New refill request',
            message: `Refill requested for ${rx.medication_name} (${pet.name}).`,
            type:    'info',
            link:    '/pharmacy',
          }).catch(() => null)
        ));
      } catch (_) {}
    }

    return data;
  },

  async listMyRefillRequests(actorId, role) {
    if (role !== 'client') throw new Error('Access denied.');
    const { data, error } = await supabaseAdmin
      .from('refill_requests')
      .select(`
        id, status, requested_at, processed_at, denial_reason, pickup_ready_at,
        prescription:prescriptions ( id, medication_name, dosage, frequency, refills_allowed, refills_used, status ),
        pet:pets ( id, name )
      `)
      .eq('requested_by', actorId)
      .order('requested_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async listPharmacyQueue(role, { status = 'pending' } = {}) {
    assertStaff(role);
    const { data, error } = await supabaseAdmin
      .from('refill_requests')
      .select(`
        id, status, requested_at, processed_at, denial_reason, pickup_ready_at, notes,
        prescription:prescriptions ( id, medication_name, dosage, frequency, route, refills_allowed, refills_used, status ),
        pet:pets ( id, name, species ),
        requester:users!refill_requests_requested_by_fkey ( id, name, email, phone_number )
      `)
      .eq('status', status)
      .order('requested_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  },

  /**
   * Approve a refill. Increments prescriptions.refills_used.
   * Optional pickupReadyAt to communicate when it'll be ready.
   */
  async approveRefill(actorId, role, requestId, { pickupReadyAt } = {}) {
    assertStaff(role);
    const { data: rr } = await supabaseAdmin
      .from('refill_requests').select('*').eq('id', requestId).single();
    if (!rr) throw new Error('Refill request not found.');
    if (rr.status !== 'pending') throw new Error('Only pending requests can be approved.');

    const { data: rx } = await supabaseAdmin
      .from('prescriptions').select('id, refills_allowed, refills_used, medication_name')
      .eq('id', rr.prescription_id).single();
    if (!rx) throw new Error('Prescription not found.');
    if (rx.refills_used >= rx.refills_allowed) {
      throw new Error('Prescription has no refills remaining.');
    }

    // Bump refills_used
    await supabaseAdmin.from('prescriptions')
      .update({ refills_used: rx.refills_used + 1 })
      .eq('id', rx.id);

    const { data, error } = await supabaseAdmin
      .from('refill_requests')
      .update({
        status:           'approved',
        processed_by:     actorId,
        processed_at:     new Date().toISOString(),
        pickup_ready_at:  pickupReadyAt ? new Date(pickupReadyAt).toISOString() : null,
      })
      .eq('id', requestId)
      .select().single();
    if (error) throw new Error(error.message);

    // Notify requester
    if (notificationService) {
      try {
        await notificationService.create(rr.requested_by, {
          title:   'Refill approved',
          message: `Your refill for ${rx.medication_name} has been approved.` + (pickupReadyAt ? ` Ready ${new Date(pickupReadyAt).toLocaleString()}.` : ''),
          type:    'success',
          link:    '/client/postcare',
        });
      } catch (_) {}
    }
    return data;
  },

  async denyRefill(actorId, role, requestId, denialReason) {
    assertStaff(role);
    if (!denialReason) throw new Error('denialReason is required.');
    const { data: rr } = await supabaseAdmin
      .from('refill_requests').select('id, status, requested_by').eq('id', requestId).single();
    if (!rr) throw new Error('Refill request not found.');
    if (rr.status !== 'pending') throw new Error('Only pending requests can be denied.');

    const { data, error } = await supabaseAdmin
      .from('refill_requests')
      .update({
        status:         'denied',
        processed_by:   actorId,
        processed_at:   new Date().toISOString(),
        denial_reason:  denialReason,
      })
      .eq('id', requestId)
      .select().single();
    if (error) throw new Error(error.message);

    if (notificationService) {
      try {
        await notificationService.create(rr.requested_by, {
          title:   'Refill denied',
          message: `Your refill request was denied: ${denialReason}`,
          type:    'warning',
          link:    '/client/postcare',
        });
      } catch (_) {}
    }
    return data;
  },

  async markRefillDispensed(actorId, role, requestId) {
    assertStaff(role);
    const { data, error } = await supabaseAdmin
      .from('refill_requests')
      .update({ status: 'dispensed', processed_at: new Date().toISOString(), processed_by: actorId })
      .eq('id', requestId).eq('status', 'approved')
      .select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async cancelRefill(actorId, role, requestId) {
    const { data: rr } = await supabaseAdmin
      .from('refill_requests').select('id, status, requested_by').eq('id', requestId).single();
    if (!rr) throw new Error('Refill request not found.');
    if (rr.status !== 'pending') throw new Error('Only pending requests can be cancelled.');
    if (role === 'client' && rr.requested_by !== actorId) throw new Error('Access denied.');

    const { data, error } = await supabaseAdmin
      .from('refill_requests').update({ status: 'cancelled' }).eq('id', requestId)
      .select().single();
    if (error) throw new Error(error.message);
    return data;
  },


  /* ──────────────────────────────────────────────────────────────
   * MEDICATION REMINDERS
   * ────────────────────────────────────────────────────────────── */

  async listRemindersForOwner(ownerId, actorId, actorRole) {
    if (actorRole === 'client' && ownerId !== actorId) throw new Error('Access denied.');
    if (!STAFF_ROLES.includes(actorRole) && actorRole !== 'client') throw new Error('Access denied.');

    const { data, error } = await supabaseAdmin
      .from('medication_reminders')
      .select(`
        *,
        prescription:prescriptions ( id, medication_name, dosage, frequency, route, status, end_date ),
        pet:pets ( id, name )
      `)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async createReminder(actorId, role, payload) {
    const { prescriptionId, timesOfDay, channels, foodInstruction, messageOverride, startDate, endDate } = payload;
    if (!prescriptionId)                          throw new Error('prescriptionId is required.');
    if (!Array.isArray(timesOfDay) || !timesOfDay.length) throw new Error('timesOfDay is required.');

    const { data: rx } = await supabaseAdmin
      .from('prescriptions').select('id, pet_id, end_date').eq('id', prescriptionId).single();
    if (!rx) throw new Error('Prescription not found.');

    const pet = await assertPetVisible(rx.pet_id, actorId, role);

    const insert = {
      prescription_id: rx.id,
      pet_id:          rx.pet_id,
      owner_id:        pet.owner_id,
      times_of_day:    timesOfDay,
      food_instruction: foodInstruction || null,
      message_override: messageOverride || null,
      channels:        (channels && channels.length ? channels : ['in_app']),
      start_date:      startDate || new Date().toISOString().slice(0, 10),
      end_date:        endDate || rx.end_date || null,
      created_by:      actorId,
    };
    const { data, error } = await supabaseAdmin
      .from('medication_reminders').insert(insert).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async updateReminder(id, actorId, role, payload) {
    const { data: existing } = await supabaseAdmin
      .from('medication_reminders').select('*').eq('id', id).single();
    if (!existing) throw new Error('Reminder not found.');
    if (role === 'client' && existing.owner_id !== actorId) throw new Error('Access denied.');
    if (!STAFF_ROLES.includes(role) && role !== 'client') throw new Error('Access denied.');

    const map = {
      timesOfDay:       'times_of_day',
      foodInstruction:  'food_instruction',
      messageOverride:  'message_override',
      channels:         'channels',
      startDate:        'start_date',
      endDate:          'end_date',
      isActive:         'is_active',
    };
    const update = {};
    for (const [k, col] of Object.entries(map)) if (k in payload) update[col] = payload[k];
    if (!Object.keys(update).length) throw new Error('Nothing to update.');

    const { data, error } = await supabaseAdmin
      .from('medication_reminders').update(update).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async deleteReminder(id, actorId, role) {
    const { data: existing } = await supabaseAdmin
      .from('medication_reminders').select('id, owner_id').eq('id', id).single();
    if (!existing) throw new Error('Reminder not found.');
    if (role === 'client' && existing.owner_id !== actorId) throw new Error('Access denied.');
    if (!STAFF_ROLES.includes(role) && role !== 'client') throw new Error('Access denied.');

    const { error } = await supabaseAdmin.from('medication_reminders').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { deleted: true };
  },

  /**
   * Cron tick — dispatch every reminder eligible to fire right now.
   * Idempotent: bumps next_fire_at after each dispatch so a re-run
   * within the minute won't double-send.
   *
   * Returns { processed, dispatched } counts.
   */
  async tickReminders() {
    const { data: due, error } = await supabaseAdmin
      .from('v_due_reminders').select('*');
    if (error) throw new Error(error.message);

    let dispatched = 0;
    for (const r of due || []) {
      const msg = r.message_override
        || `Time for ${r.pet_name}'s ${r.medication_name} (${r.dosage}) — ${r.frequency}.`
           + (r.food_instruction ? ` ${r.food_instruction}.` : '');

      for (const ch of (r.channels || ['in_app'])) {
        try {
          if (ch === 'in_app' && notificationService) {
            await notificationService.create(r.owner_id, {
              title:   `💊 Dose reminder — ${r.pet_name}`,
              message: msg,
              type:    'info',
              link:    '/client/postcare',
            });
            await logDispatch(r.id, ch, 'sent', msg);
          } else if (ch === 'sms' && smsService && r.owner_phone) {
            const res = await smsService.sendNotification(r.owner_phone, msg);
            await logDispatch(r.id, ch, res.delivered ? 'sent' : 'failed', msg, res.delivered ? null : (res.error || res.provider));
          } else if (ch === 'email' && emailService && r.owner_email) {
            const res = await emailService.send({
              to:      r.owner_email,
              subject: `Medication reminder — ${r.pet_name}`,
              html:    `<p>${msg}</p><p style="color:#94a3b8;font-size:12px;">From VETLINK</p>`,
              text:    msg,
            });
            await logDispatch(r.id, ch, res.delivered ? 'sent' : 'failed', msg, res.delivered ? null : res.reason);
          } else {
            await logDispatch(r.id, ch, 'skipped', msg, 'channel not configured');
          }
        } catch (e) {
          await logDispatch(r.id, ch, 'failed', msg, e.message);
        }
      }
      dispatched++;

      // Advance the scheduler
      const { data: nextFire } = await supabaseAdmin.rpc('compute_next_fire_at', {
        p_times: r.times_of_day,
        p_from: new Date().toISOString(),
      });
      await supabaseAdmin
        .from('medication_reminders')
        .update({
          last_fired_at: new Date().toISOString(),
          next_fire_at:  nextFire || null,
        })
        .eq('id', r.id);
    }

    logger.info('postcare', 'tick processed', { count: due?.length || 0, dispatched });
    return { processed: due?.length || 0, dispatched };
  },

  async getDispatchLog(reminderId, actorId, role, { limit = 50 } = {}) {
    const { data: existing } = await supabaseAdmin
      .from('medication_reminders').select('owner_id').eq('id', reminderId).single();
    if (!existing) throw new Error('Reminder not found.');
    if (role === 'client' && existing.owner_id !== actorId) throw new Error('Access denied.');

    const { data, error } = await supabaseAdmin
      .from('reminder_dispatch_log')
      .select('*')
      .eq('reminder_id', reminderId)
      .order('fired_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
  },

};

async function logDispatch(reminderId, channel, status, message, error = null) {
  try {
    await supabaseAdmin.from('reminder_dispatch_log').insert({
      reminder_id: reminderId, channel, status, message, error,
    });
  } catch (_) {}
}

module.exports = postCareService;
