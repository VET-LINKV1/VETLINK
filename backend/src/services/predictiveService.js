/**
 * predictiveService.js
 * "Predictive Analytics" — looks FORWARD: which clients are about
 * to churn, what's the seasonal demand for medicines and services,
 * when will the clinic be busy, and which pets need follow-up?
 *
 * Four analyzers (one per dashboard tab):
 *   1. predictChurn()             — per-client churn classifier
 *   2. forecastInventoryDemand()  — seasonal forecast + low-stock risk
 *   3. forecastAppointments()     — monthly volume + density heatmap
 *   4. predictTreatmentRisk()     — pets needing follow-up + recurring conditions
 *
 * Each pulls features via supabaseAdmin then delegates the actual model
 * work to engines.js — keeping the service thin & the engines testable.
 *
 * Role gating happens upstream (authMiddleware + roleMiddleware('admin')).
 */
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');
const {
  churnEngine,
  seasonalForecastEngine,
  appointmentForecastEngine,
  treatmentRiskEngine,
  stats,
} = require('./predictive/engines');

const DAY_MS = 86400 * 1000;
const toISO  = (d) => new Date(d).toISOString().slice(0, 10);

// ── helpers ─────────────────────────────────────────────────

function resolveHorizon(req) {
  // Forecast horizon — months. Default 6, clamped to [1, 12].
  const h = parseInt(req?.horizon ?? req?.query?.horizon, 10);
  if (Number.isFinite(h)) return Math.min(Math.max(h, 1), 12);
  return 6;
}

function generatedMeta(extra = {}) {
  return {
    generated_at: new Date().toISOString(),
    ...extra,
  };
}

// ── 1. CHURN PREDICTION ─────────────────────────────────────

async function predictChurn(filters = {}) {
  const { data, error } = await supabaseAdmin
    .from('v_pred_client_features')
    .select('*');

  if (error) {
    logger.error('predictive.churn', error.message);
    throw new Error('Failed to load churn features: ' + error.message);
  }

  const result = churnEngine.predict(data || []);

  // Optional: filter list by risk_band if caller asked
  if (filters.band) {
    const bands = String(filters.band).split(',').map((s) => s.trim().toLowerCase());
    result.atRiskClients = result.atRiskClients.filter((c) => bands.includes(c.risk_band));
  }

  return {
    ...result,
    meta: generatedMeta({ model: 'decision-tree-churn-v1', features: data?.length || 0 }),
  };
}

// ── 2. INVENTORY FORECAST ───────────────────────────────────

async function forecastInventoryDemand(filters = {}) {
  const horizon = resolveHorizon(filters);

  const [usage, rollup, seasonality, monthlyDemand] = await Promise.all([
    supabaseAdmin.from('v_pred_inventory_usage_monthly').select('*'),
    supabaseAdmin.from('v_diag_medication_rollup').select('*'),
    supabaseAdmin.rpc('fn_pred_demand_seasonality', { p_lookback_months: 24 }),
    supabaseAdmin.from('v_pred_monthly_service_demand').select('*'),
  ]);

  if (usage.error)         logger.error('predictive.inv.usage',   usage.error.message);
  if (rollup.error)        logger.error('predictive.inv.rollup',  rollup.error.message);
  if (seasonality.error)   logger.error('predictive.inv.season',  seasonality.error.message);
  if (monthlyDemand.error) logger.error('predictive.inv.demand',  monthlyDemand.error.message);

  const stockOnHand = (rollup.data || []).map((r) => ({
    medication_id: r.medication_id,
    name:          r.name,
    category:      r.category,
    stock_on_hand: Number(r.stock_on_hand || 0),
    reorder_level: Number(r.reorder_level || 0),
  }));

  const medicationForecasts = seasonalForecastEngine.forecastInventory(
    usage.data || [], stockOnHand, Math.min(horizon, 6),
  );

  // Aggregate: which months across the horizon look heaviest overall?
  const monthlyTotals = new Map();
  for (const f of medicationForecasts) {
    for (const p of f.points) {
      const key = p.label;
      if (!monthlyTotals.has(key)) monthlyTotals.set(key, { key, count: 0 });
      monthlyTotals.get(key).count += p.predicted;
    }
  }
  const monthlyTotalsArr = [...monthlyTotals.values()];

  // Services demand forecast (separate, but lives here too — surface peak months)
  const serviceForecasts = seasonalForecastEngine.forecastServiceDemand(
    seasonality.data || [], monthlyDemand.data || [], Math.min(horizon, 6),
  );

  // Risk summary
  const counts = medicationForecasts.reduce((acc, f) => {
    acc[f.risk] = (acc[f.risk] || 0) + 1;
    return acc;
  }, {});

  return {
    module: 'inventory',
    horizon_months: horizon,
    kpis: {
      tracked_medications: medicationForecasts.length,
      out_of_stock:        counts.out_of_stock  || 0,
      below_reorder:       counts.below_reorder || 0,
      stockout_soon:       counts.stockout_soon || 0,
      low_cover:           counts.low           || 0,
      ok:                  counts.ok            || 0,
    },
    monthlyTotals: monthlyTotalsArr,
    medicationForecasts,
    serviceForecasts: serviceForecasts.slice(0, 12),
    meta: generatedMeta({ model: 'seasonal-naive+linreg-v1' }),
  };
}

