const { supabaseAdmin } = require('../config/supabase');

const STAFF_ROLES = ['admin', 'veterinarian', 'staff'];

/**
 * Lightweight "list row" enrichment for the Admin Pet Records table.
 * Adds owner name/contact, assigned vet, last-visit date, vaccination
 * summary, and computed record status — without pulling every sub-table.
 */
async function enrichPetRow(pet) {
  const petId = pet.id;
  const [vax, lastVisit, appt] = await Promise.all([
    supabaseAdmin
      .from('passport_vaccination_status_v')
      .select('status').eq('pet_id', petId),
    supabaseAdmin
      .from('medical_records')
      .select('visit_date').eq('pet_id', petId)
      .order('visit_date', { ascending: false }).limit(1),
    supabaseAdmin
      .from('appointments')
      .select('vet:users!appointments_vet_id_fkey(name)').eq('pet_id', petId)
      .order('appointment_at', { ascending: false }).limit(1),
  ]);

  const vaxRows = vax?.data || [];
  const hasOverdue = vaxRows.some(v => v.status === 'overdue');
  const hasExpiring = vaxRows.some(v => v.status === 'expiring_soon' || v.status === 'scheduled');
  let vaccinationStatus = 'up_to_date';
  if (hasOverdue) vaccinationStatus = 'overdue';
  else if (hasExpiring) vaccinationStatus = 'expiring_soon';

  return {
    ...pet,
    ownerName: pet.owner?.name || null,
    ownerContact: pet.owner?.phone_number || pet.owner?.email || null,
    assignedVet: appt?.data?.[0]?.vet?.name || null,
    lastVisit: lastVisit?.data?.[0]?.visit_date || null,
    vaccinationStatus,
  };
}

