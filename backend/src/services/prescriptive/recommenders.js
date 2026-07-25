/**
 * recommenders.js
 * Pure-JS recommendation engines used by prescriptiveService.
 *
 * Each engine takes already-fetched features and returns a list of
 * concrete, actionable recommendations.
 */

// ── helpers ─────────────────────────────────────────────────
const MIN_MS  = 60   * 1000;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

function newId(prefix = 'rec') {
  return prefix + '_' + Math.random().toString(36).slice(2, 10);
}

function pushRec(list, partial) {
  list.push({
    id:       newId(),
    priority: partial.priority || 'medium',
    status:   'open',
    ...partial,
  });
}

function minsBetween(a, b) {
  return Math.round((new Date(a) - new Date(b)) / MIN_MS);
}

// ── 1. SCHEDULING ────────────────────────────────────────────
const SURGERY_KEYWORDS = ['surgery', 'spay', 'neuter', 'dental', 'orthopedic'];
function isSurgicalService(service = '') {
  const s = String(service).toLowerCase();
  return SURGERY_KEYWORDS.some((k) => s.includes(k));
}

const schedulingRecommender = {
  generate({ upcoming = [], conflicts = [], equipment = [], vetLoad = [] }) {
    const recs = [];

    for (const c of conflicts) {
      const overlap = Math.min(
        minsBetween(c.end_a, c.start_b),
        minsBetween(c.end_b, c.start_a),
      );
      pushRec(recs, {
        module:       'scheduling',
        priority:     'critical',
        subject_type: 'appointment',
        subject_id:   c.appointment_a,
        title:        `Vet double-booked: ${c.vet_name || 'Unknown vet'}`,
        body:         `Appointments ${String(c.appointment_a).slice(0, 8)} and ${String(c.appointment_b).slice(0, 8)} overlap by ~${overlap} mins.`,
        suggested_action: 'Move one appointment to the next free slot for this vet (or reassign to another available vet).',
        meta: {
          vet_id: c.vet_id, vet_name: c.vet_name,
          appointment_a: c.appointment_a, appointment_b: c.appointment_b,
          start_a: c.start_a, end_a: c.end_a, start_b: c.start_b, end_b: c.end_b,
          overlap_mins: overlap,
        },
      });
    }

    const surgicalAppts = upcoming.filter((a) => isSurgicalService(a.service));
    const equipmentByCategory = new Map();
    for (const e of equipment) {
      const k = (e.category || 'other').toLowerCase();
      if (!equipmentByCategory.has(k)) equipmentByCategory.set(k, []);
      equipmentByCategory.get(k).push(e);
    }

    for (const a of surgicalAppts) {
      const pool = equipmentByCategory.get('surgical') || [];
      const earliest = pool
        .map((e) => new Date(e.available_after || Date.now()))
        .sort((x, y) => x - y)[0];

      if (!pool.length) {
        pushRec(recs, {
          module: 'scheduling', priority: 'high', subject_type: 'appointment', subject_id: a.id,
          title: 'No surgical equipment registered',
          body: `${a.service} at ${a.appointment_at} has no surgical kit on file.`,
          suggested_action: 'Add at least one surgical kit to the equipment catalogue.',
          meta: { appointment_id: a.id, service: a.service, vet: a.vet_name },
        });
        continue;
      }

      const apptStart = new Date(a.appointment_at);
      if (earliest && earliest > apptStart) {
        const lateMins = Math.round((earliest - apptStart) / MIN_MS);
        pushRec(recs, {
          module: 'scheduling', priority: 'high', subject_type: 'appointment', subject_id: a.id,
          title: 'Equipment sterilization conflict',
          body: `Surgical kit won't be ready for ${a.appointment_at} — earliest available ${earliest.toISOString().slice(0, 16).replace('T', ' ')} (~${lateMins} mins late).`,
          suggested_action: `Push appointment by at least ${lateMins} minutes or use an alternate kit.`,
          meta: { appointment_id: a.id, scheduled_at: a.appointment_at, earliest_ready_at: earliest.toISOString(), late_mins: lateMins },
        });
      }
    }

    const loaded = vetLoad.filter((v) => v.utilization_pct != null);
    const sortedByUtil = [...loaded].sort((a, b) => (b.utilization_pct - a.utilization_pct));
    const overloaded   = sortedByUtil.filter((v) => v.utilization_pct >= 90);
    const underloaded  = sortedByUtil.filter((v) => v.utilization_pct <= 40);

    for (const v of overloaded) {
      pushRec(recs, {
        module: 'scheduling', priority: 'medium', subject_type: 'global',
        title: `${v.vet_name} is over-booked (${v.utilization_pct}%)`,
        body: `${v.upcoming_count} upcoming appointments (${v.upcoming_minutes} mins) vs ${v.monthly_avail_minutes} mins of monthly availability.`,
        suggested_action: underloaded.length
          ? `Redistribute new bookings to ${underloaded.slice(0, 2).map((u) => u.vet_name).join(' or ')}.`
          : 'Consider extending availability or adding a locum.',
        meta: { vet_id: v.vet_id, utilization_pct: v.utilization_pct },
      });
    }

    const leastBusy = underloaded[0] || (loaded.length ? loaded[loaded.length - 1] : null);
    if (leastBusy) {
      pushRec(recs, {
        module: 'scheduling', priority: 'low', subject_type: 'global',
        title: `Best vet to book next: ${leastBusy.vet_name}`,
        body: `Utilization sits at ${leastBusy.utilization_pct ?? 0}% — capacity to take on more work.`,
        suggested_action: 'Default new bookings to this vet for the next 14 days.',
        meta: { vet_id: leastBusy.vet_id, utilization_pct: leastBusy.utilization_pct },
      });
    }

    return {
      module: 'scheduling',
      kpis: {
        upcomingAppointments: upcoming.length,
        conflictsCount:       conflicts.length,
        surgicalAppointments: surgicalAppts.length,
        equipmentReady:       equipment.filter((e) => e.status === 'ready').length,
        equipmentSterilizing: equipment.filter((e) => e.status === 'sterilizing').length,
        overloadedVets:       overloaded.length,
        underloadedVets:      underloaded.length,
      },
      recommendations: recs,
      conflicts,
      vetLoad: loaded,
      equipmentStatus: equipment,
    };
  },
};