// ── 3. APPOINTMENT FORECAST ─────────────────────────────────

async function forecastAppointments(filters = {}) {
  const horizon = resolveHorizon(filters);

  const [monthly, density] = await Promise.all([
    supabaseAdmin.from('v_pred_monthly_service_demand').select('*'),
    supabaseAdmin.from('v_pred_appointment_density').select('*'),
  ]);

  if (monthly.error) logger.error('predictive.appt.monthly', monthly.error.message);
  if (density.error) logger.error('predictive.appt.density', density.error.message);

  const monthlyForecast = appointmentForecastEngine.forecastMonthly(
    monthly.data || [], horizon,
  );
  const densityForecast = appointmentForecastEngine.forecastDensity(density.data || []);

  // Build a compact "busiest hours" chart array
  const busiestHoursArr = Object.entries(densityForecast.busiestHours || {})
    .map(([hour, count]) => ({ key: `${String(hour).padStart(2, '0')}:00`, count: Number(count) }))
    .sort((a, b) => Number(a.key.slice(0, 2)) - Number(b.key.slice(0, 2)));

  return {
    module: 'appointments',
    horizon_months: horizon,
    kpis: {
      baseline_monthly:    monthlyForecast.baseline_monthly,
      trend_slope:         monthlyForecast.trend_slope,
      history_months:      monthlyForecast.history_months,
      forecast_total:      monthlyForecast.points.reduce((s, p) => s + p.predicted, 0),
      peak_month:          monthlyForecast.points.reduce((b, p) => (p.predicted > b.predicted ? p : b), monthlyForecast.points[0] || null),
      busiest_day:         densityForecast.busiestDays?.[0]?.key || null,
      busiest_hour:        busiestHoursArr.reduce((b, h) => (h.count > (b?.count || 0) ? h : b), null)?.key || null,
    },
    monthlyForecast,
    densityForecast: {
      peaks:        densityForecast.peaks,
      busiestDays:  densityForecast.busiestDays,
      busiestHours: busiestHoursArr,
      grid:         densityForecast.grid,
    },
    meta: generatedMeta({ model: 'linreg+seasonal-naive-v1' }),
  };
}

// ── 4. TREATMENT RISK ───────────────────────────────────────

async function predictTreatmentRisk(filters = {}) {
  const [features, recurringRpc] = await Promise.all([
    supabaseAdmin.from('v_pred_pet_risk_features').select('*'),
    // Use v_diag_treatment_outcomes (from phase6) for recurring diagnoses
    supabaseAdmin.from('v_diag_treatment_outcomes').select('diagnosis_key, diagnosis_label, pet_id, next_same_diagnosis_visit, visit_date'),
  ]);

  if (features.error)     logger.error('predictive.risk.feat',    features.error.message);
  if (recurringRpc.error) logger.error('predictive.risk.recur',   recurringRpc.error.message);

  // Build top recurring diagnoses (count of distinct pets where a follow-up
  // visit happened within 90 days for the same diagnosis).
  const recur = recurringRpc.data || [];
  const m = new Map();
  for (const r of recur) {
    if (!r.next_same_diagnosis_visit) continue;
    const gap = (new Date(r.next_same_diagnosis_visit) - new Date(r.visit_date)) / DAY_MS;
    if (gap > 90) continue;
    const k = r.diagnosis_key;
    if (!m.has(k)) m.set(k, { key: r.diagnosis_label || k, count: 0, pets: new Set() });
    const e = m.get(k);
    e.count += 1;
    if (r.pet_id) e.pets.add(r.pet_id);
  }
  const recurringDiagnoses = [...m.values()]
    .map((e) => ({ key: e.key, count: e.count, unique_pets: e.pets.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const result = treatmentRiskEngine.predict(features.data || [], recurringDiagnoses);

  return {
    ...result,
    meta: generatedMeta({ model: 'rule-based-pet-risk-v1', features: features.data?.length || 0 }),
  };
}

// ── 5. SUMMARY (parallel fetch of all four) ─────────────────

async function getPredictiveSummary(filters = {}) {
  const [churn, inventory, appointments, treatment] = await Promise.all([
    predictChurn(filters).catch((e)        => ({ error: e.message })),
    forecastInventoryDemand(filters).catch((e) => ({ error: e.message })),
    forecastAppointments(filters).catch((e)    => ({ error: e.message })),
    predictTreatmentRisk(filters).catch((e)    => ({ error: e.message })),
  ]);
  return {
    module: 'summary',
    churn,
    inventory,
    appointments,
    treatment,
    meta: generatedMeta(),
  };
}

module.exports = {
  predictChurn,
  forecastInventoryDemand,
  forecastAppointments,
  predictTreatmentRisk,
  getPredictiveSummary,
  // expose engines for direct testing if useful
  _engines: { churnEngine, seasonalForecastEngine, appointmentForecastEngine, treatmentRiskEngine, stats },
};
