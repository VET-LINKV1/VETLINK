/**
 * analyticsService.js
 * "The Health Check" — descriptive analytics for VETLINK.
 *
 * Four role-scoped reports:
 *   - getAdminHealthCheck()          full clinic
 *   - getVetHealthCheck(vetId)        caseload for one vet
 *   - getStaffHealthCheck()           operations
 *   - getClientHealthCheck(clientId)  per-client pet health
 *
 * All four accept an optional { startDate, endDate } window.
 *
 * Uses supabaseAdmin (service role) — RLS is bypassed and the role
 * filtering happens in app code (after authMiddleware + roleMiddleware).
 */
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

// ── helpers ────────────────────────────────────────────────────

/** Default window: trailing 90 days. */
function resolveWindow({ startDate, endDate } = {}) {
  const end   = endDate   ? new Date(endDate)   : new Date();
  const start = startDate ? new Date(startDate) : new Date(end.getTime() - 90 * 24 * 3600 * 1000);
  // normalise to YYYY-MM-DD
  const toISO = (d) => d.toISOString().slice(0, 10);
  return { start: toISO(start), end: toISO(end) };
}

/** Group an array by a key function, returning [{key, count, ...extras}]. */
function groupCount(rows, keyFn, extra = () => ({})) {
  const map = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (k === null || k === undefined || k === '') continue;
    if (!map.has(k)) map.set(k, { key: k, count: 0, ...extra(r) });
    map.get(k).count += 1;
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/** Histogram bucketing for numeric values. */
function bucket(rows, accessor, buckets) {
  // buckets = [{label, min, max}]   (max exclusive)
  const out = buckets.map((b) => ({ label: b.label, count: 0 }));
  for (const r of rows) {
    const v = accessor(r);
    if (v === null || v === undefined || isNaN(v)) continue;
    const idx = buckets.findIndex((b) => v >= b.min && v < b.max);
    if (idx >= 0) out[idx].count += 1;
  }
  return out;
}

/** Roll a date series into per-day counts between [start, end]. */
function rollupDaily(rows, dateAccessor, start, end) {
  const days = {};
  for (let d = new Date(start); d <= new Date(end); d.setDate(d.getDate() + 1)) {
    days[d.toISOString().slice(0, 10)] = 0;
  }
  for (const r of rows) {
    const raw = dateAccessor(r);
    if (!raw) continue;
    const key = new Date(raw).toISOString().slice(0, 10);
    if (key in days) days[key] += 1;
  }
  return Object.entries(days).map(([day, count]) => ({ day, count }));
}

/** Format centavos → PHP float (×0.01). */
const toPHP = (centavos) => Math.round((centavos || 0)) / 100;

// ── ADMIN ─────────────────────────────────────────────────────

async function getAdminHealthCheck(filters = {}) {
  const { start, end } = resolveWindow(filters);

  // Pull base data in parallel
  const [appts, pets, mrs, payments, users] = await Promise.all([
    supabaseAdmin.from('v_appointments_enriched').select('*').gte('effective_at', start).lte('effective_at', end + 'T23:59:59'),
    supabaseAdmin.from('pets').select('id, owner_id, species, breed, age, gender, weight_kg, created_at'),
    supabaseAdmin.from('medical_records').select('id, pet_id, vet_id, visit_date, diagnosis, treatment, prescription, follow_up_date').gte('visit_date', start).lte('visit_date', end),
    supabaseAdmin.from('payments').select('id, amount, status, payment_method, paid_at, created_at').gte('created_at', start).lte('created_at', end + 'T23:59:59'),
    supabaseAdmin.from('users').select('id, role, name, is_active'),
  ]);

  // Surface query errors but keep going with partial data
  if (appts.error)    logger.error('analytics.admin.appts',    appts.error.message);
  if (pets.error)     logger.error('analytics.admin.pets',     pets.error.message);
  if (mrs.error)      logger.error('analytics.admin.mr',       mrs.error.message);
  if (payments.error) logger.error('analytics.admin.payments', payments.error.message);
  if (users.error)    logger.error('analytics.admin.users',    users.error.message);

  const A = appts.data    || [];
  const P = pets.data     || [];
  const M = mrs.data      || [];
  const PMT = payments.data || [];
  const U = users.data    || [];

  // KPIs
  const totalAppointments = A.length;
  const completed         = A.filter((a) => a.status === 'completed').length;
  const cancelled         = A.filter((a) => a.status === 'cancelled').length;
  const noShowRate = totalAppointments
    ? +((cancelled / totalAppointments) * 100).toFixed(1)
    : 0;
  const completionRate = totalAppointments
    ? +((completed / totalAppointments) * 100).toFixed(1)
    : 0;

  const totalRevenuePHP = toPHP(PMT.filter((p) => p.status === 'paid')
                                   .reduce((s, p) => s + (p.amount || 0), 0));
  const pendingRevenuePHP = toPHP(PMT.filter((p) => p.status === 'pending')
                                     .reduce((s, p) => s + (p.amount || 0), 0));

  // Vaccination compliance via RPC (cheaper than pulling all medical records)
  let vaccination = { total_pets: P.length, vaccinated_pets: 0, compliance_percent: 0 };
  const vacRpc = await supabaseAdmin.rpc('fn_vaccination_compliance');
  if (vacRpc.error) logger.error('analytics.admin.vacRpc', vacRpc.error.message);
  else if (Array.isArray(vacRpc.data) && vacRpc.data[0]) vaccination = vacRpc.data[0];

  // Appointments-by-day series (use RPC for proper zero-fill)
  const dayRpc = await supabaseAdmin.rpc('fn_appointments_by_day', { p_start: start, p_end: end });
  const apptByDay = (dayRpc.data || []).map((r) => ({
    day:        r.day,
    total:      Number(r.total),
    pending:    Number(r.pending),
    confirmed:  Number(r.confirmed),
    completed:  Number(r.completed),
    cancelled:  Number(r.cancelled),
  }));

  // Charts
  const appointmentsByStatus = groupCount(A, (a) => a.status);
  const appointmentsByType   = groupCount(A, (a) => a.type || 'Unspecified');
  const appointmentsByVet    = groupCount(A.filter((a) => a.vet_id), (a) => a.vet_name || a.vet_id);
  const appointmentsByDow    = (() => {
    const labels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const counts = Array(7).fill(0);
    for (const a of A) {
      const d = a.appointment_at ? new Date(a.appointment_at) : null;
      if (d && !isNaN(d)) counts[d.getDay()] += 1;
    }
    return labels.map((label, i) => ({ key: label, count: counts[i] }));
  })();

  const petsBySpecies = groupCount(P, (p) => p.species || 'Unknown');
  const petsByBreed   = groupCount(P.filter((p) => p.breed), (p) => p.breed).slice(0, 10);
  const petsByGender  = groupCount(P, (p) => p.gender || 'unknown');
  const petsAgeBuckets = bucket(P, (p) => Number(p.age), [
    { label: '0-1',  min: 0,  max: 2 },
    { label: '2-4',  min: 2,  max: 5 },
    { label: '5-7',  min: 5,  max: 8 },
    { label: '8-12', min: 8,  max: 13 },
    { label: '13+',  min: 13, max: 999 },
  ]);
  const petsWeightBuckets = bucket(P, (p) => Number(p.weight_kg), [
    { label: '<5kg',     min: 0,  max: 5 },
    { label: '5-15kg',   min: 5,  max: 15 },
    { label: '15-30kg',  min: 15, max: 30 },
    { label: '30-50kg',  min: 30, max: 50 },
    { label: '50kg+',    min: 50, max: 9999 },
  ]);

  const topDiagnoses = groupCount(M, (m) => (m.diagnosis || '').trim().toLowerCase(),
                                  (m) => ({ label: m.diagnosis }))
                          .slice(0, 10)
                          .map((d) => ({ key: d.label, count: d.count }));

  // Revenue monthly via view
  const revRpc = await supabaseAdmin.from('v_revenue_monthly').select('*');
  const revenueMonthly = (revRpc.data || [])
    .filter((r) => r.month && r.month >= start.slice(0,7) + '-01')
    .map((r) => ({
      month:  r.month,
      paid:   Number(r.paid_count),
      amount: toPHP(Number(r.paid_amount_centavos)),
    }));

  const paymentsByMethod = groupCount(PMT.filter((p) => p.status === 'paid'),
                                       (p) => p.payment_method || 'unknown');
  const paymentsByStatus = groupCount(PMT, (p) => p.status);

  const usersByRole = groupCount(U, (u) => u.role);

  return {
    role:    'admin',
    window:  { start, end },
    kpis: {
      totalAppointments,
      completed,
      cancelled,
      completionRate,
      noShowRate,
      totalRevenuePHP,
      pendingRevenuePHP,
      totalPets:         P.length,
      activeUsers:       U.filter((u) => u.is_active).length,
      vaccinationRate:   Number(vaccination.compliance_percent) || 0,
      vaccinatedPets:    Number(vaccination.vaccinated_pets) || 0,
      medicalRecords:    M.length,
    },
    charts: {
      appointmentsByDay:    apptByDay,
      appointmentsByStatus,
      appointmentsByType,
      appointmentsByVet,
      appointmentsByDow,
      petsBySpecies,
      petsByBreed,
      petsByGender,
      petsAgeBuckets,
      petsWeightBuckets,
      topDiagnoses,
      revenueMonthly,
      paymentsByMethod,
      paymentsByStatus,
      usersByRole,
    },
  };
}

// ── VETERINARIAN ──────────────────────────────────────────────

async function getVetHealthCheck(vetId, filters = {}) {
  const { start, end } = resolveWindow(filters);

  const [appts, mrs] = await Promise.all([
    supabaseAdmin.from('v_appointments_enriched')
      .select('*')
      .eq('vet_id', vetId)
      .gte('effective_at', start).lte('effective_at', end + 'T23:59:59'),
    supabaseAdmin.from('medical_records')
      .select('id, pet_id, visit_date, diagnosis, treatment, follow_up_date')
      .eq('vet_id', vetId)
      .gte('visit_date', start).lte('visit_date', end),
  ]);

  const A = appts.data || [];
  const M = mrs.data   || [];

  const completed = A.filter((a) => a.status === 'completed').length;
  const cancelled = A.filter((a) => a.status === 'cancelled').length;
  const upcoming  = A.filter((a) => ['pending','confirmed'].includes(a.status) &&
                                    a.appointment_at && new Date(a.appointment_at) >= new Date()).length;
  const totalDuration = A.filter((a) => a.status === 'completed')
                         .reduce((s, a) => s + (a.duration_mins || 30), 0);
  const uniquePets    = new Set(A.map((a) => a.pet_id)).size;
  const followUpsDue  = M.filter((m) => m.follow_up_date &&
                                         new Date(m.follow_up_date) >= new Date(start) &&
                                         new Date(m.follow_up_date) <= new Date(end)).length;

  return {
    role:   'veterinarian',
    window: { start, end },
    kpis: {
      totalAppointments: A.length,
      completed,
      cancelled,
      upcoming,
      uniquePets,
      avgDurationMins:   completed ? Math.round(totalDuration / completed) : 0,
      medicalRecords:    M.length,
      followUpsDue,
      cancellationRate:  A.length ? +((cancelled / A.length) * 100).toFixed(1) : 0,
    },
    charts: {
      appointmentsByStatus: groupCount(A, (a) => a.status),
      appointmentsByType:   groupCount(A, (a) => a.type || 'Unspecified'),
      appointmentsByDay:    rollupDaily(A, (a) => a.appointment_at || a.created_at, start, end),
      topDiagnoses:         groupCount(M, (m) => (m.diagnosis || '').trim().toLowerCase(),
                                       (m) => ({ label: m.diagnosis }))
                                .slice(0, 10)
                                .map((d) => ({ key: d.label, count: d.count })),
      petsTreatedBySpecies: groupCount(A, (a) => a.pet_species || 'Unknown'),
    },
  };
}

// ── STAFF ─────────────────────────────────────────────────────

async function getStaffHealthCheck(filters = {}) {
  const { start, end } = resolveWindow(filters);

  const [appts, payments] = await Promise.all([
    supabaseAdmin.from('v_appointments_enriched').select('*')
      .gte('effective_at', start).lte('effective_at', end + 'T23:59:59'),
    supabaseAdmin.from('payments').select('id, amount, status, payment_method, paid_at, created_at')
      .gte('created_at', start).lte('created_at', end + 'T23:59:59'),
  ]);

  const A   = appts.data    || [];
  const PMT = payments.data || [];

  const pending   = A.filter((a) => a.status === 'pending').length;
  const confirmed = A.filter((a) => a.status === 'confirmed').length;
  const completed = A.filter((a) => a.status === 'completed').length;
  const cancelled = A.filter((a) => a.status === 'cancelled').length;
  const noShowRate = A.length ? +((cancelled / A.length) * 100).toFixed(1) : 0;
  const collected  = toPHP(PMT.filter((p) => p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0));
  const outstanding = toPHP(PMT.filter((p) => p.status === 'pending').reduce((s, p) => s + (p.amount || 0), 0));

  return {
    role:   'staff',
    window: { start, end },
    kpis: {
      totalAppointments: A.length,
      pending,
      confirmed,
      completed,
      cancelled,
      noShowRate,
      collectedPHP:   collected,
      outstandingPHP: outstanding,
      paidCount:      PMT.filter((p) => p.status === 'paid').length,
    },
    charts: {
      appointmentsByDay:    rollupDaily(A, (a) => a.appointment_at || a.created_at, start, end),
      appointmentsByStatus: groupCount(A, (a) => a.status),
      appointmentsByVet:    groupCount(A.filter((a) => a.vet_id), (a) => a.vet_name || a.vet_id),
      appointmentsByType:   groupCount(A, (a) => a.type || 'Unspecified'),
      paymentsByStatus:     groupCount(PMT, (p) => p.status),
      paymentsByMethod:     groupCount(PMT.filter((p) => p.status === 'paid'),
                                        (p) => p.payment_method || 'unknown'),
    },
  };
}

// ── CLIENT ────────────────────────────────────────────────────

async function getClientHealthCheck(clientId, filters = {}) {
  const { start, end } = resolveWindow(filters);

  const [appts, pets] = await Promise.all([
    supabaseAdmin.from('v_appointments_enriched').select('*')
      .eq('client_id', clientId)
      .gte('effective_at', start).lte('effective_at', end + 'T23:59:59'),
    supabaseAdmin.from('pets').select('id, name, species, breed, age, gender, weight_kg').eq('owner_id', clientId),
  ]);

  const A = appts.data || [];
  const P = pets.data  || [];

  // Pull medical records for the client's pets only (RLS-safe — admin client)
  let records = [];
  if (P.length > 0) {
    const petIds = P.map((p) => p.id);
    const mrRes = await supabaseAdmin.from('medical_records')
      .select('id, pet_id, visit_date, weight_kg, temperature_c, diagnosis, treatment, follow_up_date')
      .in('pet_id', petIds)
      .gte('visit_date', start).lte('visit_date', end)
      .order('visit_date', { ascending: true });
    records = mrRes.data || [];
  }

  const completed = A.filter((a) => a.status === 'completed').length;
  const cancelled = A.filter((a) => a.status === 'cancelled').length;
  const upcoming  = A.filter((a) => ['pending','confirmed'].includes(a.status) &&
                                    a.appointment_at && new Date(a.appointment_at) >= new Date()).length;
  const followUps = records.filter((m) => m.follow_up_date &&
                                          new Date(m.follow_up_date) >= new Date()).length;

  // Per-pet weight trend (one series per pet)
  const weightTrendByPet = P.map((pet) => ({
    petId:   pet.id,
    petName: pet.name,
    series:  records.filter((r) => r.pet_id === pet.id && r.weight_kg != null)
                    .map((r) => ({ date: r.visit_date, weight: Number(r.weight_kg) })),
  })).filter((s) => s.series.length > 0);

  // Visit cadence per pet (simple: last visit + count)
  const visitsByPet = P.map((pet) => {
    const petRecs = records.filter((r) => r.pet_id === pet.id);
    const last = petRecs.length ? petRecs[petRecs.length - 1].visit_date : null;
    return {
      petId:    pet.id,
      petName:  pet.name,
      species:  pet.species,
      visits:   petRecs.length,
      lastVisit: last,
    };
  });

  return {
    role:   'client',
    window: { start, end },
    kpis: {
      totalPets:          P.length,
      totalAppointments:  A.length,
      completed,
      cancelled,
      upcoming,
      medicalRecords:     records.length,
      followUpsScheduled: followUps,
    },
    charts: {
      appointmentsByDay:    rollupDaily(A, (a) => a.appointment_at || a.created_at, start, end),
      appointmentsByStatus: groupCount(A, (a) => a.status),
      appointmentsByType:   groupCount(A, (a) => a.type || 'Unspecified'),
      visitsByPet:          visitsByPet.map((v) => ({ key: v.petName, count: v.visits })),
      weightTrendByPet,
    },
    pets: visitsByPet,
  };
}

module.exports = {
  getAdminHealthCheck,
  getVetHealthCheck,
  getStaffHealthCheck,
  getClientHealthCheck,
};
