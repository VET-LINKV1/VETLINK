/**
 * diagnosticService.js
 * "Diagnostic Analytics (Root Cause)" — answers WHY metrics moved.
 *
 * Three analyzers:
 *   1. getChurnAnalysis(filters)         — declining retention + root causes
 *   2. getTreatmentEffectiveness(filters)— which protocols actually work
 *   3. getInventoryShrinkage(filters)    — used vs billed, missing stock, expiries
 *
 * Each accepts an optional { startDate, endDate } window. Default = trailing 90 days.
 *
 * Uses supabaseAdmin (service role) — RLS is bypassed. Role gating happens
 * upstream in the controller via authMiddleware + roleMiddleware('admin').
 */
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

// ── helpers ─────────────────────────────────────────────────────

const DAY_MS = 86400 * 1000;

function toISO(d) { return new Date(d).toISOString().slice(0, 10); }

/** Default window: trailing 90 days. */
function resolveWindow({ startDate, endDate } = {}) {
  const end   = endDate   ? new Date(endDate)   : new Date();
  const start = startDate ? new Date(startDate) : new Date(end.getTime() - 90 * DAY_MS);
  return { start: toISO(start), end: toISO(end) };
}

/** Prior window of identical length immediately preceding [start, end]. */
function priorWindow(start, end) {
  const s = new Date(start), e = new Date(end);
  const lenDays = Math.max(1, Math.round((e - s) / DAY_MS) + 1);
  const prevEnd   = new Date(s.getTime() - DAY_MS);
  const prevStart = new Date(prevEnd.getTime() - (lenDays - 1) * DAY_MS);
  return { start: toISO(prevStart), end: toISO(prevEnd), days: lenDays };
}

/** Group an array by a key function → [{ key, count, ...extras }] sorted DESC. */
function groupCount(rows, keyFn, extra = () => ({})) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (k == null || k === '') continue;
    if (!m.has(k)) m.set(k, { key: k, count: 0, ...extra(r) });
    m.get(k).count += 1;
  }
  return [...m.values()].sort((a, b) => b.count - a.count);
}

const toPHP = (centavos) => Math.round((centavos || 0)) / 100;
const pct   = (n, d)     => (d ? +((n / d) * 100).toFixed(2) : 0);

// ── 1. CHURN ANALYSIS ───────────────────────────────────────────

