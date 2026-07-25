/**
 * engines.js
 * Pure-JS prediction engines used by predictiveService.
 *
 * Nothing here touches the database — everything is a function from
 * features → predictions, so the engines are unit-testable in isolation.
 *
 * Exports:
 *   churnEngine            — decision-tree-style classifier + risk scoring
 *   seasonalForecastEngine — naive seasonal index forecaster (mean-of-month)
 *   appointmentForecastEngine — moving-average + density forecasting
 *   treatmentRiskEngine    — rule-based risk classifier for follow-up needs
 *   stats                  — generic helpers (mean, std, linearRegression, ...)
 */

// ── 0. Generic statistical helpers ───────────────────────────

const stats = {
  mean(arr) {
    if (!arr || !arr.length) return 0;
    return arr.reduce((s, v) => s + Number(v || 0), 0) / arr.length;
  },
  std(arr) {
    if (!arr || arr.length < 2) return 0;
    const m = stats.mean(arr);
    const sq = arr.reduce((s, v) => s + (Number(v) - m) ** 2, 0);
    return Math.sqrt(sq / (arr.length - 1));
  },
  // Simple linear regression: returns { slope, intercept, predict(x) }
  linearRegression(xs, ys) {
    const n = xs.length;
    if (n < 2) return { slope: 0, intercept: stats.mean(ys), predict: () => stats.mean(ys) };
    const mx = stats.mean(xs);
    const my = stats.mean(ys);
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - mx) * (ys[i] - my);
      den += (xs[i] - mx) ** 2;
    }
    const slope = den === 0 ? 0 : num / den;
    const intercept = my - slope * mx;
    return { slope, intercept, predict: (x) => slope * x + intercept };
  },
  // Sigmoid → maps any real number to [0,1]
  sigmoid(z) { return 1 / (1 + Math.exp(-z)); },
  // Clamp helper
  clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); },
  // Safe percent: returns 0 when denom is falsy
  pct(num, den) { return den ? +((num / den) * 100).toFixed(2) : 0; },
};

// ── 1. CHURN ENGINE ──────────────────────────────────────────
// Decision-tree-style classifier over per-client features.
// The model is interpretable on purpose — every prediction carries
// the rules that fired, so the dashboard can explain why.
//
// Feature schema (per client):
//   total_appointments, completed_count, cancelled_count, missed_count,
//   days_since_last_visit, lifetime_spend_centavos,
//   spend_recent_centavos, spend_prior_centavos,
//   visits_recent_90d,    visits_prior_90d,
//   recent_missed_count
//
// Output: { risk_score (0-100), risk_band, reasons: [...] }