// ── 2. WELLNESS ──────────────────────────────────────────────
function lifeStage(species, age) {
  const s = String(species || '').toLowerCase();
  const a = Number.isFinite(Number(age)) ? Number(age) : 0;
  if (s.includes('cat')) {
    if (a <  1) return 'kitten';
    if (a <  7) return 'adult';
    if (a < 11) return 'mature';
    return 'senior';
  }
  if (s.includes('dog') || !s) {
    if (a <  1) return 'puppy';
    if (a <  7) return 'adult';
    if (a < 10) return 'mature';
    return 'senior';
  }
  if (a <  1) return 'juvenile';
  if (a <  7) return 'adult';
  return 'senior';
}

function exerciseFor(stage, species, weight) {
  const isDog = String(species || '').toLowerCase().includes('dog');
  if (stage === 'puppy' || stage === 'kitten')
    return '4–5 short play sessions per day (5–10 mins each). Focus on socialisation.';
  if (stage === 'senior')
    return isDog ? '2 gentle walks per day (15–20 mins) on soft ground.' : 'Indoor interactive toys; 2–3 short play sessions per day.';
  if (stage === 'mature')
    return isDog ? '1 brisk walk + 1 short walk per day (30 + 15 mins).' : 'Daily 15–20 min play; encourage climbing.';
  if (weight && weight >= 25) return 'High-energy: 60 mins active exercise per day.';
  if (weight && weight >= 10) return '45 mins active exercise per day.';
  return 'Moderate: 30 mins active play per day.';
}

function nutritionFor(stage, species, weight) {
  const isDog = String(species || '').toLowerCase().includes('dog');
  const w = Number.isFinite(Number(weight)) && Number(weight) > 0 ? Number(weight) : null;
  const portion = (() => {
    if (!w) return 'Vet-prescribed portion.';
    if (isDog) {
      const kcal = Math.round(70 * Math.pow(w, 0.75));
      return `~${kcal} kcal/day (split into 2 meals).`;
    }
    const kcal = Math.round(50 * Math.pow(w, 0.67));
    return `~${kcal} kcal/day across 3–4 meals.`;
  })();
  if (stage === 'puppy' || stage === 'kitten') return `Growth formula, high protein. ${portion} Feed 3–4× daily.`;
  if (stage === 'senior') return `Senior formula, joint support (glucosamine). ${portion}`;
  if (stage === 'mature') return `Adult maintenance with controlled fat. ${portion}`;
  return `Adult balanced formula. ${portion}`;
}

