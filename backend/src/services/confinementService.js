/**
 * confinementService.js
 *
 * Pet Confinement / Boarding & Hospitalization.
 *
 * Tracks pets staying at the clinic rather than going home the same
 * day -- boarding, post-op recovery, observation, IV therapy, etc.
 * Staff/vet admit a pet, add monitoring log entries while it's
 * confined, and discharge it when ready. Clients can see their own
 * pet's confinement status and log history, read-only.
 *
 * Role rules:
 *   admin / vet / staff  full read/write (admit, log, discharge)
 *   client                read own pets' confinements + logs only
 */
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

let notificationService = null;
try { notificationService = require('./notificationService'); } catch (_) {}

const STAFF_ROLES = ['admin', 'veterinarian', 'staff'];

function assertStaff(role) {
  if (!STAFF_ROLES.includes(role)) throw new Error('Access denied.');
}

async function assertPetVisible(petId, userId, role) {
  if (!STAFF_ROLES.includes(role) && role !== 'client') throw new Error('Access denied.');
  const { data: pet } = await supabaseAdmin
    .from('pets').select('id, owner_id, name').eq('id', petId).single();
  if (!pet) throw new Error('Pet not found.');
  if (role === 'client' && pet.owner_id !== userId) throw new Error('Access denied: not your pet.');
  return pet;
}

async function getConfinementRow(id) {
  const { data, error } = await supabaseAdmin
    .from('v_confinement_list').select('*').eq('id', id).single();
  if (error || !data) throw new Error('Confinement record not found.');
  return data;
}

function assertConfinementVisible(conf, userId, role) {
  if (STAFF_ROLES.includes(role)) return;
  if (role === 'client' && conf.client_id === userId) return;
  throw new Error('Access denied.');
}

