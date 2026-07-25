/**
 * WellnessTab.jsx
 * Personalised wellness plans per pet — nutrition, exercise, follow-up.
 */
import { useState, useMemo } from 'react';
import {
  PawPrint, HeartPulse, CalendarClock, Search,
} from 'lucide-react';
import KpiTile from '../../components/healthcheck/KpiTile';
import ChartCard from '../../components/healthcheck/ChartCard';
import { DonutChart, HBarChart } from '../../components/healthcheck/charts';
import RecommendationCard from '../../components/prescriptive/RecommendationCard';

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function WellnessTab({ data, loading }) {
  // ── Hooks first (Rules of Hooks: call in the same order every render) ──
  const [query, setQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('all');

  const plans = data?.plans || [];

  const filteredPlans = useMemo(() => {
    const q = query.trim().toLowerCase();
    return plans
      .filter((p) => stageFilter === 'all' || p.life_stage === stageFilter)
      .filter((p) =>
        !q ||
        (p.pet_name   && p.pet_name.toLowerCase().includes(q)) ||
        (p.owner_name && p.owner_name.toLowerCase().includes(q)) ||
        (p.breed      && p.breed.toLowerCase().includes(q))
      )
      .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9));
  }, [plans, query, stageFilter]);

  // ── Now safe to early-return ──
  if (!data) {
    return (
      <div className="p-8 text-center text-slate-400 font-body text-sm border border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
        {loading ? 'Generating wellness plans…' : 'No wellness plans yet.'}
      </div>
    );
  }

  const k    = data.kpis || {};
  const dist = data.distribution || {};

  const distChart = [
    { key: 'Low',      count: dist.low      || 0 },
    { key: 'Medium',   count: dist.medium   || 0 },
    { key: 'High',     count: dist.high     || 0 },
    { key: 'Critical', count: dist.critical || 0 },
  ];

  const stageCounts = (() => {
    const m = new Map();
    for (const p of plans) {
      const key = p.life_stage || 'unknown';
      m.set(key, (m.get(key) || 0) + 1);
    }
    return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
  })();

  const stages = ['all', ...new Set(plans.map((p) => p.life_stage).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile icon={PawPrint}     color="blue"
                 label="Pets evaluated" value={k.pets_evaluated}
                 sublabel="With baseline features" />
        <KpiTile icon={HeartPulse}   color="violet"
                 label="High-priority plans" value={(k.plans_high || 0) + (k.plans_critical || 0)}
                 sublabel={`${k.plans_critical || 0} critical`} />
        <KpiTile icon={CalendarClock} color="amber"
                 label="Overdue checkups" value={k.plans_overdue}
                 sublabel="Last visit > cadence" />
        <KpiTile icon={PawPrint}     color="emerald"
                 label="Wellness plans built" value={plans.length}
                 sublabel="One per pet" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard
          title="Priority distribution"
          subtitle="Pets by attention level"
          csvFilename="wellness-priority-distribution"
          csvData={distChart}
        >
          <DonutChart data={distChart} />
        </ChartCard>
        <div className="lg:col-span-2">
          <ChartCard
            title="Pets by life stage"
            subtitle="Drives nutrition / exercise / vaccine recommendations"
            csvFilename="pets-by-life-stage"
            csvData={stageCounts}
          >
            <HBarChart data={stageCounts} />
          </ChartCard>
        </div>
      </div>

      <section>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-3">
          <h2 className="font-display text-slate-800 dark:text-white text-base font-700">
            Personalised plans
            <span className="ml-2 text-xs font-body text-slate-400">{filteredPlans.length} of {plans.length}</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pet / owner / breed"
                className="pl-7 pr-3 py-1.5 text-xs font-body rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 w-56"
              />
            </div>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="text-xs font-body px-2 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
            >
              {stages.map((s) => (
                <option key={s} value={s}>{s === 'all' ? 'All life stages' : s}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredPlans.length === 0 ? (
          <div className="p-6 text-center text-slate-400 font-body text-xs border border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
            No pets match the current filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filteredPlans.slice(0, 30).map((p) => (
              <article key={p.pet_id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm hover:shadow-md transition-shadow p-4">
                <header className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-display text-slate-800 dark:text-white text-sm font-700">
                      {p.pet_name || 'Unnamed pet'}
                      {p.species && <span className="ml-2 text-[10px] text-slate-400 uppercase tracking-wider">{p.species}</span>}
                    </h3>
                    <p className="font-body text-slate-500 dark:text-slate-400 text-xs">
                      {p.breed || 'Unknown breed'} &middot; {p.age != null ? `${p.age} yrs` : 'age —'}
                      {p.weight_kg ? ` · ${p.weight_kg} kg` : ''}
                      &middot; owner {p.owner_name || '—'}
                    </p>
                  </div>
                  <span className={`text-[10px] font-body font-700 uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                    p.priority === 'critical' ? 'bg-red-50 text-red-700 border-red-200' :
                    p.priority === 'high'     ? 'bg-orange-50 text-orange-700 border-orange-200' :
                    p.priority === 'medium'   ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {p.priority || 'low'}
                  </span>
                </header>

                <dl className="space-y-1.5 text-xs font-body">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-600">Life stage</dt>
                    <dd className="text-slate-700 dark:text-slate-200">{p.life_stage || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-600">Nutrition</dt>
                    <dd className="text-slate-700 dark:text-slate-200">{p.plan?.nutrition || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-600">Exercise</dt>
                    <dd className="text-slate-700 dark:text-slate-200">{p.plan?.exercise || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-600">Vaccinations</dt>
                    <dd className="text-slate-700 dark:text-slate-200">{p.plan?.vaccinations || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-600">Follow-up</dt>
                    <dd className="text-slate-700 dark:text-slate-200">{p.plan?.followup || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-600">Watchpoints</dt>
                    <dd className="text-slate-700 dark:text-slate-200">{p.plan?.watchpoints || '—'}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>

      {(data.recommendations || []).length > 0 && (
        <section>
          <h2 className="font-display text-slate-800 dark:text-white text-base font-700 mb-3">
            Top action items
            <span className="ml-2 text-xs font-body text-slate-400">{(data.recommendations || []).length} total</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(data.recommendations || []).slice(0, 12).map((r) => (
              <RecommendationCard key={r.id} rec={r} />
            ))}
          </div>
        </section>
      )}

      <p className="text-xs font-body text-slate-400 italic">
        Engine: rules over species-specific life-stage, weight band, age, and medical history.
        Caloric estimates use a Kleiber-style metabolic rate (70 × weight^0.75 for dogs).
      </p>
    </div>
  );
}

export default WellnessTab;