function scoreClientChurn(f) {
  const reasons = [];
  let score = 0;

  // ── Inactivity (strongest signal) ─────────────────────────
  const days = f.days_since_last_visit;
  if (days == null) {
    score += 25;
    reasons.push({ key: 'no_visits_yet', label: 'No completed visits on record', weight: 25 });
  } else if (days >= 365) {
    score += 50;
    reasons.push({ key: 'inactive_365', label: 'Inactive for 12+ months', weight: 50 });
  } else if (days >= 180) {
    score += 35;
    reasons.push({ key: 'inactive_180', label: 'Inactive for 6+ months', weight: 35 });
  } else if (days >= 90) {
    score += 18;
    reasons.push({ key: 'inactive_90', label: 'Inactive for 3+ months', weight: 18 });
  } else if (days >= 45) {
    score += 8;
    reasons.push({ key: 'inactive_45', label: 'Inactive for 6+ weeks', weight: 8 });
  }

  // ── Missed / cancelled patterns ───────────────────────────
  const missedLifetime = (f.missed_count || 0) + (f.cancelled_count || 0);
  const missedRate = stats.pct(missedLifetime, f.total_appointments || 1);
  if (f.recent_missed_count >= 3) {
    score += 18;
    reasons.push({ key: 'recent_missed', label: `${f.recent_missed_count} recent no-shows or cancellations`, weight: 18 });
  } else if (f.recent_missed_count >= 1) {
    score += 7;
    reasons.push({ key: 'some_missed',  label: `${f.recent_missed_count} recent missed appointments`, weight: 7 });
  }
  if (missedRate >= 50 && f.total_appointments >= 3) {
    score += 12;
    reasons.push({ key: 'high_missed_rate', label: `${missedRate}% of all appointments missed or cancelled`, weight: 12 });
  }

  // ── Spend trend ───────────────────────────────────────────
  const prior  = Number(f.spend_prior_centavos  || 0);
  const recent = Number(f.spend_recent_centavos || 0);
  if (prior > 0) {
    const change = (recent - prior) / prior;
    if (change <= -0.6 && prior >= 50000) { // ≥ ₱500 prior with >60% drop
      score += 15;
      reasons.push({ key: 'spend_drop_big',   label: 'Spending dropped >60% vs prior period', weight: 15 });
    } else if (change <= -0.3 && prior >= 20000) {
      score += 8;
      reasons.push({ key: 'spend_drop_small', label: 'Spending dropped >30% vs prior period', weight: 8 });
    } else if (change >= 0.2) {
      score -= 6; // engaged
      reasons.push({ key: 'spend_up',         label: 'Spending increasing vs prior period', weight: -6 });
    }
  }

  // ── Visit cadence (decision-tree leaf) ────────────────────
  if (f.visits_prior_90d >= 2 && f.visits_recent_90d === 0) {
    score += 14;
    reasons.push({ key: 'visit_dropoff', label: 'Visited frequently before, none in last 90 days', weight: 14 });
  }

  // ── Tenure dampener: long-tenure but inactive is worse ────
  // (more interpretable than the raw days_since count)
  // No score change — already captured above, but used for confidence below.

  // ── Engagement floor for high-spenders who recently visited ─
  if (f.visits_recent_90d >= 2 && (f.cancelled_count || 0) === 0) {
    score -= 12;
    reasons.push({ key: 'highly_engaged', label: 'Multiple recent visits, no cancellations', weight: -12 });
  }

  // Clamp
  score = stats.clamp(Math.round(score), 0, 100);

  let band;
  if      (score >= 70) band = 'critical';
  else if (score >= 45) band = 'high';
  else if (score >= 25) band = 'medium';
  else                  band = 'low';

  return {
    risk_score: score,
    risk_band:  band,
    reasons,
    // Probability proxy via sigmoid on centered score
    probability: +stats.sigmoid((score - 50) / 12).toFixed(3),
  };
}

const churnEngine = {
  /**
   * @param {Array<Object>} features — rows from v_pred_client_features
   * @returns {Object} { population, distribution, atRisk, drivers }
   */
  predict(features) {
    const scored = features.map((f) => ({
      clientId:               f.client_id,
      clientName:             f.client_name,
      clientEmail:            f.client_email,
      daysSinceLastVisit:     f.days_since_last_visit,
      totalAppointments:      f.total_appointments,
      missedCount:            (f.missed_count || 0) + (f.cancelled_count || 0),
      lifetimeSpendPHP:       Math.round((f.lifetime_spend_centavos || 0) / 100),
      ...scoreClientChurn(f),
    }));

    const distribution = {
      low:      scored.filter((s) => s.risk_band === 'low').length,
      medium:   scored.filter((s) => s.risk_band === 'medium').length,
      high:     scored.filter((s) => s.risk_band === 'high').length,
      critical: scored.filter((s) => s.risk_band === 'critical').length,
    };

    const atRisk = scored
      .filter((s) => s.risk_band === 'high' || s.risk_band === 'critical')
      .sort((a, b) => b.risk_score - a.risk_score);

    // Driver aggregation: how often each reason fired across the at-risk set
    const driverMap = new Map();
    for (const s of atRisk) {
      for (const r of s.reasons) {
        if (r.weight <= 0) continue;
        if (!driverMap.has(r.key)) driverMap.set(r.key, { key: r.label, count: 0, weight: 0 });
        const e = driverMap.get(r.key);
        e.count  += 1;
        e.weight += r.weight;
      }
    }
    const drivers = [...driverMap.values()].sort((a, b) => b.count - a.count);

    return {
      module:       'churn',
      population:   scored.length,
      distribution,
      atRiskCount:  atRisk.length,
      atRiskShare:  stats.pct(atRisk.length, scored.length),
      averageScore: Math.round(stats.mean(scored.map((s) => s.risk_score))),
      drivers,
      atRiskClients: atRisk.slice(0, 100), // cap response size
    };
  },
};