const petService = {
  /**
   * Admin/staff/vet listing — clinic-wide, enriched for the table.
   * Supports server-side search + filters so the table stays fast.
   */
  async listForAdmin({ q, species, breed, gender, vaccinationStatus, vetName, branch,
                       registeredFrom, registeredTo, active, sort, dir, limit, offset } = {}) {
    let query = supabaseAdmin
      .from('pets')
      .select('*, owner:users!pets_owner_id_fkey(id, name, email, phone_number)')
      .order(sort || 'created_at', { ascending: (dir || 'desc') === 'asc' });

    if (q) query = query.or(`name.ilike.%${q}%,breed.ilike.%${q}%,owner.name.ilike.%${q}%`);
    if (species) query = query.eq('species', species);
    if (breed) query = query.eq('breed', breed);
    if (gender) query = query.eq('gender', gender);
    if (registeredFrom) query = query.gte('created_at', registeredFrom);
    if (registeredTo) query = query.lte('created_at', registeredTo);
    // Active/inactive: we treat pets with no completed visits in 18 months as "inactive".
    // (Simpler: a pet is inactive if it has no appointments at all — handled client-side for now.)
    if (typeof active === 'boolean') {
      // No hard `is_active` column on pets; filter by recent-visit presence.
      // Deferred to client enrichment because it needs the appointments join.
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    // Enrich each row (owner/last-visit/vax/vet).
    const rows = await Promise.all((data || []).map(enrichPetRow));

    // Post-filter (client-side) where a join filter is impractical in PostgREST:
    if (vaccinationStatus) {
      return { items: rows.filter(r => r.vaccinationStatus === vaccinationStatus), total: rows.length };
    }
    if (vetName) {
      return { items: rows.filter(r => r.assignedVet && r.assignedVet.toLowerCase().includes(vetName.toLowerCase())), total: rows.length };
    }
    if (typeof active === 'boolean') {
      return { items: rows.filter(r => (r.lastVisit != null) === active), total: rows.length };
    }

    return { items: rows, total: rows.length };
  },

  /**
   * Clinic-wide summary stats for the Admin Pet Records KPI cards.
   */
  async adminStats() {
    const [{ count: total }, all] = await Promise.all([
      supabaseAdmin.from('pets').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('pets').select('id, species, owner:users!pets_owner_id_fkey(id)'),
    ]);
    const pets = all?.data || [];
    const dogs = pets.filter(p => p.species === 'Dog').length;
    const cats = pets.filter(p => p.species === 'Cat').length;

    // Vaccination status — needs the passport view per pet.
    const petIds = pets.map(p => p.id);
    let dueCount = 0;
    let requiresAttention = 0;
    if (petIds.length) {
      const vax = await supabaseAdmin
        .from('passport_vaccination_status_v')
        .select('pet_id, status').in('pet_id', petIds);
      const byPet = {};
      for (const v of (vax?.data || [])) {
        byPet[v.pet_id] = byPet[v.pet_id] || new Set();
        byPet[v.pet_id].add(v.status);
      }
      for (const statuses of Object.values(byPet)) {
        if (statuses.has('overdue')) { dueCount++; requiresAttention++; }
        else if (statuses.has('expiring_soon') || statuses.has('scheduled')) dueCount++;
      }
    }

    // Active = had a visit in the last 18 months (best-effort using last appointment).
    let activeCount = 0;
    if (petIds.length) {
      const cutoff = new Date(Date.now() - 18 * 30 * 24 * 3600 * 1000).toISOString();
      const recent = await supabaseAdmin
        .from('appointments')
        .select('pet_id').in('pet_id', petIds).gte('appointment_at', cutoff);
      activeCount = new Set((recent?.data || []).map(r => r.pet_id)).size;
    }

    return {
      total: total || pets.length,
      active: activeCount,
      dogs,
      cats,
      vaccinationsDue: dueCount,
      requiresAttention,
    };
  },

  /**
   * Admin: fetch any pet's full record (no owner scoping).
   * Reuses the same 11-section composition as the client record.
   */
  async getRecordForStaff(petId) {
    const { data: pet, error: petErr } = await supabaseAdmin
      .from('pets')
      .select('*, owner:users!pets_owner_id_fkey(id, name, email, phone_number, address)')
      .eq('id', petId)
      .single();
    if (petErr || !pet) throw new Error('Pet not found.');

    const [vax, medRecs, rx, labFiles, intakeAllergies, weights, treatments, otherFiles, timeline, appointments, invoices] = await Promise.all([
      supabaseAdmin.from('passport_vaccination_status_v')
        .select('*').eq('pet_id', petId).order('due_date', { ascending: true, nullsFirst: false }),
      supabaseAdmin.from('medical_records')
        .select('id, visit_date, diagnosis, treatment, prescription, notes, follow_up_date, weight_kg, temperature_c, attachments, vet:users!medical_records_vet_id_fkey(name)')
        .eq('pet_id', petId).order('visit_date', { ascending: false }),
      supabaseAdmin.from('prescriptions')
        .select('id, medication_name, dosage, frequency, route, duration_days, start_date, end_date, status, refills_allowed, refills_used, instructions')
        .eq('pet_id', petId).order('start_date', { ascending: false }),
      supabaseAdmin.from('emr_files')
        .select('id, kind, title, description, mime_type, size_bytes, created_at, storage_path')
        .eq('pet_id', petId).eq('is_archived', false).eq('kind', 'lab_result')
        .order('created_at', { ascending: false }),
      supabaseAdmin.from('appointment_intakes')
        .select('allergies, submitted_at')
        .eq('pet_id', petId).not('allergies', 'is', null)
        .order('submitted_at', { ascending: false }).limit(5),
      supabaseAdmin.from('pet_weights')
        .select('id, weight_kg, body_condition_score, recorded_at, notes')
        .eq('pet_id', petId).order('recorded_at', { ascending: true }),
      supabaseAdmin.from('treatments')
        .select('id, name, description, performed_date, scheduled_date, status, outcome, cost_estimate')
        .eq('pet_id', petId).order('performed_date', { ascending: false, nullsLast: true }),
      supabaseAdmin.from('emr_files')
        .select('id, kind, title, description, mime_type, size_bytes, created_at, storage_path')
        .eq('pet_id', petId).eq('is_archived', false).neq('kind', 'lab_result')
        .order('created_at', { ascending: false }),
      supabaseAdmin.from('medical_timeline_v')
        .select('event_id, kind, occurred_at, summary, source_id, actor_id')
        .eq('pet_id', petId).order('occurred_at', { ascending: false }).limit(100),
      supabaseAdmin.from('appointments')
        .select('id, appointment_at, type, status, reason, vet:users!appointments_vet_id_fkey(name)')
        .eq('pet_id', petId).order('appointment_at', { ascending: false }).limit(20),
      supabaseAdmin.from('invoices')
        .select('id, amount, currency, status, issued_at, due_at')
        .eq('pet_id', petId).order('issued_at', { ascending: false }).limit(20),
    ]);

    const latestIntakeAllergy = intakeAllergies?.data?.[0]?.allergies || null;
    const allergies = latestIntakeAllergy || pet.notes || null;

    const completedVisits = medRecs?.data?.filter(r => r.vet).length || 0;
    const activeRx = rx?.data?.filter(p => p.status === 'active').length || 0;
    const overdueVax = vax?.data?.filter(v => v.status === 'overdue').length || 0;
    const upcomingVax = vax?.data?.filter(v => v.status === 'scheduled' && v.due_date).length || 0;

    const lastWeight = weights?.data || [];
    const billedTotal = (invoices?.data || [])
      .filter(i => i.status !== 'voided')
      .reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const unpaidTotal = (invoices?.data || [])
      .filter(i => i.status === 'issued' || i.status === 'pending')
      .reduce((s, i) => s + (Number(i.amount) || 0), 0);

    return {
      petProfile: pet,
      owner: pet.owner || null,
      healthOverview: {
        totalVisits: medRecs?.data?.length || 0,
        completedVisits,
        activePrescriptions: activeRx,
        overdueVaccinations: overdueVax,
        upcomingVaccinations: upcomingVax,
        currentWeight: pet.weight_kg,
        lastWeightDate: lastWeight.length ? lastWeight[lastWeight.length - 1].recorded_at : null,
        currentBCS: lastWeight.length ? lastWeight[lastWeight.length - 1].body_condition_score : null,
      },
      vaccinations: vax?.data || [],
      medicalHistory: medRecs?.data || [],
      prescriptions: rx?.data || [],
      labResults: labFiles?.data || [],
      allergies,
      weightHistory: weights?.data || [],
      treatments: treatments?.data || [],
      documents: otherFiles?.data || [],
      appointments: appointments?.data || [],
      billing: {
        invoices: invoices?.data || [],
        billedTotal,
        unpaidTotal,
        currency: invoices?.data?.[0]?.currency || 'PHP',
      },
      timeline: timeline?.data || [],
    };
  },

  /**
   * Admin/staff: register a pet for a specific owner (no owner scoping).
   * Note: microchip_no, date_of_birth, spay_neuter not yet in schema — stored in notes if provided.
   */
  async adminCreate(petData) {
    if (!petData.owner_id) throw new Error('Owner assignment is required.');
    const extraNotes = [];
    if (petData.microchip_no) extraNotes.push(`Microchip: ${petData.microchip_no}`);
    if (petData.date_of_birth) extraNotes.push(`DOB: ${petData.date_of_birth}`);
    if (petData.spay_neuter && petData.spay_neuter !== 'unknown') extraNotes.push(`Spay/Neuter: ${petData.spay_neuter}`);
    if (petData.emergency_name) extraNotes.push(`Emergency Contact: ${petData.emergency_name} ${petData.emergency_contact || ''}`);
    if (petData.allergies) extraNotes.push(`Allergies: ${petData.allergies}`);

    const notes = [petData.notes, ...extraNotes].filter(Boolean).join('\n');

    const { data, error } = await supabaseAdmin.from('pets').insert({
      owner_id:       petData.owner_id,
      name:           petData.name,
      species:        petData.species,
      breed:          petData.breed || null,
      age:            petData.age ? parseInt(petData.age, 10) : null,
      gender:         petData.gender || 'unknown',
      weight_kg:      petData.weight_kg ? parseFloat(petData.weight_kg) : null,
      color:          petData.color || null,
      notes:          notes || null,
    }).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Admin/staff: update any pet (no owner scoping).
   * Note: microchip_no, date_of_birth, spay_neuter not in schema yet — appended to notes.
   */
  async adminUpdate(petId, petData) {
    const patch = {};
    const map = {
      name: 'name', species: 'species', breed: 'breed', gender: 'gender',
      weight_kg: 'weight_kg', color: 'color',
    };
    for (const [k, col] of Object.entries(map)) {
      if (petData[k] !== undefined) {
        if (k === 'age') patch[col] = petData[k] ? parseInt(petData[k], 10) : null;
        else if (k === 'weight_kg') patch[col] = petData[k] ? parseFloat(petData[k]) : null;
        else patch[col] = petData[k] || null;
      }
    }
    // Non-schema fields (microchip, dob, spay/neuter, emergency, allergies) → store in notes.
    const extraNotes = [];
    if (petData.microchip_no) extraNotes.push(`Microchip: ${petData.microchip_no}`);
    if (petData.date_of_birth) extraNotes.push(`DOB: ${petData.date_of_birth}`);
    if (petData.spay_neuter && petData.spay_neuter !== 'unknown') extraNotes.push(`Spay/Neuter: ${petData.spay_neuter}`);
    if (petData.emergency_name) extraNotes.push(`Emergency Contact: ${petData.emergency_name} ${petData.emergency_contact || ''}`);
    if (petData.allergies) extraNotes.push(`Allergies: ${petData.allergies}`);
    if (extraNotes.length) {
      const base = petData.notes || '';
      patch.notes = [base, ...extraNotes].filter(Boolean).join('\n');
    } else if (petData.notes !== undefined) {
      patch.notes = petData.notes || null;
    }
    if (!Object.keys(patch).length) throw new Error('No fields to update.');
    const { data, error } = await supabaseAdmin.from('pets').update(patch).eq('id', petId).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Clients see only their own pets.
   * Vets/staff/admin see all (read-only).
   */
  async getAll(userId, role) {
    let query = supabaseAdmin
      .from('pets')
      .select('*, owner:users!pets_owner_id_fkey(id, name, email, phone_number)')
      .order('created_at', { ascending: false });
    if (role === 'client' || !role) query = query.eq('owner_id', userId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  },

  async create(userId, petData) {
    const { data, error } = await supabaseAdmin.from('pets').insert({
      owner_id:  userId,
      name:      petData.name,
      species:   petData.species,
      breed:     petData.breed || null,
      age:       petData.age ? parseInt(petData.age, 10) : null,
      gender:    petData.gender || 'unknown',
      weight_kg: petData.weight_kg ? parseFloat(petData.weight_kg) : null,
      notes:     petData.notes || null,
    }).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async update(userId, petId, petData) {
    // Verify ownership first
    const { data: existing } = await supabaseAdmin
      .from('pets').select('id').eq('id', petId).eq('owner_id', userId).single();
    if (!existing) throw new Error('Pet not found or access denied');

    const updatePatch = {};
    if (petData.name      !== undefined) updatePatch.name      = petData.name;
    if (petData.species   !== undefined) updatePatch.species   = petData.species;
    if (petData.breed     !== undefined) updatePatch.breed     = petData.breed || null;
    if (petData.age       !== undefined) updatePatch.age       = petData.age ? parseInt(petData.age, 10) : null;
    if (petData.gender    !== undefined) updatePatch.gender    = petData.gender;
    if (petData.weight_kg !== undefined) updatePatch.weight_kg = petData.weight_kg ? parseFloat(petData.weight_kg) : null;
    if (petData.notes     !== undefined) updatePatch.notes     = petData.notes || null;

    const { data, error } = await supabaseAdmin.from('pets').update(updatePatch).eq('id', petId).select().single();
    if (error) throw new Error(error.message);
    return data;
  },
};

module.exports = petService;