async function getChurnAnalysis(filters = {}) {
  const { start, end } = resolveWindow(filters);
  const prev = priorWindow(start, end);

  // Headline churn metric — prior-active clients who didn't return.
  // The RPC does the heavy join; falls back to a JS computation if missing.
  let headline = { churned_clients: 0, retained_clients: 0, prior_active_clients: 0, churn_rate_percent: 0 };
  const rpc = await supabaseAdmin.rpc('fn_churn_root_cause', {
    p_start: start, p_end: end, p_prev_start: prev.start, p_prev_end: prev.end,
  });
  if (rpc.error) logger.error('diagnostic.churn.rpc', rpc.error.message);
  else if (Array.isArray(rpc.data) && rpc.data[0]) headline = rpc.data[0];

  // Pull current + prior appointments for root-cause attribution.
  const [curAppt, prevAppt, clients] = await Promise.all([
    supabaseAdmin.from('v_diag_appointments').select('*')
      .gte('appointment_at', start).lte('appointment_at', end + 'T23:59:59'),
    supabaseAdmin.from('v_diag_appointments').select('*')
      .gte('appointment_at', prev.start).lte('appointment_at', prev.end + 'T23:59:59'),
    supabaseAdmin.from('v_diag_client_activity').select('*'),
  ]);

  if (curAppt.error)  logger.error('diagnostic.churn.cur',  curAppt.error.message);
  if (prevAppt.error) logger.error('diagnostic.churn.prev', prevAppt.error.message);
  if (clients.error)  logger.error('diagnostic.churn.cl',   clients.error.message);

  const CUR  = curAppt.data  || [];
  const PRV  = prevAppt.data || [];
  const CACT = clients.data  || [];

  // Identify churned clients (in PRV but not in CUR).
  const curClientIds  = new Set(CUR.map((a) => a.client_id).filter(Boolean));
  const prevClientIds = new Set(PRV.map((a) => a.client_id).filter(Boolean));
  const churnedSet    = new Set([...prevClientIds].filter((id) => !curClientIds.has(id)));
  const retainedSet   = new Set([...prevClientIds].filter((id) =>  curClientIds.has(id)));

  // For each churned client, grab their LAST appointment in the prior window.
  const churnedAppts = PRV
    .filter((a) => churnedSet.has(a.client_id))
    .sort((a, b) => new Date(b.appointment_at || 0) - new Date(a.appointment_at || 0));

  const lastApptByClient = new Map();
  for (const a of churnedAppts) {
    if (!lastApptByClient.has(a.client_id)) lastApptByClient.set(a.client_id, a);
  }
  const churnedLastVisits = [...lastApptByClient.values()];

  // CAUSE 1: Which vet did the last visit belong to?
  const churnByVet = groupCount(
    churnedLastVisits.filter((a) => a.vet_id),
    (a) => a.vet_name || a.vet_id,
  );

  // Retention rate per vet = retained_clients_seen / total_clients_seen (prior window)
  const vetExposure = new Map();
  for (const a of PRV) {
    if (!a.vet_id) continue;
    const k = a.vet_name || a.vet_id;
    if (!vetExposure.has(k)) vetExposure.set(k, { vet: k, prev: new Set(), retained: new Set() });
    vetExposure.get(k).prev.add(a.client_id);
    if (retainedSet.has(a.client_id)) vetExposure.get(k).retained.add(a.client_id);
  }
  const retentionByVet = [...vetExposure.values()]
    .map(({ vet, prev, retained }) => ({
      key:               vet,
      prev_clients:      prev.size,
      retained_clients:  retained.size,
      retention_pct:     pct(retained.size, prev.size),
    }))
    .filter((r) => r.prev_clients >= 2)
    .sort((a, b) => a.retention_pct - b.retention_pct);  // worst first

  // CAUSE 2: Wait time — long elapsed minutes on the last visit.
  const elapsedAll = PRV
    .filter((a) => a.elapsed_mins != null && a.elapsed_mins >= 0)
    .map((a) => Number(a.elapsed_mins));
  const meanElapsed = elapsedAll.length
    ? elapsedAll.reduce((s, v) => s + v, 0) / elapsedAll.length
    : 0;

  const longWaitChurned = churnedLastVisits.filter(
    (a) => a.elapsed_mins != null && Number(a.elapsed_mins) > Math.max(meanElapsed * 1.5, 45)
  ).length;
  const longWaitTotal   = PRV.filter(
    (a) => a.elapsed_mins != null && Number(a.elapsed_mins) > Math.max(meanElapsed * 1.5, 45)
  ).length;

  const waitBuckets = [
    { label: '<15 min',   min: 0,   max: 15 },
    { label: '15–30 min', min: 15,  max: 30 },
    { label: '30–60 min', min: 30,  max: 60 },
    { label: '60–90 min', min: 60,  max: 90 },
    { label: '90+ min',   min: 90,  max: 1e9 },
  ];
  const waitTimeDistribution = waitBuckets.map((b) => ({
    key:         b.label,
    count:       0,
    churned:     0,
  }));
  for (const a of PRV) {
    const w = Number(a.elapsed_mins);
    if (!isFinite(w) || w < 0) continue;
    const i = waitBuckets.findIndex((b) => w >= b.min && w < b.max);
    if (i < 0) continue;
    waitTimeDistribution[i].count   += 1;
    if (churnedSet.has(a.client_id)) waitTimeDistribution[i].churned += 1;
  }

  // CAUSE 3: Price increases — pull avg price per service in current vs prior window.
  let priceTrend = [];
  const priceRpc = await supabaseAdmin.rpc('fn_diag_avg_price_by_service', { p_start: start, p_end: end });
  if (priceRpc.error) logger.error('diagnostic.churn.price', priceRpc.error.message);
  else priceTrend = (priceRpc.data || []).map((r) => ({
    service:          r.service,
    current_avg_php:  toPHP(Number(r.current_avg)),
    prior_avg_php:    toPHP(Number(r.prior_avg)),
    current_count:    Number(r.current_count),
    prior_count:      Number(r.prior_count),
    price_change_pct: r.price_change_pct != null ? Number(r.price_change_pct) : null,
  }));

  const priceIncreased = priceTrend.filter((p) => (p.price_change_pct || 0) > 10);

  // CAUSE 4: Cancellations among churned clients' prior history.
  const churnedCancellations = PRV.filter(
    (a) => churnedSet.has(a.client_id) && a.status === 'cancelled'
  );
  const cancelReasons = groupCount(churnedCancellations, (a) => (a.cancel_reason || 'no reason given').trim().toLowerCase(),
    (a) => ({ label: a.cancel_reason || 'no reason given' }))
    .slice(0, 10)
    .map((r) => ({ key: r.label, count: r.count }));

  const churnedClientCancelRate = pct(
    churnedCancellations.length,
    PRV.filter((a) => churnedSet.has(a.client_id)).length
  );
  const retainedClientCancelRate = pct(
    PRV.filter((a) => retainedSet.has(a.client_id) && a.status === 'cancelled').length,
    PRV.filter((a) => retainedSet.has(a.client_id)).length
  );

  // Per-period new vs lost clients (visual trend).
  // For the current period, "new" = first ever visit in window.
  const firstVisitByClient = new Map();
  for (const c of CACT) {
    if (c.first_visit_at) firstVisitByClient.set(c.client_id, c.first_visit_at);
  }
  const newInWindow = [...firstVisitByClient.entries()]
    .filter(([_, ts]) => ts >= start && ts <= end + 'T23:59:59').length;

  // ROOT-CAUSE WEIGHTING (heuristic): how much of churn each cause "explains".
  // Each contribution is bounded to [0..100] and the four are normalised to sum to 100.
  const totalChurn = churnedSet.size || 1;
  const vetSignal     = retentionByVet[0]?.retention_pct != null
    ? Math.max(0, 100 - retentionByVet[0].retention_pct) * 0.4
    : 0;
  const waitSignal    = pct(longWaitChurned, totalChurn);
  const priceSignal   = priceIncreased.length
    ? Math.min(100, priceIncreased.reduce((s, p) => s + (p.price_change_pct || 0), 0))
    : 0;
  const cancelSignal  = Math.max(0, churnedClientCancelRate - retainedClientCancelRate) * 2;

  const rawSum = vetSignal + waitSignal + priceSignal + cancelSignal || 1;
  const rootCauseBreakdown = [
    { key: 'Veterinarian-related',  count: +(100 * vetSignal     / rawSum).toFixed(1) },
    { key: 'Long wait times',       count: +(100 * waitSignal    / rawSum).toFixed(1) },
    { key: 'Price increases',       count: +(100 * priceSignal   / rawSum).toFixed(1) },
    { key: 'Cancellations',         count: +(100 * cancelSignal  / rawSum).toFixed(1) },
  ];

  return {
    module: 'churn',
    window: { start, end, prev_start: prev.start, prev_end: prev.end },
    kpis: {
      churnedClients:        Number(headline.churned_clients)        || churnedSet.size,
      retainedClients:       Number(headline.retained_clients)       || retainedSet.size,
      priorActiveClients:    Number(headline.prior_active_clients)   || prevClientIds.size,
      currentActiveClients:  curClientIds.size,
      newClientsInWindow:    newInWindow,
      churnRatePercent:      Number(headline.churn_rate_percent)     || pct(churnedSet.size, prevClientIds.size),
      avgWaitMins:           Math.round(meanElapsed),
      longWaitVisits:        longWaitTotal,
      servicesPriceIncreased: priceIncreased.length,
      churnedCancelRatePct:  churnedClientCancelRate,
      retainedCancelRatePct: retainedClientCancelRate,
    },
    charts: {
      rootCauseBreakdown,
      churnByVet:            churnByVet.slice(0, 10),
      retentionByVet:        retentionByVet.slice(0, 10),
      waitTimeDistribution,
      priceTrend,
      cancelReasons,
    },
    churnedClientsList: churnedLastVisits.slice(0, 50).map((a) => ({
      clientId:     a.client_id,
      clientName:   a.client_name,
      lastVetName:  a.vet_name,
      lastVisit:    a.appointment_at,
      lastStatus:   a.status,
      elapsedMins:  a.elapsed_mins != null ? Math.round(Number(a.elapsed_mins)) : null,
      amountPHP:    toPHP(a.amount_centavos),
      cancelReason: a.cancel_reason,
    })),
  };
}

