/**
 * emrService.js
 * Advanced EMR (Electronic Medical Records) service.
 *
 * Aggregates SOAP notes, vaccinations, prescriptions, treatments
 * and file metadata into a single per-pet view, and exposes the
 * unified medical_timeline_v.
 *
 * Role rules:
 *   - admin / veterinarian / staff:  read everything
 *   - admin / veterinarian:          write (create/update/delete)
 *   - staff:                         read-only by default; can upload files
 *   - client:                        read-only, restricted to their own pets
 *
 * The Express layer guards via roleMiddleware; this service also
 * defends in depth so a misconfigured route can't leak data.
 */
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

const STAFF_ROLES = ['admin', 'veterinarian', 'staff'];
const WRITE_ROLES = ['admin', 'veterinarian'];

function assertCanRead(role) {
  if (![...STAFF_ROLES, 'client'].includes(role)) {
    throw new Error('Access denied.');
  }
}
function assertCanWrite(role) {
  if (!WRITE_ROLES.includes(role)) throw new Error('Access denied: write requires admin or veterinarian.');
}
function assertStaff(role) {
  if (!STAFF_ROLES.includes(role)) throw new Error('Access denied.');
}

/**
 * Throws unless the caller is allowed to view this pet's chart.
 * Clients are only allowed if they own the pet.
 */
async function assertPetVisible(petId, userId, role) {
  assertCanRead(role);
  const { data: pet, error } = await supabaseAdmin
    .from('pets')
    .select('id, owner_id, name, species, breed, age, gender, weight_kg, color, notes')
    .eq('id', petId)
    .single();
  if (error || !pet) throw new Error('Pet not found.');
  if (role === 'client' && pet.owner_id !== userId) {
    throw new Error('Access denied: not your pet.');
  }
  return pet;
}

