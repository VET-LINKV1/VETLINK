/**
 * medicalRecordService.js
 * Digital medical records — create, read, update with role-based access
 * AND enforced relational integrity (brief: user → pets → appointments → medical records).
 *
 * ACCESS:
 * - Vet:    create + edit own records (must have an appointment relationship to the pet, or pass an appointmentId they own)
 * - Client: read own pets' records (read-only)
 * - Admin/Staff: read all; admin may also create/edit
 */
const { supabaseAdmin } = require('../config/supabase');
const notificationService = require('./notificationService');
const logger = require('../utils/logger');

const medicalRecordService = {

  async create(actorId, payload, actorRole = 'veterinarian') {
    const {
      petId, appointmentId, visitDate, weightKg, temperatureC,
      diagnosis, treatment, prescription, notes, followUpDate,
    } = payload;

    if (!petId)     throw new Error('Pet ID is required.');
    if (!diagnosis) throw new Error('Diagnosis is required.');

    // Verify the pet exists (FK won't catch a typo until insert)
    const { data: pet } = await supabaseAdmin
      .from('pets').select('id, name, owner_id').eq('id', petId).single();
    if (!pet) throw new Error('Pet not found.');

    // Resolve the vet that the record will be attributed to.
    // For now, only the calling vet writes their own records (admins use actorRole=admin).
    const recordVetId = actorId;

    // ── Relational integrity check ──
    // A record must trace through an appointment-relationship for vets.
    // Admins can create records freely (e.g. data import / corrections).
    if (actorRole === 'veterinarian') {
      if (appointmentId) {
        // Strict: the appointment must belong to this vet
        const { data: appt } = await supabaseAdmin
          .from('appointments')
          .select('id, vet_id, pet_id, client_id, status, pets(name)')
          .eq('id', appointmentId).single();

        if (!appt)                              throw new Error('Appointment not found.');
        if (appt.vet_id  !== recordVetId)       throw new Error('You can only add records for your own appointments.');
        if (appt.pet_id  !== petId)             throw new Error('Pet does not match the appointment.');

        // Auto-complete the appointment if it's still open
        if (['confirmed', 'pending'].includes(appt.status)) {
          await supabaseAdmin.from('appointments').update({
            status:            'completed',
            completed_at:      new Date().toISOString(),
            status_updated_at: new Date().toISOString(),
          }).eq('id', appointmentId);

          if (appt.client_id) {
            await notificationService.create(appt.client_id, {
              title:   'Medical Record Available',
              message: `A medical record for ${appt.pets?.name || 'your pet'} is now available.`,
              type:    'info',
              link:    '/client/pets',
            });
          }
        }
      } else {
        // No appointment supplied → require at least one prior appointment (any status) with this pet
        const { data: priorAppts } = await supabaseAdmin
          .from('appointments')
          .select('id', { count: 'exact', head: false })
          .eq('vet_id', recordVetId)
          .eq('pet_id', petId)
          .limit(1);

        if (!priorAppts || priorAppts.length === 0) {
          throw new Error('You can only create medical records for pets you have an appointment with.');
        }
      }
    }

    const { data, error } = await supabaseAdmin
      .from('medical_records')
      .insert({
        pet_id:         petId,
        vet_id:         recordVetId,
        appointment_id: appointmentId || null,
        visit_date:     visitDate || new Date().toISOString().split('T')[0],
        weight_kg:      weightKg     ?? null,
        temperature_c:  temperatureC ?? null,
        diagnosis,
        treatment:      treatment    || null,
        prescription:   prescription || null,
        notes:          notes        || null,
        follow_up_date: followUpDate || null,
      })
      .select(`*, pets(id,name,species,breed), vet:users!medical_records_vet_id_fkey(id,name), appointments(id,type,appointment_at)`)
      .single();

    if (error) throw new Error('Failed to create record: ' + error.message);

    logger.info('medical_record.create', 'created', {
      recordId: data.id, petId, vetId: recordVetId, appointmentId: appointmentId || null,
    });

    // Notify pet owner (independent of appointment-link auto-notification)
    if (pet.owner_id && !appointmentId) {
      await notificationService.create(pet.owner_id, {
        title:   'Medical Record Available',
        message: `A new medical record for ${pet.name} is available.`,
        type:    'info',
        link:    '/client/pets',
      });
    }

    return data;
  },

  async getByPet(petId, userId, role) {
    if (role === 'client') {
      const { data: pet } = await supabaseAdmin
        .from('pets').select('owner_id').eq('id', petId).single();
      if (!pet || pet.owner_id !== userId) throw new Error('Access denied.');
    }

    const { data, error } = await supabaseAdmin
      .from('medical_records')
      .select(`*, pets(id,name,species,breed), vet:users!medical_records_vet_id_fkey(id,name,email), appointments(id,type,appointment_at)`)
      .eq('pet_id', petId)
      .order('visit_date', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async getById(recordId, userId, role) {
    const { data, error } = await supabaseAdmin
      .from('medical_records')
      .select(`*, pets(id,name,species,breed,age,gender,owner_id), vet:users!medical_records_vet_id_fkey(id,name,email), appointments(id,type,appointment_at,status)`)
      .eq('id', recordId).single();

    if (error || !data) throw new Error('Record not found.');
    if (role === 'client'       && data.pets?.owner_id !== userId) throw new Error('Access denied.');
    if (role === 'veterinarian' && data.vet_id !== userId)         throw new Error('Access denied.');
    return data;
  },

  async getByVet(vetId, filters = {}) {
    let query = supabaseAdmin
      .from('medical_records')
      .select(`*, pets(id,name,species,breed), appointments(id,type,appointment_at)`)
      .eq('vet_id', vetId)
      .order('visit_date', { ascending: false });

    if (filters.petId)     query = query.eq('pet_id', filters.petId);
    if (filters.startDate) query = query.gte('visit_date', filters.startDate);
    if (filters.endDate)   query = query.lte('visit_date', filters.endDate);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async update(recordId, vetId, payload) {
    const { data: existing } = await supabaseAdmin
      .from('medical_records').select('vet_id').eq('id', recordId).single();
    if (!existing)                  throw new Error('Record not found.');
    if (existing.vet_id !== vetId)  throw new Error('You can only edit your own records.');

    const fields = {
      diagnosis:      payload.diagnosis,
      treatment:      payload.treatment,
      prescription:   payload.prescription,
      notes:          payload.notes,
      follow_up_date: payload.followUpDate,
      weight_kg:      payload.weightKg,
      temperature_c:  payload.temperatureC,
      visit_date:     payload.visitDate,
    };
    const update = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));

    const { data, error } = await supabaseAdmin
      .from('medical_records').update(update).eq('id', recordId)
      .select(`*, pets(name), vet:users!medical_records_vet_id_fkey(name)`).single();
    if (error) throw new Error(error.message);
    return data;
  },

  async getClientHistory(clientId) {
    const { data: pets } = await supabaseAdmin
      .from('pets').select('id, name, species, breed').eq('owner_id', clientId);
    if (!pets?.length) return { pets: [], records: [] };

    const { data: records, error } = await supabaseAdmin
      .from('medical_records')
      .select(`*, pets(id,name,species,breed), vet:users!medical_records_vet_id_fkey(id,name), appointments(id,type,appointment_at)`)
      .in('pet_id', pets.map(p => p.id))
      .order('visit_date', { ascending: false });

    if (error) throw new Error(error.message);
    return { pets, records: records || [] };
  },

  async getAllForAdmin(filters = {}) {
    let query = supabaseAdmin
      .from('medical_records')
      .select(`*, pets(id,name,species,breed), vet:users!medical_records_vet_id_fkey(id,name), appointments(id,type,appointment_at)`)
      .order('visit_date', { ascending: false });

    if (filters.vetId)     query = query.eq('vet_id', filters.vetId);
    if (filters.petId)     query = query.eq('pet_id', filters.petId);
    if (filters.startDate) query = query.gte('visit_date', filters.startDate);
    if (filters.endDate)   query = query.lte('visit_date', filters.endDate);

    const { data, error } = await query.limit(100);
    if (error) throw new Error(error.message);
    return data || [];
  },
};

module.exports = medicalRecordService;