function followupCadence(stage) {
  if (stage === 'puppy' || stage === 'kitten') return 30;
  if (stage === 'senior') return 90;
  if (stage === 'mature') return 180;
  return 365;
}

const wellnessRecommender = {
  buildPlan(pet = {}) {
    const stage = lifeStage(pet.species, pet.age);
    const cadenceDays = followupCadence(stage);

    let lastVisit = null;
    if (pet.last_visit_date) {
      const d = new Date(pet.last_visit_date);
      if (!Number.isNaN(d.getTime())) lastVisit = d;
    }
    const nextDue = lastVisit
      ? new Date(lastVisit.getTime() + cadenceDays * 86400000)
      : new Date(Date.now() + cadenceDays * 86400000);
    const nextDueStr = Number.isNaN(nextDue.getTime())
      ? 'TBD'
      : nextDue.toISOString().slice(0, 10);
    const isOverdue = lastVisit && (Date.now() - lastVisit.getTime()) / 86400000 > cadenceDays;

    const recentDx = Array.isArray(pet.recent_diagnoses)
      ? pet.recent_diagnoses.filter(Boolean).slice(0, 3)
      : [];

    let priority = 'low';
    if (recentDx.length >= 2) priority = 'medium';
    if (isOverdue)            priority = 'high';
    if (isOverdue && recentDx.length) priority = 'critical';

    return {
      pet_id:        pet.pet_id,
      pet_name:      pet.pet_name,
      species:       pet.species,
      breed:         pet.breed,
      age:           pet.age,
      weight_kg:     pet.weight_kg,
      owner_name:    pet.owner_name,
      life_stage:    stage,
      priority,
      is_overdue:    !!isOverdue,
      plan: {
        nutrition:    nutritionFor(stage, pet.species, pet.weight_kg),
        exercise:     exerciseFor(stage, pet.species, Number(pet.weight_kg)),
        followup:     `Next wellness check around ${nextDueStr} (every ${cadenceDays} days for ${stage}s).`,
        watchpoints:  recentDx.length
          ? `Monitor for recurrence of: ${recentDx.join(', ')}.`
          : 'No flagged conditions on record. Watch for changes in appetite, weight, and energy.',
        vaccinations: stage === 'puppy' || stage === 'kitten'
          ? 'Continue vaccine series (6, 9, 12, 16 weeks). Rabies at 16 weeks.'
          : 'Annual core vaccines (DHPPi / FVRCP). Rabies booster per local regulation.',
      },
      days_since_last_visit: pet.days_since_last_visit,
      last_visit_date:       pet.last_visit_date,
      next_due_date:         nextDueStr,
      recent_diagnoses:      recentDx,
    };
  },

  generate({ pets = [] }) {
    const plans = [];
    for (const p of pets) {
      try { plans.push(wellnessRecommender.buildPlan(p)); }
      catch (_) { /* skip malformed pet */ }
    }

    const distribution = {
      low:      plans.filter((p) => p.priority === 'low').length,
      medium:   plans.filter((p) => p.priority === 'medium').length,
      high:     plans.filter((p) => p.priority === 'high').length,
      critical: plans.filter((p) => p.priority === 'critical').length,
    };

    const recommendations = [];
    for (const p of plans) {
      if (p.priority === 'low') continue;
      const stage = p.life_stage || 'pet';
      const stageCap = stage[0] ? stage[0].toUpperCase() + stage.slice(1) : 'Pet';
      const watchList = (p.recent_diagnoses && p.recent_diagnoses.length) ? p.recent_diagnoses.join(', ') : 'none';
      const followupStr = (p.plan && p.plan.followup) ? p.plan.followup : 'an upcoming wellness check';
      const followupShort = followupStr.toLowerCase().split('.')[0];
      pushRec(recommendations, {
        module: 'wellness', priority: p.priority, subject_type: 'pet', subject_id: p.pet_id,
        title: `Wellness plan ready for ${p.pet_name || 'pet'}`,
        body: p.is_overdue
          ? `Overdue ${p.days_since_last_visit ?? '?'} days for a ${stage} wellness check.`
          : `${stageCap} plan with watchpoints: ${watchList}.`,
        suggested_action: `Schedule ${followupShort}; share nutrition + exercise plan with owner.`,
        meta: { pet_id: p.pet_id, life_stage: stage, priority: p.priority },
      });
    }

    return {
      module: 'wellness',
      kpis: {
        pets_evaluated:  plans.length,
        plans_critical:  distribution.critical,
        plans_high:      distribution.high,
        plans_overdue:   plans.filter((p) => p.is_overdue).length,
      },
      distribution,
      plans,
      recommendations,
    };
  },
};