const emrService = {

  /* ─────────────────────────── PETS ─────────────────────────── */

  /**
   * List every pet the caller can see, grouped by their owner
   * (client). Staff see all clients; clients see only their own.
   * Used by the EMR "client → pets" navigator.
   */
  async listClientsWithPets(userId, role) {
    assertCanRead(role);

    const baseQ = supabaseAdmin
      .from('users')
      .select('id, name, email, phone_number, pets:pets(id, name, species, breed, age, gender, weight_kg, color)')
      .eq('role', 'client')
      .order('name', { ascending: true });

    const { data, error } = role === 'client'
      ? await baseQ.eq('id', userId)
      : await baseQ;

    if (error) throw new Error(error.message);
    // Drop clients with no pets to keep the list compact for staff.
    return (data || []).filter(c => c.pets && c.pets.length > 0);
  },

  async getPet(petId, userId, role) {
    return assertPetVisible(petId, userId, role);
  },


  /* ─────────────────────────── TIMELINE ───────────────────────── */

  /**
   * Returns the unified per-pet event stream from medical_timeline_v.
   * Supports kind filtering (?kind=visit,vaccination) and pagination.
   */
  async getPetTimeline(petId, userId, role, { kinds, limit = 100, offset = 0 } = {}) {
    await assertPetVisible(petId, userId, role);

    let q = supabaseAdmin
      .from('medical_timeline_v')
      .select('*')
      .eq('pet_id', petId)
      .order('occurred_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (Array.isArray(kinds) && kinds.length > 0) {
      q = q.in('kind', kinds);
    }

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
  },

  /**
   * Aggregated chart snapshot for the EMR dashboard:
   *   pet, recent SOAPs, active prescriptions, due/overdue vaccinations,
   *   open treatments, latest files.
   */
  async getPetChart(petId, userId, role) {
    const pet = await assertPetVisible(petId, userId, role);

    // Refresh overdue vaccination statuses opportunistically.
    try { await supabaseAdmin.rpc('mark_overdue_vaccinations'); } catch (_) {}

    const owner = await supabaseAdmin
      .from('users')
      .select('id, name, email, phone_number')
      .eq('id', pet.owner_id)
      .single();

    const [records, soaps, vax, rx, tx, files] = await Promise.all([
      supabaseAdmin.from('medical_records')
        .select('id, visit_date, diagnosis, treatment, prescription, notes, follow_up_date, vet_id')
        .eq('pet_id', petId).order('visit_date', { ascending: false }).limit(10),
      supabaseAdmin.from('soap_notes')
        .select('id, medical_record_id, subjective, objective, assessment, plan, vet_id, created_at')
        .eq('pet_id', petId).order('created_at', { ascending: false }).limit(5),
      supabaseAdmin.from('vaccinations')
        .select('*').eq('pet_id', petId).order('due_date', { ascending: true, nullsFirst: false }),
      supabaseAdmin.from('prescriptions')
        .select('*').eq('pet_id', petId).order('start_date', { ascending: false }),
      supabaseAdmin.from('treatments')
        .select('*').eq('pet_id', petId).order('performed_date', { ascending: false, nullsFirst: false }),
      supabaseAdmin.from('emr_files')
        .select('*').eq('pet_id', petId).eq('is_archived', false).order('created_at', { ascending: false }).limit(20),
    ]);

    return {
      pet,
      owner: owner?.data || null,
      recentRecords: records?.data || [],
      recentSoapNotes: soaps?.data || [],
      vaccinations: vax?.data || [],
      prescriptions: rx?.data || [],
      treatments: tx?.data || [],
      files: files?.data || [],
    };
  },


  /* ─────────────────────────── SOAP NOTES ─────────────────────── */

  async createSoapNote(actorId, role, payload) {
    assertCanWrite(role);
    const { medicalRecordId, subjective, objective, assessment, plan } = payload;
    if (!medicalRecordId) throw new Error('medicalRecordId is required.');

    // Look up the parent record to derive pet_id (single source of truth).
    const { data: rec, error: recErr } = await supabaseAdmin
      .from('medical_records').select('id, pet_id, vet_id').eq('id', medicalRecordId).single();
    if (recErr || !rec) throw new Error('Medical record not found.');

    // Vets may only attach SOAP notes to their own records; admin overrides.
    if (role === 'veterinarian' && rec.vet_id !== actorId) {
      throw new Error('You can only add SOAP notes to your own medical records.');
    }

    const { data, error } = await supabaseAdmin
      .from('soap_notes')
      .insert({
        medical_record_id: medicalRecordId,
        pet_id:            rec.pet_id,
        vet_id:            rec.vet_id,
        subjective, objective, assessment, plan,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    logger.info('emr', 'soap_note.created', { id: data.id, by: actorId });
    return data;
  },

  async updateSoapNote(id, actorId, role, payload) {
    assertCanWrite(role);
    const { data: existing } = await supabaseAdmin
      .from('soap_notes').select('id, vet_id').eq('id', id).single();
    if (!existing) throw new Error('SOAP note not found.');
    if (role === 'veterinarian' && existing.vet_id !== actorId) {
      throw new Error('You can only edit your own SOAP notes.');
    }

    const allowed = ['subjective', 'objective', 'assessment', 'plan'];
    const update = Object.fromEntries(allowed
      .filter(k => k in payload)
      .map(k => [k, payload[k]]));
    if (Object.keys(update).length === 0) throw new Error('Nothing to update.');

    const { data, error } = await supabaseAdmin
      .from('soap_notes').update(update).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async deleteSoapNote(id, actorId, role) {
    assertCanWrite(role);
    const { data: existing } = await supabaseAdmin
      .from('soap_notes').select('id, vet_id').eq('id', id).single();
    if (!existing) throw new Error('SOAP note not found.');
    if (role === 'veterinarian' && existing.vet_id !== actorId) {
      throw new Error('You can only delete your own SOAP notes.');
    }
    const { error } = await supabaseAdmin.from('soap_notes').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { deleted: true };
  },


  /* ─────────────────────────── VACCINATIONS ───────────────────── */

  async listVaccinationsByPet(petId, userId, role) {
    await assertPetVisible(petId, userId, role);
    try { await supabaseAdmin.rpc('mark_overdue_vaccinations'); } catch (_) {}
    const { data, error } = await supabaseAdmin
      .from('vaccinations').select('*')
      .eq('pet_id', petId)
      .order('due_date', { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  /** All vaccinations due (or overdue) within `daysAhead` days — used for reminders dashboards. */
  async listUpcomingVaccinations(userId, role, { daysAhead = 30 } = {}) {
    assertStaff(role);
    const today = new Date();
    const horizon = new Date(today.getTime() + daysAhead * 86400000);

    const { data, error } = await supabaseAdmin
      .from('vaccinations')
      .select('id, pet_id, vaccine_name, due_date, status, pets(id, name, owner_id, users:users!pets_owner_id_fkey(id, name, email, phone_number))')
      .or('status.eq.scheduled,status.eq.overdue')
      .not('due_date', 'is', null)
      .lte('due_date', horizon.toISOString().slice(0, 10))
      .order('due_date', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async createVaccination(actorId, role, payload) {
    assertCanWrite(role);
    const {
      petId, vaccineName, manufacturer, batchNumber, dose,
      administeredDate, dueDate, status, notes, medicalRecordId,
    } = payload;
    if (!petId || !vaccineName) throw new Error('petId and vaccineName are required.');

    const finalStatus = status || (administeredDate ? 'administered' : 'scheduled');

    const { data, error } = await supabaseAdmin
      .from('vaccinations').insert({
        pet_id:            petId,
        vet_id:            actorId,
        medical_record_id: medicalRecordId || null,
        vaccine_name:      vaccineName,
        manufacturer:      manufacturer || null,
        batch_number:      batchNumber  || null,
        dose:              dose         || null,
        administered_date: administeredDate || null,
        due_date:          dueDate          || null,
        status:            finalStatus,
        notes:             notes || null,
      }).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async updateVaccination(id, actorId, role, payload) {
    assertCanWrite(role);
    const map = {
      vaccineName:      'vaccine_name',
      manufacturer:     'manufacturer',
      batchNumber:      'batch_number',
      dose:             'dose',
      administeredDate: 'administered_date',
      dueDate:          'due_date',
      status:           'status',
      notes:            'notes',
    };
    const update = {};
    for (const [k, col] of Object.entries(map)) {
      if (k in payload) update[col] = payload[k];
    }
    if ('administered_date' in update && update.administered_date && !('status' in update)) {
      update.status = 'administered';
    }
    if (Object.keys(update).length === 0) throw new Error('Nothing to update.');

    const { data, error } = await supabaseAdmin
      .from('vaccinations').update(update).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async deleteVaccination(id, role) {
    assertCanWrite(role);
    const { error } = await supabaseAdmin.from('vaccinations').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { deleted: true };
  },


  /* ─────────────────────────── PRESCRIPTIONS ──────────────────── */

  async listPrescriptionsByPet(petId, userId, role) {
    await assertPetVisible(petId, userId, role);
    const { data, error } = await supabaseAdmin
      .from('prescriptions').select('*').eq('pet_id', petId)
      .order('start_date', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async createPrescription(actorId, role, payload) {
    assertCanWrite(role);
    const required = ['petId', 'medicationName', 'dosage', 'frequency'];
    for (const k of required) if (!payload[k]) throw new Error(`${k} is required.`);

    const insert = {
      pet_id:            payload.petId,
      vet_id:            actorId,
      medical_record_id: payload.medicalRecordId || null,
      medication_name:   payload.medicationName,
      dosage:            payload.dosage,
      frequency:         payload.frequency,
      route:             payload.route || null,
      duration_days:     payload.durationDays || null,
      refills_allowed:   payload.refillsAllowed ?? 0,
      start_date:        payload.startDate || new Date().toISOString().slice(0, 10),
      end_date:          payload.endDate || null,
      status:            payload.status || 'active',
      instructions:      payload.instructions || null,
    };

    const { data, error } = await supabaseAdmin
      .from('prescriptions').insert(insert).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async updatePrescription(id, role, payload) {
    assertCanWrite(role);
    const map = {
      medicationName: 'medication_name',
      dosage:         'dosage',
      frequency:      'frequency',
      route:          'route',
      durationDays:   'duration_days',
      refillsAllowed: 'refills_allowed',
      refillsUsed:    'refills_used',
      startDate:      'start_date',
      endDate:        'end_date',
      status:         'status',
      instructions:   'instructions',
    };
    const update = {};
    for (const [k, col] of Object.entries(map)) {
      if (k in payload) update[col] = payload[k];
    }
    if (Object.keys(update).length === 0) throw new Error('Nothing to update.');

    const { data, error } = await supabaseAdmin
      .from('prescriptions').update(update).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async refillPrescription(id, role) {
    assertCanWrite(role);
    const { data: rx } = await supabaseAdmin
      .from('prescriptions').select('refills_allowed, refills_used, status').eq('id', id).single();
    if (!rx) throw new Error('Prescription not found.');
    if (rx.status !== 'active') throw new Error('Only active prescriptions can be refilled.');
    if (rx.refills_used >= rx.refills_allowed) throw new Error('No refills remaining.');

    const { data, error } = await supabaseAdmin
      .from('prescriptions')
      .update({ refills_used: rx.refills_used + 1 })
      .eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async deletePrescription(id, role) {
    assertCanWrite(role);
    const { error } = await supabaseAdmin.from('prescriptions').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { deleted: true };
  },


  /* ─────────────────────────── TREATMENTS ─────────────────────── */

  async listTreatmentsByPet(petId, userId, role) {
    await assertPetVisible(petId, userId, role);
    const { data, error } = await supabaseAdmin
      .from('treatments').select('*').eq('pet_id', petId)
      .order('performed_date', { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async createTreatment(actorId, role, payload) {
    assertCanWrite(role);
    if (!payload.petId || !payload.name) throw new Error('petId and name are required.');

    const insert = {
      pet_id:            payload.petId,
      vet_id:            actorId,
      medical_record_id: payload.medicalRecordId || null,
      name:              payload.name,
      description:       payload.description || null,
      performed_date:    payload.performedDate || null,
      scheduled_date:    payload.scheduledDate || null,
      status:            payload.status || 'planned',
      outcome:           payload.outcome || null,
      cost_estimate:     payload.costEstimate || null,
    };
    const { data, error } = await supabaseAdmin
      .from('treatments').insert(insert).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async updateTreatment(id, role, payload) {
    assertCanWrite(role);
    const map = {
      name:           'name',
      description:    'description',
      performedDate:  'performed_date',
      scheduledDate:  'scheduled_date',
      status:         'status',
      outcome:        'outcome',
      costEstimate:   'cost_estimate',
    };
    const update = {};
    for (const [k, col] of Object.entries(map)) {
      if (k in payload) update[col] = payload[k];
    }
    if (Object.keys(update).length === 0) throw new Error('Nothing to update.');

    const { data, error } = await supabaseAdmin
      .from('treatments').update(update).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async deleteTreatment(id, role) {
    assertCanWrite(role);
    const { error } = await supabaseAdmin.from('treatments').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { deleted: true };
  },


  /* ─────────────────────────── SEARCH ─────────────────────────── */

  /**
   * Cross-record search. Searches diagnosis / SOAP fields /
   * prescription names / file titles. Returns hits keyed by entity.
   *
   * Clients are limited to their own pets; staff see everything.
   */
  async search(userId, role, { q, petId, kinds, limit = 25 } = {}) {
    assertCanRead(role);
    if (!q || q.trim().length < 2) throw new Error('Search term must be at least 2 characters.');
    const term  = q.trim();
    const ilike = `%${term}%`;

    const allowedKinds = kinds && kinds.length
      ? new Set(kinds)
      : new Set(['record', 'soap', 'prescription', 'treatment', 'file']);

    // Pet scope: if client, we restrict to their pets; if petId is supplied, restrict further.
    let petScope = null;
    if (role === 'client') {
      const { data: pets } = await supabaseAdmin
        .from('pets').select('id').eq('owner_id', userId);
      petScope = (pets || []).map(p => p.id);
      if (petScope.length === 0) return { records: [], soap: [], prescriptions: [], treatments: [], files: [] };
    }
    if (petId) petScope = (petScope || []).length ? petScope.filter(p => p === petId) : [petId];

    function scope(q) {
      if (petScope && petScope.length) return q.in('pet_id', petScope);
      return q;
    }

    const results = await Promise.all([
      allowedKinds.has('record')
        ? scope(supabaseAdmin.from('medical_records')
            .select('id, pet_id, visit_date, diagnosis, treatment, notes')
            .or(`diagnosis.ilike.${ilike},treatment.ilike.${ilike},notes.ilike.${ilike}`)
            .order('visit_date', { ascending: false }).limit(limit))
        : Promise.resolve({ data: [] }),

      allowedKinds.has('soap')
        ? scope(supabaseAdmin.from('soap_notes')
            .select('id, pet_id, medical_record_id, subjective, objective, assessment, plan, created_at')
            .or(`subjective.ilike.${ilike},objective.ilike.${ilike},assessment.ilike.${ilike},plan.ilike.${ilike}`)
            .order('created_at', { ascending: false }).limit(limit))
        : Promise.resolve({ data: [] }),

      allowedKinds.has('prescription')
        ? scope(supabaseAdmin.from('prescriptions')
            .select('id, pet_id, medication_name, dosage, frequency, status, start_date')
            .or(`medication_name.ilike.${ilike},instructions.ilike.${ilike}`)
            .order('start_date', { ascending: false }).limit(limit))
        : Promise.resolve({ data: [] }),

      allowedKinds.has('treatment')
        ? scope(supabaseAdmin.from('treatments')
            .select('id, pet_id, name, description, status, performed_date')
            .or(`name.ilike.${ilike},description.ilike.${ilike},outcome.ilike.${ilike}`)
            .order('performed_date', { ascending: false, nullsFirst: false }).limit(limit))
        : Promise.resolve({ data: [] }),

      allowedKinds.has('file')
        ? scope(supabaseAdmin.from('emr_files')
            .select('id, pet_id, kind, title, description, mime_type, created_at')
            .eq('is_archived', false)
            .or(`title.ilike.${ilike},description.ilike.${ilike}`)
            .order('created_at', { ascending: false }).limit(limit))
        : Promise.resolve({ data: [] }),
    ]);

    return {
      records:       results[0].data || [],
      soap:          results[1].data || [],
      prescriptions: results[2].data || [],
      treatments:    results[3].data || [],
      files:         results[4].data || [],
    };
  },

};

module.exports = emrService;