// ── 2. SEASONAL FORECAST (inventory & service demand) ────────
// Naive seasonal index: for each (service, month_of_year), use the
// average historical demand. We also report low-stock risk by
// comparing forecasted demand to current stock on hand.
//
// Input schemas:
//   seasonality:    [{ service, month_of_year, avg_demand, sample_size }]
//   monthlyDemand:  [{ year, month, service, appointment_count, ... }]
//   inventoryUsage: [{ year, month, medication_id, medication_name, qty_used, ... }]
//   stockOnHand:    [{ medication_id, name, category, stock_on_hand, reorder_level }]

function nextNMonths(n, base = new Date()) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
    out.push({
      year:  d.getFullYear(),
      month: d.getMonth() + 1,
      label: d.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
    });
  }
  return out;
}

const seasonalForecastEngine = {
  /**
   * Forecast appointment demand by service for the next N months.
   * Uses seasonal index (mean per month-of-year) × overall trend.
   */
  forecastServiceDemand(seasonality, monthlyDemand, horizon = 6) {
    // Build trend per service via linear regression on the time index.
    const byService = new Map();
    for (const r of monthlyDemand) {
      if (!byService.has(r.service)) byService.set(r.service, []);
      byService.get(r.service).push(r);
    }

    const months = nextNMonths(horizon);
    const services = [...byService.keys()];

    const seasonalIdx = new Map(); // service → month → avg_demand
    for (const r of seasonality) {
      if (!seasonalIdx.has(r.service)) seasonalIdx.set(r.service, new Map());
      seasonalIdx.get(r.service).set(Number(r.month_of_year), Number(r.avg_demand));
    }

    // Forecast each service over the horizon
    const forecasts = services.map((service) => {
      const rows = byService.get(service)
        .sort((a, b) => (a.year - b.year) || (a.month - b.month));
      const xs = rows.map((_, i) => i);
      const ys = rows.map((r) => Number(r.appointment_count || 0));
      const trend = stats.linearRegression(xs, ys);
      const baseline = stats.mean(ys);
      // overallMean of seasonal index — used to convert index into multiplier
      const idxMap = seasonalIdx.get(service) || new Map();
      const idxValues = [...idxMap.values()];
      const idxMean = idxValues.length ? stats.mean(idxValues) : baseline;

      const points = months.map((m, i) => {
        const trendVal = Math.max(0, trend.predict(xs.length + i));
        const seasonal = idxMap.get(m.month) ?? idxMean;
        const multiplier = idxMean ? seasonal / idxMean : 1;
        const predicted = Math.max(0, Math.round(trendVal * multiplier));
        return { ...m, predicted, multiplier: +multiplier.toFixed(2), trend: Math.round(trendVal) };
      });

      const totalHorizon = points.reduce((s, p) => s + p.predicted, 0);
      const peakMonth = points.reduce((best, p) => (p.predicted > best.predicted ? p : best), points[0]);

      return {
        service,
        history_months: rows.length,
        baseline:       Math.round(baseline),
        trend_slope:    +trend.slope.toFixed(2),
        total_horizon:  totalHorizon,
        peak: peakMonth ? { label: peakMonth.label, predicted: peakMonth.predicted } : null,
        points,
      };
    });

    return forecasts.sort((a, b) => b.total_horizon - a.total_horizon);
  },

  /**
   * Forecast medication demand & flag low-stock risks.
   */
  forecastInventory(inventoryUsage, stockOnHand, horizon = 3) {
    const byMed = new Map();
    for (const r of inventoryUsage) {
      const id = r.medication_id;
      if (!byMed.has(id)) byMed.set(id, []);
      byMed.get(id).push(r);
    }

    const stockMap = new Map(stockOnHand.map((s) => [s.medication_id, s]));
    const months = nextNMonths(horizon);

    const forecasts = [...byMed.entries()].map(([mid, rows]) => {
      const sorted = rows.sort((a, b) => (a.year - b.year) || (a.month - b.month));
      const xs = sorted.map((_, i) => i);
      const ys = sorted.map((r) => Number(r.qty_used || 0));
      const trend = stats.linearRegression(xs, ys);
      const monthly = sorted.length ? stats.mean(ys) : 0;
      // Seasonal index per month-of-year for this medication
      const idxMap = new Map();
      for (const r of sorted) {
        const k = Number(r.month);
        if (!idxMap.has(k)) idxMap.set(k, []);
        idxMap.get(k).push(Number(r.qty_used || 0));
      }
      const monthAvgs = new Map();
      for (const [k, vals] of idxMap) monthAvgs.set(k, stats.mean(vals));
      const overallAvg = monthly || 1;

      const points = months.map((m, i) => {
        const trendVal = Math.max(0, trend.predict(xs.length + i));
        const seasonal = monthAvgs.get(m.month) ?? overallAvg;
        const multiplier = overallAvg ? seasonal / overallAvg : 1;
        const predicted = Math.max(0, Math.round(trendVal * multiplier));
        return { ...m, predicted };
      });

      const horizonDemand = points.reduce((s, p) => s + p.predicted, 0);
      const stock = stockMap.get(mid) || {};
      const stockOnHandQty = Number(stock.stock_on_hand || 0);
      const reorder        = Number(stock.reorder_level || 0);

      // Months of cover at average forecasted demand
      const avgMonthly = horizonDemand / horizon || 0;
      const monthsOfCover = avgMonthly ? +(stockOnHandQty / avgMonthly).toFixed(1) : null;
      let risk = 'ok';
      if (stockOnHandQty <= 0)              risk = 'out_of_stock';
      else if (stockOnHandQty <= reorder)   risk = 'below_reorder';
      else if (monthsOfCover != null && monthsOfCover < 1) risk = 'stockout_soon';
      else if (monthsOfCover != null && monthsOfCover < 2) risk = 'low';

      return {
        medication_id: mid,
        name:          sorted[0]?.medication_name || stock.name || 'Unknown',
        category:      sorted[0]?.category || stock.category || null,
        unit:          sorted[0]?.unit     || null,
        reorder_level: reorder,
        stock_on_hand: stockOnHandQty,
        avg_monthly_usage: Math.round(monthly),
        trend_slope:   +trend.slope.toFixed(2),
        horizon_demand: horizonDemand,
        months_of_cover: monthsOfCover,
        risk,
        points,
      };
    });

    return forecasts.sort((a, b) => {
      const order = { out_of_stock: 0, below_reorder: 1, stockout_soon: 2, low: 3, ok: 4 };
      return (order[a.risk] - order[b.risk]) || (b.horizon_demand - a.horizon_demand);
    });
  },
};

