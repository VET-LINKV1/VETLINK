/**
 * TreatmentRiskTab.jsx
 * Predict pets needing follow-up visits + surface recurring medical conditions.
 */
import {
  PawPrint, Stethoscope, Activity, AlertTriangle,
} from 'lucide-react';
import KpiTile  from '../../components/healthcheck/KpiTile';
import ChartCard from '../../components/healthcheck/ChartCard';
import { HBarChart, DonutChart } from '../../components/healthcheck/charts';
import RiskBadge from '../../components/predictive/RiskBadge';

function TreatmentRiskTab({ data, loading }) {
  if (!data) {
    return (
      <div className="p-8 text-center text-slate-400 font-body text-sm border border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
        {loading ? 'Scoring pets for treatment risk…' : 'No risk predictions yet.'}
      </div>
    );
  }

  const dist = data.distribution || {};
  const distChart = [
    { key: 'Low',      count: dist.low      || 0 },
    { key: 'Medium',   count: dist.medium   || 0 },
    { key: 'High',     count: dist.high     || 0 },
    { key: 'Critical', count: dist.critical || 0 },
  ];

  const recurring = data.recurringDiagnoses || [];
  const recurringChart = recurring.slice(0, 10).map((d) => ({ key: d.key, count: d.count }));

  const followup  = data.followupList || [];
  const species   = data.speciesBreakdown || [];

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile icon={PawPrint}    color="blue"
                 label="Pets evaluated" value={data.population}
                 sublabel="All pets in the system" />
        <KpiTile icon={Stethoscope} color="violet"
                 label="Need follow-up" value={data.followupNeededCount}
                 sublabel={`${data.followupShare}% of pets`} />
        <KpiTile icon={Activity}    color="amber"
                 label="Recurring conditions" value={recurring.length}
                 sublabel="distinct diagnoses recurring ≤90d" />
        <KpiTile icon={AlertTriangle} color="red"
                 label="Critical risk" value={dist.critical || 0}
                 sublabel={`${dist.high || 0} high · ${dist.medium || 0} medium`} />
      </div>

      {/* Distribution + recurring conditions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard
          title="Treatment-risk distribution"
          subtitle="Pets bucketed by predicted follow-up need"
          csvFilename="treatment-risk-distribution"
          csvData={distChart}
        >
          <DonutChart data={distChart} />
        </ChartCard>

        <div className="lg:col-span-2">
          <ChartCard
            title="Top recurring medical conditions"
            subtitle="Diagnoses that re-appear within 90 days for the same pet"
            csvFilename="recurring-conditions"
            csvData={recurring}
            csvColumns={['key','count','unique_pets']}
          >
            <HBarChart data={recurringChart} />
          </ChartCard>
        </div>
      </div>

      {/* Species breakdown */}
      <ChartCard
        title="Risk by species"
        subtitle="Where the at-risk population concentrates"
        csvFilename="risk-by-species"
        csvData={species}
        csvColumns={['key','count','atRisk']}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="text-left text-xs font-600 text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-white/10">
                <th className="py-2 pr-3">Species</th>
                <th className="py-2 pr-3">Total pets</th>
                <th className="py-2 pr-3">At risk</th>
                <th className="py-2 pr-3">Share</th>
              </tr>
            </thead>
            <tbody>
              {species.slice(0, 10).map((s) => (
                <tr key={s.key} className="border-b border-slate-50 dark:border-white/5">
                  <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">{s.key}</td>
                  <td className="py-2 pr-3 text-slate-500">{s.count}</td>
                  <td className="py-2 pr-3 font-600 text-slate-700 dark:text-slate-200">{s.atRisk}</td>
                  <td className="py-2 pr-3 text-slate-500">
                    {s.count ? `${((s.atRisk / s.count) * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
              {species.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-slate-400 text-xs">No species data.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {/* Follow-up needed list */}
      <ChartCard
        title="Pets predicted to need follow-up"
        subtitle={`Showing top ${Math.min(followup.length, 30)} of ${followup.length}`}
        csvFilename="followup-pets"
        csvData={followup.map((p) => ({
          petName: p.petName, species: p.species, breed: p.breed, age: p.age,
          ownerName: p.ownerName, riskBand: p.risk_band, riskScore: p.risk_score,
          visitCount: p.visitCount, recurringEvents: p.recurringEvents,
          lastVisitDate: p.lastVisitDate, nextFollowupDate: p.nextFollowupDate,
        }))}
        csvColumns={['petName','species','breed','age','ownerName','riskBand','riskScore','visitCount','recurringEvents','lastVisitDate','nextFollowupDate']}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="text-left text-xs font-600 text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-white/10">
                <th className="py-2 pr-3">Pet</th>
                <th className="py-2 pr-3">Owner</th>
                <th className="py-2 pr-3">Risk</th>
                <th className="py-2 pr-3">Score</th>
                <th className="py-2 pr-3">Visits</th>
                <th className="py-2 pr-3">Recurring</th>
                <th className="py-2 pr-3">Last visit</th>
                <th className="py-2 pr-3">Top reason</th>
              </tr>
            </thead>
            <tbody>
              {followup.slice(0, 30).map((p) => (
                <tr key={p.petId} className="border-b border-slate-50 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">
                    {p.petName}
                    {p.species && <span className="ml-2 text-[10px] text-slate-400 uppercase tracking-wider">{p.species}</span>}
                  </td>
                  <td className="py-2 pr-3 text-slate-500">{p.ownerName || '—'}</td>
                  <td className="py-2 pr-3"><RiskBadge band={p.risk_band} /></td>
                  <td className="py-2 pr-3 font-600 text-slate-700 dark:text-slate-200">{p.risk_score}</td>
                  <td className="py-2 pr-3 text-slate-500">{p.visitCount}</td>
                  <td className="py-2 pr-3 text-slate-500">{p.recurringEvents}</td>
                  <td className="py-2 pr-3 text-slate-500 text-xs">
                    {p.lastVisitDate ? new Date(p.lastVisitDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-2 pr-3 text-slate-500 text-xs">
                    {(p.reasons || []).filter((r) => r.weight > 0)[0]?.label || '—'}
                  </td>
                </tr>
              ))}
              {followup.length === 0 && (
                <tr><td colSpan={8} className="py-6 text-center text-slate-400 text-xs">
                  No pets currently flagged for follow-up.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </ChartCard>

      <p className="text-xs font-body text-slate-400 italic">
        Model: rule-based classifier over recurring-diagnosis count, diagnosis diversity,
        follow-up scheduling, pet age, and overdue follow-ups.
      </p>
    </div>
  );
}

export default TreatmentRiskTab;