// ── 3. ORDERING ──────────────────────────────────────────────
const orderingRecommender = {
  generate({ medications = [], recentUsage = [], demandByCategory = [], horizonDays = 30 }) {
    const recentMap = new Map(recentUsage.map((r) => [r.medication_id, Number(r.qty_used || 0)]));
    const demandByCat = new Map();
    for (const d of demandByCategory) {
      demandByCat.set((d.category || 'other').toLowerCase(), Number(d.estimated_units || 0));
    }

    const items = medications.map((m) => {
      const stock        = Number(m.stock_on_hand || 0);
      const reorder      = Number(m.reorder_level || 0);
      const recent90     = recentMap.get(m.medication_id) || 0;
      const dailyUsage   = recent90 / 90;
      const horizonNeed  = Math.ceil(dailyUsage * horizonDays);
      const catKey       = (m.category || 'other').toLowerCase();
      const catUnits     = demandByCat.get(catKey) || 0;
      const catMedsCount = medications.filter((x) => (x.category || '').toLowerCase() === catKey).length || 1;
      const catShare     = Math.ceil(catUnits / catMedsCount);
      const projectedNeed = horizonNeed + catShare;
      const target = Math.max(reorder, projectedNeed);
      const suggestedQty = Math.max(0, target - stock);

      let priority = 'low';
      if (stock <= 0)                    priority = 'critical';
      else if (stock <= reorder)         priority = 'high';
      else if (dailyUsage > 0 && stock / dailyUsage < 14) priority = 'high';
      else if (dailyUsage > 0 && stock / dailyUsage < 30) priority = 'medium';

      const unitPrice = Number(m.unit_price_cents || 0);
      const estimatedCostCentavos = suggestedQty * unitPrice;

      return {
        medication_id: m.medication_id, sku: m.sku, name: m.name, category: m.category, unit: m.unit,
        stock_on_hand: stock, reorder_level: reorder,
        daily_usage:   +dailyUsage.toFixed(2),
        days_of_cover: dailyUsage > 0 ? +(stock / dailyUsage).toFixed(1) : null,
        projected_need: projectedNeed,
        suggested_qty:  suggestedQty,
        estimated_cost_php: Math.round(estimatedCostCentavos / 100),
        priority,
      };
    });

    const purchaseOrder = items
      .filter((i) => i.suggested_qty > 0)
      .sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        return (order[a.priority] - order[b.priority]) || (b.suggested_qty - a.suggested_qty);
      });

    const recommendations = [];
    for (const i of purchaseOrder) {
      if (i.priority === 'low') continue;
      pushRec(recommendations, {
        module: 'ordering', priority: i.priority, subject_type: 'medication', subject_id: i.medication_id,
        title: `Order ${i.suggested_qty} × ${i.name}`,
        body: `Stock=${i.stock_on_hand}, reorder=${i.reorder_level}, ${i.days_of_cover != null ? i.days_of_cover + ' days of cover' : 'no recent usage'}. Est. ₱${i.estimated_cost_php.toLocaleString()}.`,
        suggested_action: i.priority === 'critical' || i.priority === 'high'
          ? `Generate purchase order today for ${i.suggested_qty} × ${i.name}.`
          : `Add ${i.suggested_qty} × ${i.name} to the next weekly order.`,
        meta: i,
      });
    }

    const totalCost = purchaseOrder.reduce((s, i) => s + i.estimated_cost_php, 0);

    return {
      module: 'ordering',
      horizon_days: horizonDays,
      kpis: {
        line_items:        purchaseOrder.length,
        total_units:       purchaseOrder.reduce((s, i) => s + i.suggested_qty, 0),
        critical_items:    purchaseOrder.filter((i) => i.priority === 'critical').length,
        high_items:        purchaseOrder.filter((i) => i.priority === 'high').length,
        estimated_cost_php: totalCost,
      },
      purchaseOrder,
      recommendations,
      topQtyChart: purchaseOrder.slice(0, 10).map((i) => ({ key: i.name, count: i.suggested_qty })),
    };
  },
};

module.exports = {
  schedulingRecommender,
  wellnessRecommender,
  orderingRecommender,
  _helpers: { lifeStage, isSurgicalService, clamp, minsBetween },
};