// ── 3. APPOINTMENT FORECAST ──────────────────────────────────
// Two outputs:
//   (a) Total appointments per upcoming month (moving avg + trend)
//   (b) Hour-of-day × Day-of-week density heatmap (busy patterns)

const appointmentForecastEngine = {
  forecastMonthly(monthlyDemand, horizon = 6) {
    // Roll monthlyDemand to total per (year, month) ignoring service
    const byMonth = new Map();
    for (const r of monthlyDemand) {
      const k = `${r.year}-${String(r.month).padStart(2, '0')}`;
      if (!byMonth.has(k)) byMonth.set(k, { year: r.year, month: r.month, count: 0 });
      byMonth.get(k).count += Number(r.appointment_count || 0);
    }
    const rows = [...byMonth.values()].sort(
      (a, b) => (a.year - b.year) || (a.month - b.month)
    );
    const xs = rows.map((_, i) => i);
    const ys = rows.map((r) => r.count);
    const trend = stats.linearRegression(xs, ys);
    const overallMean = stats.mean(ys);

    // Seasonal index per month-of-year
    const byMonthIdx = new Map();
    for (const r of rows) {
      if (!byMonthIdx.has(r.month)) byMonthIdx.set(r.month, []);
      byMonthIdx.get(r.month).push(r.count);
    }
    const monthIdx = new Map();
    for (const [k, vals] of byMonthIdx) monthIdx.set(k, stats.mean(vals));

    const months = nextNMonths(horizon);
    const points = months.map((m, i) => {
      const trendVal = Math.max(0, trend.predict(xs.length + i));
      const seasonal = monthIdx.get(m.month) ?? overallMean;
      const multiplier = overallMean ? seasonal / overallMean : 1;
      const predicted = Math.max(0, Math.round(trendVal * multiplier));
      return { ...m, predicted, baseline: Math.round(trendVal) };
    });

    return {
      history_months: rows.length,
      baseline_monthly: Math.round(overallMean),
      trend_slope:    +trend.slope.toFixed(2),
      points,
      historical: rows.slice(-12).map((r) => ({
        label: `${r.year}-${String(r.month).padStart(2, '0')}`,
        count: r.count,
      })),
    };
  },

  /**
   * Build a Day-of-week × Hour heatmap from density rows.
   * Highlights "peak" cells (top 10% by appointment_count).
   */
  forecastDensity(density) {
    const grid = []; // 7 rows (dow 0-6) × 24 cols
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let d = 0; d < 7; d++) {
      grid.push({ dow: d, dow_label: dayLabels[d], hours: Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 })) });
    }
    for (const r of density) {
      const dow = Number(r.dow);
      const h   = Number(r.hour_of_day);
      if (!Number.isInteger(dow) || !Number.isInteger(h) || dow < 0 || dow > 6) continue;
      if (h < 0 || h > 23) continue;
      grid[dow].hours[h].count = Number(r.appointment_count || 0);
    }

    // Peak detection
    const cells = grid.flatMap((row) => row.hours.map((cell) => ({ ...cell, dow: row.dow, dow_label: row.dow_label })));
    const counts = cells.map((c) => c.count).filter((n) => n > 0).sort((a, b) => b - a);
    const cutoff = counts[Math.floor(counts.length * 0.1)] || 1;
    const peaks = cells.filter((c) => c.count >= cutoff && c.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
      .map((c) => ({
        label: `${c.dow_label} ${String(c.hour).padStart(2, '0')}:00`,
        dow: c.dow,
        hour: c.hour,
        count: c.count,
      }));

    // Busiest day overall
    const byDay = grid.map((row) => ({
      key:   row.dow_label,
      count: row.hours.reduce((s, h) => s + h.count, 0),
    }));

    return {
      grid,
      peaks,
      busiestDays: byDay.sort((a, b) => b.count - a.count),
      busiestHours: cells.reduce((acc, c) => {
        acc[c.hour] = (acc[c.hour] || 0) + c.count;
        return acc;
      }, {}),
    };
  },
};