// ── 2. TREATMENT EFFECTIVENESS ──────────────────────────────────

async function getTreatmentEffectiveness(filters = {}) {
  const { start, end } = resolveWindow(filters);
  const minCohort = Number(filters.minCohort || 2);

  // Cohorts via RPC; fall back to JS rollup if RPC missing.
  let cohorts = [];
  const rpc = await supabaseAdmin.rpc('fn_treatment_effectiveness', {
    p_start: start, p_end: end, p_min_cohort: minCohort,
  });
  if (rpc.error) logger.error('diagnostic.treatment.rpc', rpc.error.message);
  else cohorts = (rpc.data || []).map((r) => ({
    diagnosisKey:        r.diagnosis_key,
    diagnosisLabel:      r.diagnosis_label,
    treatmentKey:        r.treatment_key,
    treatmentLabel:      r.treatment_label,
    cohortSize:          Number(r.cohort_size),
    uniquePets:          Number(r.unique_pets),
    followUpRatePct:     r.followup_rate_pct != null ? Number(r.followup_rate_pct) : 0,
    recurrenceRatePct:   r.recurrence_rate_pct != null ? Number(r.recurrence_rate_pct) : 0,
    avgRecoveryDays:     r.avg_recovery_days != null ? Number(r.avg_recovery_days) : null,
  }));

  // Effectiveness score = (1 - recurrence/100) × log(1 + cohort)
  // Higher recurrence → lower score; bigger cohort → more confidence.
  for (const c of cohorts) {
    const conf  = Math.log(1 + c.cohortSize);
    const rec   = c.recurrenceRatePct || 0;
    c.effectivenessScore = +((1 - rec / 100) * conf * 100).toFixed(1);
  }

  // Group: per diagnosis, list the candidate treatments ranked by effectiveness.
  const byDiagnosis = new Map();
  for (const c of cohorts) {
    if (!byDiagnosis.has(c.diagnosisKey)) {
      byDiagnosis.set(c.diagnosisKey, { diagnosis: c.diagnosisLabel, treatments: [] });
    }
    byDiagnosis.get(c.diagnosisKey).treatments.push(c);
  }
  const comparisons = [...byDiagnosis.values()]
    .map((d) => ({
      diagnosis:  d.diagnosis,
      treatments: d.treatments
        .sort((a, b) => b.effectivenessScore - a.effectivenessScore)
        .slice(0, 6),
    }))
    .sort((a, b) =>
      b.treatments.reduce((s, t) => s + t.cohortSize, 0)
      - a.treatments.reduce((s, t) => s + t.cohortSize, 0)
    )
    .slice(0, 12);

  // Most-effective protocol per diagnosis (cohort ≥ minCohort, smallest recurrence wins).
  const winners = comparisons.map((cmp) => {
    const best = cmp.treatments[0];
    return {
      diagnosis:        cmp.diagnosis,
      bestTreatment:    best?.treatmentLabel,
      cohortSize:       best?.cohortSize ?? 0,
      recurrenceRatePct: best?.recurrenceRatePct ?? 0,
      avgRecoveryDays:  best?.avgRecoveryDays ?? null,
    };
  });

  // KPIs
  const totalCases   = cohorts.reduce((s, c) => s + c.cohortSize, 0);
  const totalPets    = new Set(); // best-effort over distinct keys; not perfectly de-duped
  cohorts.forEach((c) => totalPets.add(`${c.diagnosisKey}:${c.uniquePets}`));
  const avgFollow    = cohorts.length
    ? +(cohorts.reduce((s, c) => s + (c.followUpRatePct || 0), 0) / cohorts.length).toFixed(1)
    : 0;
  const avgRecurr    = cohorts.length
    ? +(cohorts.reduce((s, c) => s + (c.recurrenceRatePct || 0), 0) / cohorts.length).toFixed(1)
    : 0;
  const highRecurr   = cohorts.filter((c) => (c.recurrenceRatePct || 0) >= 25).length;

  // Charts
  const recurrenceByDiagnosis = comparisons.slice(0, 10).map((cmp) => ({
    key:   cmp.diagnosis,
    count: cmp.treatments.length
      ? +(cmp.treatments.reduce((s, t) => s + (t.recurrenceRatePct || 0), 0) / cmp.treatments.length).toFixed(1)
      : 0,
  }));

  const followupRateByDiagnosis = comparisons.slice(0, 10).map((cmp) => ({
    key:   cmp.diagnosis,
    count: cmp.treatments.length
      ? +(cmp.treatments.reduce((s, t) => s + (t.followUpRatePct || 0), 0) / cmp.treatments.length).toFixed(1)
      : 0,
  }));

  const topProtocols = cohorts
    .slice() // copy
    .sort((a, b) => b.effectivenessScore - a.effectivenessScore)
    .slice(0, 10)
    .map((c) => ({
      key:   `${c.diagnosisLabel} → ${c.treatmentLabel}`,
      count: c.effectivenessScore,
    }));

  return {
    module: 'treatment',
    window: { start, end },
    kpis: {
      totalCases,
      cohorts: cohorts.length,
      diagnoses: byDiagnosis.size,
      avgFollowUpRatePct: avgFollow,
      avgRecurrenceRatePct: avgRecurr,
      highRecurrenceCohorts: highRecurr,
    },
    charts: {
      recurrenceByDiagnosis,
      followupRateByDiagnosis,
      topProtocols,
    },
    comparisons,
    winners,
  };
}

