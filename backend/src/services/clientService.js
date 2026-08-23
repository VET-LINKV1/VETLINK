const { supabase, supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

const clientService = {
  async register({ name, email, password, contactNumber, address, pet }) {
    // Pre-flight duplicate check
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (existing) throw new Error('An account with this email already exists.');

    // 1. Create Supabase Auth user (email pre-confirmed)
    const createPayload = { email, password, email_confirm: true };
    if (contactNumber) {
      createPayload.phone = contactNumber;
      createPayload.phone_confirm = true;
    }
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser(createPayload);
    if (authError) throw new Error(authError.message);

    const userId = authData.user?.id;
    if (!userId) throw new Error('Registration failed — no user ID returned.');

    logger.auth('client.register: auth user created', { userId, email });

    // 2. Insert profile — schema column is `phone_number`, NOT contact_number
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id:           userId,
        email,
        name,
        role:         'client',
        phone_number: contactNumber || null,
        address:      address || null,
        is_verified:  true,
        is_active:    true,
      });
    if (profileError) {
      // Rollback the auth user so it's not half-created
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      throw new Error('Failed to create user profile: ' + profileError.message);
    }

    // 3. Insert pet if provided (non-fatal)
    let petRecord = null;
    if (pet?.name && pet?.species) {
      const { data: petData, error: petError } = await supabaseAdmin
        .from('pets')
        .insert({
          owner_id: userId,
          name:     pet.name,
          species:  pet.species,
          breed:    pet.breed || null,
          age:      pet.age ? parseInt(pet.age, 10) : null,
          gender:   pet.gender || 'unknown',
        })
        .select()
        .single();
      if (petError) logger.warn('client.register', 'Pet insert failed', { msg: petError.message });
      else petRecord = petData;
    }

    // 4. Sign in to get session
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (loginError) throw new Error('Account created but auto-login failed: ' + loginError.message);

    const profile = {
      id:            userId,
      email,
      name,
      role:          'client',
      phone_number:  contactNumber || null,
      address:       address || null,
      avatar_url:    null,
    };

    return {
      session: {
        accessToken:  loginData.session.access_token,
        refreshToken: loginData.session.refresh_token,
        expiresAt:    loginData.session.expires_at,
      },
      user: profile,
      pet:  petRecord,
    };
  },

  /**
   * Enriched client dashboard payload.
   *
   * Composes everything the Pet Owner dashboard needs into a single
   * response keyed off the owner's pets:
   *   - pets            (all owned pets, newest first)
   *   - appointments    (recent, newest first)
   *   - per-pet detail  (weight series, vaccinations, prescriptions, lab results)
   *   - notifications   (recent, newest first)
   *   - reminders       (active vax/deworming grouped by pet)
   *   - clinic          (static clinic contact info)
   *
   * Every pet-specific sub-query is scoped to pets the user owns so a
   * client can never read another owner's data.
   */
  async getDashboard(userId) {
    // Refresh overdue vaccination statuses opportunistically.
    try { await supabaseAdmin.rpc('mark_overdue_vaccinations'); } catch (_) {}

    const [petsRes, appointmentsRes] = await Promise.all([
      supabaseAdmin.from('pets').select('*').eq('owner_id', userId).order('created_at', { ascending: false }),
      supabaseAdmin.from('appointments').select('*, pets(name, species, breed)').eq('client_id', userId).order('created_at', { ascending: false }).limit(10),
    ]);

    const pets = petsRes.data || [];
    const appointments = appointmentsRes.data || [];

    const stats = {
      totalPets: pets.length,
      upcomingAppointments: appointments.filter(a => a.status === 'pending' || a.status === 'confirmed').length,
      completedVisits: appointments.filter(a => a.status === 'completed').length,
    };

    // Per-pet detail only matters when the owner has pets.
    const petDetails = {};
    if (pets.length) {
      const petIds = pets.map(p => p.id);
      const [weights, vax, rx, labs] = await Promise.all([
        supabaseAdmin.from('pet_weights')
          .select('id, pet_id, weight_kg, body_condition_score, recorded_at, notes')
          .in('pet_id', petIds).order('recorded_at', { ascending: true }),
        supabaseAdmin.from('passport_vaccination_status_v')
          .select('*').in('pet_id', petIds).order('due_date', { ascending: true, nullsFirst: false }),
        supabaseAdmin.from('prescriptions')
          .select('id, pet_id, medication_name, dosage, frequency, route, start_date, end_date, status, instructions')
          .in('pet_id', petIds).order('start_date', { ascending: false }),
        supabaseAdmin.from('emr_files')
          .select('id, pet_id, kind, title, description, mime_type, created_at')
          .eq('is_archived', false).eq('kind', 'lab_result').in('pet_id', petIds)
          .order('created_at', { ascending: false }).limit(20),
      ]);

      for (const petId of petIds) {
        petDetails[petId] = {
          weights: (weights?.data || []).filter(w => w.pet_id === petId),
          vaccinations: (vax?.data || []).filter(v => v.pet_id === petId),
          prescriptions: (rx?.data || []).filter(r => r.pet_id === petId && r.status === 'active'),
          labResults: (labs?.data || []).filter(l => l.pet_id === petId),
        };
      }
    }

    // Notifications (recent) + unread count.
    const [notifRes, reminderByPet] = await Promise.all([
      supabaseAdmin.from('notifications')
        .select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
      this._loadReminders(userId),
    ]);

    const notifications = notifRes.data || [];
    const unreadCount = notifications.filter(n => !n.is_read).length;

    return {
      pets,
      appointments,
      stats,
      petDetails,
      notifications,
      unreadCount,
      reminders: reminderByPet,
      clinic: this._clinicInfo(),
    };
  },

  /**
   * Active vaccination & deworming reminders grouped by pet.
   * Delegates to the reminder service's grouping logic.
   */
  async _loadReminders(userId) {
    try {
      const { reminderService } = require('../services/reminderService');
      return await reminderService.listForOwner(userId, userId, 'client', { daysAhead: 90 });
    } catch (_) {
      return [];
    }
  },

  /**
   * Static clinic contact information for the dashboard "Clinic Information"
   * section. Centralized here so it can be promoted to a DB-backed setting
   * later without touching the frontend.
   */
  _clinicInfo() {
    return {
      name:    'Pet Healthcare Veterinary Clinic',
      address: '123 Animal Care Ave., Quezon City, Metro Manila',
      phone:   '+63 (2) 8123-4567',
      email:   'care@pethealthclinic.ph',
      hours:   'Mon–Sat: 9:00 AM – 6:00 PM · Sun: Emergency only',
      website: 'www.pethealthclinic.ph',
    };
  },

  /**
   * Enriched pet health record for the Pet Records page.
   *
   * Composes 11 sections keyed off a single pet:
   *   1. petProfile      - identity (name, species, breed, age, gender, weight, notes)
   *   2. healthOverview  - quick stats + current vitals
   *   3. vaccinations    - passport_vaccination_status_v rows (full history + due dates)
   *   4. medicalHistory  - medical_records (visits, diagnosis, treatment, notes)
   *   5. prescriptions   - active + recent prescriptions
   *   6. labResults      - emr_files where kind='lab_result'
   *   7. allergies       - from pets.notes + appointment_intakes.allergies (latest)
   *   8. weightHistory   - pet_weights (weight_kg + body_condition_score over time)
   *   9. treatments      - treatments table (procedures/surgeries)
   *   10. documents      - emr_files (all kinds except lab_result)
   *   11. timeline       - medical_timeline_v (unified chronological stream)
   *
   * Every query is scoped to the pet_id which is verified as owned by userId.
   */
  async getPetRecord(userId, petId) {
    // Verify ownership
    const { data: pet, error: petErr } = await supabaseAdmin
      .from('pets')
      .select('*')
      .eq('id', petId)
      .eq('owner_id', userId)
      .single();
    if (petErr || !pet) throw new Error('Pet not found or access denied.');

    const [vax, medRecs, rx, labFiles, intakeAllergies, weights, treatments, otherFiles, timeline] = await Promise.all([
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
        .eq('pet_id', petId)
        .order('occurred_at', { ascending: false }).limit(100),
    ]);

    // Extract latest allergies from intake forms (fallback to pet.notes)
    const latestIntakeAllergy = intakeAllergies?.data?.[0]?.allergies || null;
    const allergies = latestIntakeAllergy || pet.notes || null;

    // Summary stats for health overview
    const completedVisits = medRecs?.data?.filter(r => r.vet).length || 0;
    const activeRx = rx?.data?.filter(p => p.status === 'active').length || 0;
    const overdueVax = vax?.data?.filter(v => v.status === 'overdue').length || 0;
    const upcomingVax = vax?.data?.filter(v => v.status === 'scheduled' && v.due_date).length || 0;

    return {
      petProfile: pet,
      healthOverview: {
        totalVisits: medRecs?.data?.length || 0,
        completedVisits,
        activePrescriptions: activeRx,
        overdueVaccinations: overdueVax,
        upcomingVaccinations: upcomingVax,
        currentWeight: pet.weight_kg,
        lastWeightDate: weights?.data?.[weights.data.length - 1]?.recorded_at || null,
        currentBCS: weights?.data?.[weights.data.length - 1]?.body_condition_score || null,
      },
      vaccinations: vax?.data || [],
      medicalHistory: medRecs?.data || [],
      prescriptions: rx?.data || [],
      labResults: labFiles?.data || [],
      allergies,
      weightHistory: weights?.data || [],
      treatments: treatments?.data || [],
      documents: otherFiles?.data || [],
      timeline: timeline?.data || [],
    };
  },

  /**
   * Enriched client analytics — all 10 sections in one call.
   *
   * 1. healthOverview     KPIs: total pets, completed visits, upcoming, records, follow-ups
   * 2. weightTrend        Per-pet weight series from medical_records + pet_weights
   * 3. bcsTrend           Per-pet BCS series from pet_weights
   * 4. vaccinationCompliance  Counts & rate from passport_vaccination_status_v
   * 5. appointmentHistory  Per-pet visit cadence + status breakdown
   * 6. medicationAdherence  Active/discontinued Rx counts + adherence estimate
   * 7. labTrends          Lab result file counts over time + kind breakdown
   * 8. preventiveCare     Upcoming vaccines, deworming, due reminders, last wellness visit
   * 9. healthTimeline     Unified medical_timeline_v (last 100 events)
   * 10. insights          Computed recommendations & flags
   *
   * All queries are scoped to pets owned by userId.
   */
  async getAnalytics(userId) {
    // Get all pets owned by this client
    const { data: pets, error: petsErr } = await supabaseAdmin
      .from('pets')
      .select('id, name, species, breed, age, gender, weight_kg, created_at')
      .eq('owner_id', userId);
    if (petsErr) throw new Error(petsErr.message);
    const petIds = (pets || []).map(p => p.id);

    if (!petIds.length) {
      // Return empty analytics structure
      return {
        healthOverview: { totalPets: 0, totalVisits: 0, completedVisits: 0, upcomingAppointments: 0, medicalRecords: 0, followUpsDue: 0 },
        weightTrend: [],
        bcsTrend: [],
        vaccinationCompliance: { totalVaccines: 0, protected: 0, expiringSoon: 0, overdue: 0, scheduled: 0, complianceRate: 0, byPet: [] },
        appointmentHistory: { totalAppointments: 0, completed: 0, cancelled: 0, upcoming: 0, byStatus: [], byType: [], byPet: [] },
        medicationAdherence: { totalPrescriptions: 0, active: 0, discontinued: 0, completed: 0, adherenceRate: 0, byPet: [] },
        labTrends: { totalLabResults: 0, byKind: [], byMonth: [], byPet: [] },
        preventiveCare: { upcomingVaccines: 0, overdueVaccines: 0, dueDewormings: 0, lastWellnessVisit: null, byPet: [] },
        healthTimeline: [],
        insights: { flags: [], recommendations: [] },
      };
    }

    const [appts, mrs, rx, vax, weights, labFiles, treatments, timeline, intakes] = await Promise.all([
      // Appointments (last 2 years for history)
      supabaseAdmin.from('v_appointments_enriched').select('*')
        .in('pet_id', petIds)
        .gte('effective_at', new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString()),
      // Medical records (last 2 years)
      supabaseAdmin.from('medical_records').select('id, pet_id, visit_date, weight_kg, temperature_c, diagnosis, treatment, follow_up_date')
        .in('pet_id', petIds)
        .gte('visit_date', new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString())
        .order('visit_date', { ascending: true }),
      // Prescriptions (all)
      supabaseAdmin.from('prescriptions').select('id, pet_id, medication_name, dosage, frequency, route, start_date, end_date, status, instructions')
        .in('pet_id', petIds).order('start_date', { ascending: false }),
      // Vaccinations (passport view)
      supabaseAdmin.from('passport_vaccination_status_v').select('*')
        .in('pet_id', petIds).order('due_date', { ascending: true, nullsFirst: false }),
      // Weight/BCS history
      supabaseAdmin.from('pet_weights').select('id, pet_id, weight_kg, body_condition_score, recorded_at, notes')
        .in('pet_id', petIds).order('recorded_at', { ascending: true }),
      // Lab result files
      supabaseAdmin.from('emr_files').select('id, pet_id, kind, title, mime_type, size_bytes, created_at')
        .in('pet_id', petIds).eq('is_archived', false).eq('kind', 'lab_result')
        .order('created_at', { ascending: false }),
      // Treatments/procedures
      supabaseAdmin.from('treatments').select('id, pet_id, name, description, performed_date, scheduled_date, status, outcome')
        .in('pet_id', petIds).order('performed_date', { ascending: false, nullsLast: true }),
      // Unified timeline
      supabaseAdmin.from('medical_timeline_v').select('event_id, kind, occurred_at, summary, source_id, actor_id')
        .in('pet_id', petIds).order('occurred_at', { ascending: false }).limit(100),
      // Appointment intakes (for allergy/symptom context)
      supabaseAdmin.from('appointment_intakes').select('id, pet_id, symptoms, allergies, submitted_at')
        .in('pet_id', petIds).order('submitted_at', { ascending: false }),
    ]);

    const A = appts?.data || [];
    const M = mrs?.data || [];
    const RX = rx?.data || [];
    const V = vax?.data || [];
    const W = weights?.data || [];
    const LAB = labFiles?.data || [];
    const T = treatments?.data || [];
    const TL = timeline?.data || [];
    const INTAKE = intakes?.data || [];

    // ── 1. HEALTH OVERVIEW KPIs ──
    const completedVisits = A.filter(a => a.status === 'completed').length;
    const cancelledVisits = A.filter(a => a.status === 'cancelled').length;
    const upcomingAppts = A.filter(a => ['pending','confirmed'].includes(a.status) && a.appointment_at && new Date(a.appointment_at) >= new Date()).length;
    const followUpsDue = M.filter(m => m.follow_up_date && new Date(m.follow_up_date) >= new Date()).length;

    // ── 2. WEIGHT TREND (per pet) ──
    const weightTrend = pets.map(pet => ({
      petId: pet.id,
      petName: pet.name,
      series: W.filter(w => w.pet_id === pet.id)
        .map(w => ({ date: w.recorded_at, weight: Number(w.weight_kg) }))
        .filter(p => !isNaN(p.weight)),
    })).filter(s => s.series.length > 0);

    // ── 3. BCS TREND (per pet) ──
    const bcsTrend = pets.map(pet => ({
      petId: pet.id,
      petName: pet.name,
      series: W.filter(w => w.pet_id === pet.id && w.body_condition_score != null)
        .map(w => ({ date: w.recorded_at, bcs: w.body_condition_score }))
        .filter(p => !isNaN(p.bcs)),
    })).filter(s => s.series.length > 0);

    // ── 4. VACCINATION COMPLIANCE ──
    const totalVaccines = V.length;
    const protectedCount = V.filter(v => v.passport_status === 'protected').length;
    const expiringSoonCount = V.filter(v => v.passport_status === 'expiring_soon').length;
    const overdueCount = V.filter(v => v.passport_status === 'overdue').length;
    const scheduledCount = V.filter(v => v.passport_status === 'scheduled').length;
    const complianceDenom = protectedCount + expiringSoonCount + overdueCount + scheduledCount;
    const complianceRate = complianceDenom > 0 ? Math.round((protectedCount / complianceDenom) * 100) : 0;

    const vaxByPet = pets.map(pet => {
      const petVax = V.filter(v => v.pet_id === pet.id);
      return {
        petId: pet.id,
        petName: pet.name,
        species: pet.species,
        total: petVax.length,
        protected: petVax.filter(v => v.passport_status === 'protected').length,
        expiringSoon: petVax.filter(v => v.passport_status === 'expiring_soon').length,
        overdue: petVax.filter(v => v.passport_status === 'overdue').length,
        scheduled: petVax.filter(v => v.passport_status === 'scheduled').length,
      };
    });

    // ── 5. APPOINTMENT HISTORY ──
    const apptByStatus = ['pending','confirmed','completed','cancelled'].map(status => ({
      status, count: A.filter(a => a.status === status).length
    }));
    const apptByType = (() => {
      const map = new Map();
      for (const a of A) {
        const k = a.type || 'Unspecified';
        map.set(k, (map.get(k) || 0) + 1);
      }
      return [...map.entries()].map(([type, count]) => ({ type, count }));
    })();
    const apptByPet = pets.map(pet => {
      const petAppts = A.filter(a => a.pet_id === pet.id);
      return {
        petId: pet.id,
        petName: pet.name,
        total: petAppts.length,
        completed: petAppts.filter(a => a.status === 'completed').length,
        cancelled: petAppts.filter(a => a.status === 'cancelled').length,
        upcoming: petAppts.filter(a => ['pending','confirmed'].includes(a.status)).length,
      };
    });

    // ── 6. MEDICATION ADHERENCE ──
    const activeRx = RX.filter(r => r.status === 'active');
    const discontinuedRx = RX.filter(r => r.status === 'discontinued');
    const completedRx = RX.filter(r => r.status === 'completed');
    const totalRx = RX.length;
    const adherenceRate = totalRx > 0 ? Math.round((activeRx.length + completedRx.length) / totalRx * 100) : 0;

    const medByPet = pets.map(pet => {
      const petRx = RX.filter(r => r.pet_id === pet.id);
      return {
        petId: pet.id,
        petName: pet.name,
        total: petRx.length,
        active: petRx.filter(r => r.status === 'active').length,
        discontinued: petRx.filter(r => r.status === 'discontinued').length,
        completed: petRx.filter(r => r.status === 'completed').length,
      };
    });

    // ── 7. LAB TRENDS ──
    const labByMonth = (() => {
      const map = new Map();
      for (const f of LAB) {
        const d = new Date(f.created_at);
        const key = d.toISOString().slice(0, 7); // YYYY-MM
        map.set(key, (map.get(key) || 0) + 1);
      }
      return [...map.entries()].sort().map(([month, count]) => ({ month, count }));
    })();
    const labByKind = [{ kind: 'lab_result', count: LAB.length }];
    const labByPet = pets.map(pet => ({
      petId: pet.id,
      petName: pet.name,
      count: LAB.filter(f => f.pet_id === pet.id).length,
    }));

    // ── 8. PREVENTIVE CARE ──
    const upcomingVaccines = V.filter(v => v.passport_status === 'scheduled' && v.due_date && new Date(v.due_date) >= new Date()).length;
    const overdueVaccines = V.filter(v => v.passport_status === 'overdue').length;
    // Deworming inferred from vaccine_name keywords
    const DEWORM_KEYWORDS = ['deworm','wormer','anthelmintic','praziquantel','fenbendazole','pyrantel','milbemycin','ivermectin','heartworm'];
    const dewormingVax = V.filter(v => DEWORM_KEYWORDS.some(k => (v.vaccine_name || '').toLowerCase().includes(k)));
    const dueDewormings = dewormingVax.filter(v => v.passport_status === 'scheduled' || v.passport_status === 'overdue').length;

    const lastWellnessVisit = M
      .filter(m => m.diagnosis && /wellness|check.?up|routine|annual/i.test(m.diagnosis))
      .sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date))[0]?.visit_date || null;

    const preventiveByPet = pets.map(pet => {
      const petVax = V.filter(v => v.pet_id === pet.id);
      return {
        petId: pet.id,
        petName: pet.name,
        upcomingVaccines: petVax.filter(v => v.passport_status === 'scheduled' && v.due_date && new Date(v.due_date) >= new Date()).length,
        overdueVaccines: petVax.filter(v => v.passport_status === 'overdue').length,
        dueDewormings: dewormingVax.filter(v => v.pet_id === pet.id).filter(v => v.passport_status === 'scheduled' || v.passport_status === 'overdue').length,
        lastWellnessVisit,
      };
    });

    // ── 9. HEALTH TIMELINE ──
    const healthTimeline = TL.map(ev => ({
      id: ev.event_id,
      kind: ev.kind,
      date: ev.occurred_at,
      summary: ev.summary,
      sourceId: ev.source_id,
    }));

    // ── 10. INSIGHTS / RECOMMENDATIONS ──
    const flags = [];
    const recommendations = [];

    // Overdue vaccines
    if (overdueCount > 0) {
      flags.push({ type: 'warning', code: 'OVERDUE_VACCINES', message: `${overdueCount} vaccination${overdueCount !== 1 ? 's' : ''} overdue`, severity: 'high' });
      recommendations.push({ type: 'vaccination', priority: 'high', text: 'Schedule overdue vaccinations to restore full protection.' });
    }
    // Expiring soon
    if (expiringSoonCount > 0) {
      flags.push({ type: 'info', code: 'EXPIRING_VACCINES', message: `${expiringSoonCount} vaccine${expiringSoonCount !== 1 ? 's' : ''} expiring soon`, severity: 'medium' });
      recommendations.push({ type: 'vaccination', priority: 'medium', text: 'Book booster shots for expiring vaccines within the next 30 days.' });
    }
    // No recent wellness visit
    if (pets.length > 0 && !lastWellnessVisit) {
      flags.push({ type: 'info', code: 'NO_WELLNESS_VISIT', message: 'No recent wellness check-up recorded', severity: 'low' });
      recommendations.push({ type: 'preventive', priority: 'medium', text: 'Consider scheduling an annual wellness exam for preventive care.' });
    }
    // BCS out of ideal range (4-5 on 9-point scale)
    for (const pet of pets) {
      const latestBcs = W.filter(w => w.pet_id === pet.id && w.body_condition_score != null).sort((a,b) => new Date(b.recorded_at) - new Date(a.recorded_at))[0];
      if (latestBcs && (latestBcs.body_condition_score <= 3 || latestBcs.body_condition_score >= 7)) {
        flags.push({ type: 'warning', code: 'BCS_CONCERN', message: `${pet.name} BCS ${latestBcs.body_condition_score}/9 — outside ideal range (4-5)`, severity: 'medium' });
        recommendations.push({ type: 'nutrition', priority: 'medium', text: `${pet.name} needs a nutritional review — BCS is ${latestBcs.body_condition_score}/9.` });
      }
    }
    // Weight loss >10% over last 3 months
    for (const s of weightTrend) {
      const recent = s.series.filter(p => new Date(p.date) >= new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
      if (recent.length >= 2) {
        const first = recent[recent.length - 1];
        const last = recent[0];
        if (first.weight > 0 && ((first.weight - last.weight) / first.weight) > 0.1) {
          flags.push({ type: 'warning', code: 'WEIGHT_LOSS', message: `${s.petName} lost >10% body weight in 3 months`, severity: 'high' });
          recommendations.push({ type: 'clinical', priority: 'high', text: `${s.petName} shows significant weight loss — veterinary evaluation recommended.` });
        }
      }
    }
    // Low lab result frequency
    if (LAB.length === 0 && M.length > 3) {
      recommendations.push({ type: 'diagnostics', priority: 'low', text: 'Consider routine lab screening at next visit to establish baselines.' });
    }

    return {
      healthOverview: {
        totalPets: pets.length,
        totalVisits: A.length,
        completedVisits,
        cancelledVisits,
        upcomingAppointments: upcomingAppts,
        medicalRecords: M.length,
        followUpsDue,
      },
      weightTrend,
      bcsTrend,
      vaccinationCompliance: {
        totalVaccines,
        protected: protectedCount,
        expiringSoon: expiringSoonCount,
        overdue: overdueCount,
        scheduled: scheduledCount,
        complianceRate,
        byPet: vaxByPet,
      },
      appointmentHistory: {
        totalAppointments: A.length,
        completed: completedVisits,
        cancelled: cancelledVisits,
        upcoming: upcomingAppts,
        byStatus: apptByStatus,
        byType: apptByType,
        byPet: apptByPet,
      },
      medicationAdherence: {
        totalPrescriptions: totalRx,
        active: activeRx.length,
        discontinued: discontinuedRx.length,
        completed: completedRx.length,
        adherenceRate,
        byPet: medByPet,
      },
      labTrends: {
        totalLabResults: LAB.length,
        byKind: labByKind,
        byMonth: labByMonth,
        byPet: labByPet,
      },
      preventiveCare: {
        upcomingVaccines,
        overdueVaccines,
        dueDewormings,
        lastWellnessVisit,
        byPet: preventiveByPet,
      },
      healthTimeline,
      insights: { flags, recommendations },
    };
  },

  async getPets(userId) {
    const { data, error } = await supabaseAdmin.from('pets').select('*').eq('owner_id', userId).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },

  async addPet(userId, petData) {
    const { data, error } = await supabaseAdmin.from('pets').insert({
      owner_id: userId,
      name: petData.name,
      species: petData.species,
      breed: petData.breed || null,
      age: petData.age ? parseInt(petData.age, 10) : null,
      gender: petData.gender || 'unknown',
      weight_kg: petData.weight_kg || null,
      notes: petData.notes || null,
    }).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async getAppointments(userId) {
    const { data, error } = await supabaseAdmin.from('appointments').select('*, pets(name, species, breed)').eq('client_id', userId).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },

  async updateSmsOptIn(userId, optIn) {
    const { data, error } = await supabaseAdmin
      .from('users').update({ sms_opt_in: !!optIn }).eq('id', userId).select('id, sms_opt_in').single();
    if (error) throw new Error(error.message);
    return data;
  },

  async bookAppointment(userId, { petId, type, reason, appointmentAt }) {
    const { data, error } = await supabaseAdmin.from('appointments').insert({
      pet_id: petId, client_id: userId,
      type: type || 'General Checkup',
      reason: reason || null,
      appointment_at: appointmentAt || null,
      status: 'pending',
    }).select().single();
    if (error) throw new Error(error.message);
    return data;
  },
};

module.exports = clientService;