// ── 4. TREATMENT RISK ENGINE ─────────────────────────────────
// Rule-based classifier that flags pets needing follow-up visits
// and surfaces recurring medical conditions.
//
// Input schema (per pet) from v_pred_pet_risk_features.

function scorePetRisk(p) {
  const reasons = [];
  let score = 0;

  // ── Recurring diagnoses ────────────────────────────────────
  if (p.recurring_events >= 3) {
    score += 35;
    reasons.push({ key: 'recurring_3p', label: `${p.recurring_events} recurring diagnoses`, weight: 35 });
  } else if (p.recurring_events >= 1) {
    score += 18;
    reasons.push({ key: 'recurring_1p', label: `${p.recurring_events} recurring diagnosis`, weight: 18 });
  }

  // ── Diagnosis diversity ────────────────────────────────────
  if (p.distinct_diagnoses >= 5) {
    score += 18;
    reasons.push({ key: 'many_diagnoses', label: `${p.distinct_diagnoses} distinct diagnoses on record`, weight: 18 });
  } else if (p.distinct_diagnoses >= 3) {
    score += 8;
    reasons.push({ key: 'multi_diagnoses', label: `${p.distinct_diagnoses} distinct diagnoses`, weight: 8 });
  }

  // ── Follow-up not yet scheduled ────────────────────────────
  if (p.visit_count >= 1 && p.followups_scheduled === 0) {
    score += 12;
    reasons.push({ key: 'no_followup', label: 'No follow-up scheduled', weight: 12 });
  }

  // ── Age risk ───────────────────────────────────────────────
  const age = Number(p.age || 0);
  if (age >= 12) {
    score += 14;
    reasons.push({ key: 'senior_12p', label: 'Senior pet (12+ yrs)', weight: 14 });
  } else if (age >= 8) {
    score += 7;
    reasons.push({ key: 'senior_8p',  label: 'Mature pet (8+ yrs)',  weight: 7 });
  }

  // ── Recency / overdue follow-ups ───────────────────────────
  if (p.next_followup_date) {
    const due = new Date(p.next_followup_date);
    const today = new Date();
    const daysOverdue = Math.floor((today - due) / 86400000);
    if (daysOverdue > 30) {
      score += 16;
      reasons.push({ key: 'followup_overdue', label: `Follow-up overdue ${daysOverdue} days`, weight: 16 });
    } else if (daysOverdue > 0) {
      score += 8;
      reasons.push({ key: 'followup_due',     label: 'Follow-up date passed', weight: 8 });
    }
  }

  // ── No medical record at all ───────────────────────────────
  if ((p.visit_count || 0) === 0) {
    score += 3;
    reasons.push({ key: 'no_record', label: 'No medical records yet', weight: 3 });
  }

  score = stats.clamp(Math.round(score), 0, 100);
  let band;
  if      (score >= 65) band = 'critical';
  else if (score >= 40) band = 'high';
  else if (score >= 20) band = 'medium';
  else                  band = 'low';

  return { risk_score: score, risk_band: band, reasons };
}

