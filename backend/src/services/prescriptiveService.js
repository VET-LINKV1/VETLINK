/**
 * prescriptiveService.js
 * "Prescriptive Analytics (Action Plan)" — what should we DO?
 *
 * Three analyzers (one per dashboard tab):
 *   1. recommendScheduling()     — surface conflicts, sterilization gaps, vet load
 *   2. recommendWellness()       — per-pet wellness plans
 *   3. recommendOrdering()       — purchase orders from upcoming demand + trend
 *   + getPrescriptiveSummary()    — all three in parallel
 *
 * Each pulls features via supabaseAdmin then delegates to the engines
 * in `prescriptive/recommenders.js` — keeping the service thin.
 *
 * Role gating happens upstream (authMiddleware + roleMiddleware('admin','veterinarian')).
 */
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');
const {
  schedulingRecommender,
  wellnessRecommender,
  orderingRecommender,
} = require('./prescriptive/recommenders');

function generatedMeta(extra = {}) {
  return { generated_at: new Date().toISOString(), ...extra };
}

function resolveHorizonDays(req) {
  const h = parseInt(req?.horizonDays ?? req?.horizon ?? req?.query?.horizonDays ?? req?.query?.horizon, 10);
  if (Number.isFinite(h)) return Math.min(Math.max(h, 7), 180);
  return 30;
}

// ── 1. SCHEDULING ────────────────────────────────────────────

async function recommendScheduling() {
  const [upcoming, conflicts, equipment, vetLoad] = await Promise.all([
    supabaseAdmin.from('v_presc_upcoming_appointments').select('*'),
    supabaseAdmin.rpc('fn_presc_schedule_conflicts'),
    supabaseAdmin.from('v_presc_equipment_status').select('*'),
    supabaseAdmin.from('v_presc_vet_load').select('*'),
  ]);

  if (upcoming.error)   logger.error('prescriptive.sched.upcoming', upcoming.error.message);
  if (conflicts.error)  logger.error('prescriptive.sched.conflicts', conflicts.error.message);
  if (equipment.error)  logger.error('prescriptive.sched.equip',     equipment.error.message);
  if (vetLoad.error)    logger.error('prescriptive.sched.vetload',   vetLoad.error.message);

  const result = schedulingRecommender.generate({
    upcoming:  upcoming.data || [],
    conflicts: conflicts.data || [],
    equipment: equipment.data || [],
    vetLoad:   vetLoad.data || [],
  });

  return { ...result, meta: generatedMeta({ engine: 'scheduling-rules-v1' }) };
}

// ── 2. WELLNESS ──────────────────────────────────────────────

async function recommendWellness(filters = {}) {
  const { data, error } = await supabaseAdmin
    .from('v_presc_pet_wellness_baseline')
    .select('*');

  if (error) {
    logger.error('prescriptive.wellness', error.message);
    throw new Error('Failed to load wellness baseline: ' + error.message);
  }

  // Optional filter — by pet_id, owner_id, species, life_stage
  let rows = data || [];
  if (filters.petId)   rows = rows.filter((p) => p.pet_id   === filters.petId);
  if (filters.ownerId) rows = rows.filter((p) => p.owner_id === filters.ownerId);
  if (filters.species) {
    const s = String(filters.species).toLowerCase();
    rows = rows.filter((p) => String(p.species || '').toLowerCase() === s);
  }

  const result = wellnessRecommender.generate({ pets: rows });

  return { ...result, meta: generatedMeta({ engine: 'wellness-rules-v1' }) };
}

// ── 3. ORDERING ──────────────────────────────────────────────

async function recommendOrdering(filters = {}) {
  const horizonDays = resolveHorizonDays(filters);

  const [meds, recent, demandByCat] = await Promise.all([
    supabaseAdmin.from('v_diag_medication_rollup').select('*'),
    supabaseAdmin
      .from('medication_transactions')
      .select('medication_id, qty, txn_type, occurred_at')
      .gte('occurred_at', new Date(Date.now() - 90 * 86400000).toISOString())
      .in('txn_type', ['used', 'billed']),
    supabaseAdmin.rpc('fn_presc_demand_from_upcoming', { p_horizon_days: horizonDays }),
  ]);

  if (meds.error)        logger.error('prescriptive.order.meds',   meds.error.message);
  if (recent.error)      logger.error('prescriptive.order.recent', recent.error.message);
  if (demandByCat.error) logger.error('prescriptive.order.demand', demandByCat.error.message);

  // Roll the recent transactions into per-medication 90-day usage
  const recentMap = new Map();
  for (const r of recent.data || []) {
    const k = r.medication_id;
    if (!recentMap.has(k)) recentMap.set(k, 0);
    recentMap.set(k, recentMap.get(k) + Number(r.qty || 0));
  }
  const recentUsage = [...recentMap.entries()].map(([medication_id, qty_used]) => ({
    medication_id, qty_used,
  }));

  const medications = (meds.data || []).map((m) => ({
    medication_id: m.medication_id,
    sku:           m.sku,
    name:          m.name,
    category:      m.category,
    unit:          m.unit,
    unit_price_cents: m.unit_price_cents,
    reorder_level:    m.reorder_level,
    stock_on_hand:    m.stock_on_hand,
  }));

  const result = orderingRecommender.generate({
    medications,
    recentUsage,
    demandByCategory: demandByCat.data || [],
    horizonDays,
  });

  return { ...result, meta: generatedMeta({ engine: 'ordering-rules-v1' }) };
}

// ── 4. SUMMARY ───────────────────────────────────────────────

async function getPrescriptiveSummary(filters = {}) {
  const [scheduling, wellness, ordering] = await Promise.all([
    recommendScheduling().catch((e) => ({ error: e.message })),
    recommendWellness(filters).catch((e) => ({ error: e.message })),
    recommendOrdering(filters).catch((e) => ({ error: e.message })),
  ]);

  // Roll recommendations across all three modules for a top-level "action queue"
  const allRecs = [
    ...(scheduling.recommendations || []),
    ...(wellness.recommendations   || []),
    ...(ordering.recommendations   || []),
  ];
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  allRecs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return {
    module: 'summary',
    actionQueue: allRecs.slice(0, 50),
    scheduling,
    wellness,
    ordering,
    meta: generatedMeta(),
  };
}

// ── 5. PERSIST RECOMMENDATIONS (optional) ────────────────────
// Lets the UI write a snapshot to prescriptive_recommendations for audit.

async function saveRecommendations(rows = []) {
  if (!rows.length) return { saved: 0 };
  const payload = rows.map((r) => ({
    module:       r.module,
    subject_type: r.subject_type || null,
    subject_id:   r.subject_id   || null,
    payload:      r,
    priority:     r.priority     || 'medium',
    status:       r.status       || 'open',
  }));
  const { data, error } = await supabaseAdmin
    .from('prescriptive_recommendations')
    .insert(payload)
    .select('id');
  if (error) {
    logger.error('prescriptive.save', error.message);
    throw new Error('Failed to save recommendations: ' + error.message);
  }
  return { saved: data?.length || 0 };
}

module.exports = {
  recommendScheduling,
  recommendWellness,
  recommendOrdering,
  getPrescriptiveSummary,
  saveRecommendations,
};