// ── 3. INVENTORY SHRINKAGE ──────────────────────────────────────

async function getInventoryShrinkage(filters = {}) {
  const { start, end } = resolveWindow(filters);

  const [rollup, expiring, txns] = await Promise.all([
    supabaseAdmin.from('v_diag_medication_rollup').select('*'),
    supabaseAdmin.from('v_diag_expiring_batches').select('*'),
    supabaseAdmin.from('medication_transactions').select('id, medication_id, txn_type, qty, unit_price_cents, occurred_at')
      .gte('occurred_at', start).lte('occurred_at', end + 'T23:59:59'),
  ]);

  if (rollup.error)   logger.error('diagnostic.inv.rollup',   rollup.error.message);
  if (expiring.error) logger.error('diagnostic.inv.expiring', expiring.error.message);
  if (txns.error)     logger.error('diagnostic.inv.txns',     txns.error.message);

  const R = rollup.data   || [];
  const E = expiring.data || [];
  const T = txns.data     || [];

  // Per-medication window aggregation
  const winByMed = new Map();
  for (const t of T) {
    if (!winByMed.has(t.medication_id)) {
      winByMed.set(t.medication_id, { used: 0, billed: 0, expired: 0, received: 0, adjustment: 0 });
    }
    const e = winByMed.get(t.medication_id);
    if (t.txn_type === 'used')       e.used       += Number(t.qty);
    if (t.txn_type === 'billed')     e.billed     += Number(t.qty);
    if (t.txn_type === 'expired')    e.expired    += Number(t.qty);
    if (t.txn_type === 'received')   e.received   += Number(t.qty);
    if (t.txn_type === 'adjustment') e.adjustment += Number(t.qty);
  }

  // Per-medication shrinkage rows
  const shrinkageRows = R.map((m) => {
    const w = winByMed.get(m.medication_id) || { used: 0, billed: 0, expired: 0, received: 0, adjustment: 0 };
    const discrepancy = w.used - w.billed;
    const unitPrice   = Number(m.unit_price_cents || 0);
    return {
      medicationId:     m.medication_id,
      sku:              m.sku,
      name:             m.name,
      category:         m.category,
      unit:             m.unit,
      stockOnHand:      Number(m.stock_on_hand) || 0,
      reorderLevel:     Number(m.reorder_level) || 0,
      usedWindow:       w.used,
      billedWindow:     w.billed,
      expiredWindow:    w.expired,
      receivedWindow:   w.received,
      adjustmentWindow: w.adjustment,
      discrepancy,
      shrinkValuePHP:   toPHP(Math.max(0, discrepancy) * unitPrice),
      lowStock:         Number(m.stock_on_hand) <= Number(m.reorder_level || 0),
    };
  });

  // Headline shrinkage = sum of positive (used - billed) discrepancies
  const totalUsed       = shrinkageRows.reduce((s, r) => s + r.usedWindow, 0);
  const totalBilled     = shrinkageRows.reduce((s, r) => s + r.billedWindow, 0);
  const totalDiscrepancy = shrinkageRows.reduce((s, r) => s + Math.max(0, r.discrepancy), 0);
  const totalShrinkPHP  = shrinkageRows.reduce((s, r) => s + r.shrinkValuePHP, 0);
  const shrinkagePct    = pct(totalDiscrepancy, totalUsed);

  const totalExpiredQty = shrinkageRows.reduce((s, r) => s + r.expiredWindow, 0);
  const lowStockCount   = shrinkageRows.filter((r) => r.lowStock).length;

  // Expiring (already-expired + within 60 days)
  const expiredBatches  = E.filter((b) => b.expiry_status === 'expired');
  const expiringSoon    = E.filter((b) => b.expiry_status === 'expiring_soon');
  const expiringValuePHP = (expiredBatches.concat(expiringSoon))
    .reduce((s, b) => {
      const med = R.find((m) => m.medication_id === b.medication_id);
      return s + toPHP((med?.unit_price_cents || 0) * Number(b.qty_received || 0));
    }, 0);

  // Charts
  const topDiscrepancies = shrinkageRows
    .slice()
    .sort((a, b) => Math.max(0, b.discrepancy) - Math.max(0, a.discrepancy))
    .slice(0, 10)
    .map((r) => ({ key: r.name, count: Math.max(0, r.discrepancy) }));

  const expiredByMedication = (() => {
    const map = new Map();
    for (const b of E) {
      if (b.expiry_status !== 'expired') continue;
      const k = b.medication_name;
      map.set(k, (map.get(k) || 0) + Number(b.qty_received || 0));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key, count]) => ({ key, count }));
  })();

  const usageVsBilled = shrinkageRows
    .filter((r) => r.usedWindow + r.billedWindow > 0)
    .slice()
    .sort((a, b) => (b.usedWindow + b.billedWindow) - (a.usedWindow + a.billedWindow))
    .slice(0, 10)
    .map((r) => ({ key: r.name, used: r.usedWindow, billed: r.billedWindow }));

  const lowStockList = shrinkageRows.filter((r) => r.lowStock).slice(0, 10)
    .map((r) => ({ key: r.name, count: r.stockOnHand }));

  return {
    module: 'shrinkage',
    window: { start, end },
    kpis: {
      totalMedications:    R.length,
      totalUsed,
      totalBilled,
      totalDiscrepancy,
      shrinkagePct,
      totalShrinkPHP:      +totalShrinkPHP.toFixed(2),
      expiredBatches:      expiredBatches.length,
      expiringSoonBatches: expiringSoon.length,
      expiringValuePHP:    +expiringValuePHP.toFixed(2),
      totalExpiredQty,
      lowStockCount,
    },
    charts: {
      topDiscrepancies,
      usageVsBilled,
      expiredByMedication,
      lowStockList,
    },
    table: shrinkageRows.sort((a, b) => Math.max(0, b.discrepancy) - Math.max(0, a.discrepancy)).slice(0, 50),
    expiringBatches: E.slice(0, 30).map((b) => ({
      batchId:        b.batch_id,
      medicationName: b.medication_name,
      batchNo:        b.batch_no,
      qty:            b.qty_received,
      expiresAt:      b.expires_at,
      daysToExpiry:   b.days_to_expiry,
      status:         b.expiry_status,
    })),
  };
}

// ── PUBLIC API ──────────────────────────────────────────────────

module.exports = {
  getChurnAnalysis,
  getTreatmentEffectiveness,
  getInventoryShrinkage,
};