const treatmentRiskEngine = {
  predict(features, recurringDiagnoses) {
    const scored = features.map((p) => ({
      petId:               p.pet_id,
      petName:             p.pet_name,
      species:             p.species,
      breed:               p.breed,
      age:                 p.age,
      ownerId:             p.owner_id,
      ownerName:           p.owner_name,
      visitCount:          p.visit_count,
      distinctDiagnoses:   p.distinct_diagnoses,
      followupsScheduled:  p.followups_scheduled,
      recurringEvents:     p.recurring_events,
      lastVisitDate:       p.last_visit_date,
      nextFollowupDate:    p.next_followup_date,
      ...scorePetRisk(p),
    }));

    const distribution = {
      low:      scored.filter((s) => s.risk_band === 'low').length,
      medium:   scored.filter((s) => s.risk_band === 'medium').length,
      high:     scored.filter((s) => s.risk_band === 'high').length,
      critical: scored.filter((s) => s.risk_band === 'critical').length,
    };

    const followupNeeded = scored
      .filter((s) => s.risk_band === 'high' || s.risk_band === 'critical')
      .sort((a, b) => b.risk_score - a.risk_score);

    return {
      module:            'treatment_risk',
      population:        scored.length,
      distribution,
      followupNeededCount: followupNeeded.length,
      followupShare:     stats.pct(followupNeeded.length, scored.length),
      recurringDiagnoses: recurringDiagnoses || [],
      followupList:      followupNeeded.slice(0, 100),
      // Surface a small per-species summary for the dashboard
      speciesBreakdown:  (() => {
        const m = new Map();
        for (const s of scored) {
          const k = s.species || 'Unspecified';
          if (!m.has(k)) m.set(k, { key: k, count: 0, atRisk: 0 });
          const e = m.get(k);
          e.count += 1;
          if (s.risk_band === 'high' || s.risk_band === 'critical') e.atRisk += 1;
        }
        return [...m.values()].sort((a, b) => b.atRisk - a.atRisk);
      })(),
    };
  },
};

module.exports = {
  stats,
  churnEngine,
  seasonalForecastEngine,
  appointmentForecastEngine,
  treatmentRiskEngine,
};