const confinementService = {

  /* ──────────────────────────────────────────────────────────────
   * LISTING
   * ──────────────────────────────────────────────────────────── */

  /**
   * List confinements. Staff/vet/admin see the whole clinic;
   * clients see only their own pets'.
   */
  async list(actorId, role, { status, petId } = {}) {
    let q = supabaseAdmin.from('v_confinement_list').select('*')
      .order('admitted_at', { ascending: false });

    if (role === 'client') {
      q = q.eq('client_id', actorId);
    } else {
      assertStaff(role);
    }
    if (status)  q = q.eq('status', status);
    if (petId)   q = q.eq('pet_id', petId);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async listForPet(petId, actorId, role) {
    await assertPetVisible(petId, actorId, role);
    const { data, error } = await supabaseAdmin
      .from('v_confinement_list').select('*')
      .eq('pet_id', petId)
      .order('admitted_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getById(id, actorId, role) {
    const conf = await getConfinementRow(id);
    assertConfinementVisible(conf, actorId, role);
    return conf;
  },

  /* ──────────────────────────────────────────────────────────────
   * ADMIT / UPDATE / DISCHARGE
   * ──────────────────────────────────────────────────────────── */

  async admit(actorId, role, payload) {
    assertStaff(role);
    const { petId, vetId, appointmentId, location, reason, expectedDischargeAt } = payload;

    const { data: pet } = await supabaseAdmin
      .from('pets').select('id, owner_id, name').eq('id', petId).single();
    if (!pet) throw new Error('Pet not found.');

    const { data: existingActive } = await supabaseAdmin
      .from('confinements').select('id').eq('pet_id', petId).eq('status', 'active').maybeSingle();
    if (existingActive) throw new Error(`${pet.name} already has an active confinement.`);

    const { data: inserted, error } = await supabaseAdmin
      .from('confinements')
      .insert({
        pet_id:                petId,
        client_id:             pet.owner_id,
        vet_id:                vetId || null,
        appointment_id:        appointmentId || null,
        location:              location || null,
        reason,
        expected_discharge_at: expectedDischargeAt || null,
        admitted_by:           actorId,
      })
      .select('id').single();
    if (error) throw new Error(error.message);

    if (notificationService) {
      try {
        await notificationService.create(pet.owner_id, {
          title:   `${pet.name} has been admitted for confinement`,
          message: reason,
          type:    'info',
          link:    '/client/pets',
        });
      } catch (_) {}
    }

    return getConfinementRow(inserted.id);
  },

  async update(actorId, role, id, payload) {
    assertStaff(role);
    const { data: current } = await supabaseAdmin
      .from('confinements').select('id, status').eq('id', id).single();
    if (!current) throw new Error('Confinement record not found.');
    if (current.status !== 'active') throw new Error('Only an active confinement can be edited.');

    const patch = {};
    if (payload.vetId !== undefined)               patch.vet_id = payload.vetId || null;
    if (payload.location !== undefined)            patch.location = payload.location || null;
    if (payload.reason !== undefined)              patch.reason = payload.reason;
    if (payload.expectedDischargeAt !== undefined) patch.expected_discharge_at = payload.expectedDischargeAt || null;

    if (Object.keys(patch).length === 0) throw new Error('Nothing to update.');

    const { error } = await supabaseAdmin.from('confinements').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
    return getConfinementRow(id);
  },

  async discharge(actorId, role, id, { dischargeNotes } = {}) {
    assertStaff(role);
    const { data: current } = await supabaseAdmin
      .from('confinements').select('id, pet_id, client_id, status').eq('id', id).single();
    if (!current) throw new Error('Confinement record not found.');
    if (current.status !== 'active') throw new Error('Only an active confinement can be discharged.');

    const { error } = await supabaseAdmin.from('confinements').update({
      status:           'discharged',
      discharged_at:    new Date().toISOString(),
      discharge_notes:  dischargeNotes || null,
      discharged_by:    actorId,
    }).eq('id', id);
    if (error) throw new Error(error.message);

    if (notificationService) {
      try {
        const { data: pet } = await supabaseAdmin.from('pets').select('name').eq('id', current.pet_id).single();
        await notificationService.create(current.client_id, {
          title:   `${pet?.name || 'Your pet'} has been discharged`,
          message: dischargeNotes || 'Ready to go home.',
          type:    'success',
          link:    '/client/pets',
        });
      } catch (_) {}
    }

    return getConfinementRow(id);
  },

  async cancel(actorId, role, id, { reason } = {}) {
    assertStaff(role);
    const { data: current } = await supabaseAdmin
      .from('confinements').select('id, status').eq('id', id).single();
    if (!current) throw new Error('Confinement record not found.');
    if (current.status !== 'active') throw new Error('Only an active confinement can be cancelled.');

    const { error } = await supabaseAdmin.from('confinements').update({
      status:          'cancelled',
      discharged_at:   new Date().toISOString(),
      discharge_notes: reason || null,
      discharged_by:   actorId,
    }).eq('id', id);
    if (error) throw new Error(error.message);
    return getConfinementRow(id);
  },

  /* ──────────────────────────────────────────────────────────────
   * MONITORING LOGS
   * ──────────────────────────────────────────────────────────── */

  async listLogs(confinementId, actorId, role) {
    const conf = await getConfinementRow(confinementId);
    assertConfinementVisible(conf, actorId, role);

    const { data, error } = await supabaseAdmin
      .from('confinement_logs')
      .select('*, logger:users!confinement_logs_logged_by_fkey(id, name)')
      .eq('confinement_id', confinementId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async addLog(actorId, role, confinementId, payload) {
    assertStaff(role);
    const { data: conf } = await supabaseAdmin
      .from('confinements').select('id, status').eq('id', confinementId).single();
    if (!conf) throw new Error('Confinement record not found.');

    const { data: log, error } = await supabaseAdmin
      .from('confinement_logs')
      .insert({
        confinement_id:   confinementId,
        logged_by:        actorId,
        note:             payload.note || null,
        temperature_c:    payload.temperatureC ?? null,
        heart_rate_bpm:   payload.heartRateBpm ?? null,
        respiration_rate: payload.respirationRate ?? null,
        weight_kg:        payload.weightKg ?? null,
      })
      .select('*, logger:users!confinement_logs_logged_by_fkey(id, name)')
      .single();
    if (error) throw new Error(error.message);
    return log;
  },

};

module.exports = confinementService;
