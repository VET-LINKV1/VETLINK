/**
 * TreatmentTab.jsx
 * Treatment effectiveness — compares treatments for the same diagnosis.
 */
import { Stethoscope, Activity, RotateCcw, ClipboardCheck, Award } from 'lucide-react';
import KpiTile  from '../../components/healthcheck/KpiTile';
import ChartCard from '../../components/healthcheck/ChartCard';
import { HBarChart, BarChart } from '../../components/healthcheck/charts';

function TreatmentTab({ data, loading }) {
  if (!data) {
    return (
      <div className="p-8 text-center text-slate-400 font-body text-sm border border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
        {loading ? 'Loading treatment effectiveness…' : 'No treatment records in this window.'}
      </div>
    );
  }
  const k = data.kpis || {};
  const c = data.charts || {};
  const comparisons = data.comparisons || [];
  const winners = data.winners || [];

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile icon={Activity}        color="blue"
                 label="Total cases" value={k.totalCases}
                 sublabel={`${k.cohorts} (diagnosis, treatment) cohorts`} />
        <KpiTile icon={Stethoscope}     color="teal"
                 label="Distinct diagnoses" value={k.diagnoses} />
        <KpiTile icon={ClipboardCheck}  color="emerald"
                 label="Follow-up rate" value={`${k.avgFollowUpRatePct}%`}
                 sublabel="averaged across cohorts" />
        <KpiTile icon={RotateCcw}       color="red"
                 label="Recurrence rate" value={`${k.avgRecurrenceRatePct}%`}
                 sublabel={`${k.highRecurrenceCohorts} cohorts ≥ 25%`} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Recurrence rate by diagnosis (avg across treatments)"
          subtitle="Lower is better — recurrence within 90 days for same pet"
          csvFilename="recurrence-by-diagnosis"
          csvData={c.recurrenceByDiagnosis}
        >
          <HBarChart data={c.recurrenceByDiagnosis} />
        </ChartCard>
        <ChartCard
          title="Follow-up scheduling rate by diagnosis"
          subtitle="Higher = vets are scheduling follow-ups, which correlates with recovery"
          csvFilename="followup-by-diagnosis"
          csvData={c.followupRateByDiagnosis}
        >
          <HBarChart data={c.followupRateByDiagnosis} />
        </ChartCard>
      </div>

      <ChartCard
        title="Top 10 most-effective protocols"
        subtitle="Score = (1 − recurrence%) × log(cohort) — combines outcome quality and statistical confidence"
        csvFilename="top-protocols"
        csvData={c.topProtocols}
      >
        <HBarChart data={c.topProtocols} />
      </ChartCard>

      {/* Winners list */}
      <ChartCard
        title="Recommended protocol per diagnosis"
        subtitle="Highest-effectiveness treatment seen in the data — confirm clinically before standardising"
        csvFilename="recommended-protocols"
        csvData={winners}
        csvColumns={['diagnosis','bestTreatment','cohortSize','recurrenceRatePct','avgRecoveryDays']}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/10 text-left text-slate-500">
                <th className="py-2 font-body font-600">Diagnosis</th>
                <th className="py-2 font-body font-600">Best protocol</th>
                <th className="py-2 font-body font-600 text-right">Cohort</th>
                <th className="py-2 font-body font-600 text-right">Recurrence</th>
                <th className="py-2 font-body font-600 text-right">Avg recovery (d)</th>
              </tr>
            </thead>
            <tbody>
              {winners.map((w, i) => (
                <tr key={i} className="border-b border-slate-50 dark:border-white/5">
                  <td className="py-2 font-body text-slate-700 dark:text-slate-200 capitalize">
                    <span className="inline-flex items-center gap-1.5">
                      <Award className="w-3 h-3 text-amber-500" />
                      {w.diagnosis}
                    </span>
                  </td>
                  <td className="py-2 font-body text-slate-600 dark:text-slate-300">{w.bestTreatment || '—'}</td>
                  <td className="py-2 font-mono text-right text-slate-500">{w.cohortSize}</td>
                  <td className="py-2 font-mono text-right text-slate-500">{w.recurrenceRatePct}%</td>
                  <td className="py-2 font-mono text-right text-slate-500">{w.avgRecoveryDays ?? '—'}</td>
                </tr>
              ))}
              {winners.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-slate-400 font-body">Not enough data to recommend protocols yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {/* Per-diagnosis comparison cards */}
      <div>
        <h3 className="font-display text-slate-700 dark:text-slate-200 text-sm font-700 uppercase tracking-wider mb-3">
          Protocol comparison — by diagnosis
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {comparisons.map((cmp, i) => (
            <ChartCard
              key={cmp.diagnosis + i}
              title={cmp.diagnosis}
              subtitle={`${cmp.treatments.length} treatment${cmp.treatments.length === 1 ? '' : 's'} compared`}
              csvFilename={`protocol-${(cmp.diagnosis || 'diag').replace(/\W+/g, '_').toLowerCase()}`}
              csvData={cmp.treatments}
              csvColumns={['treatmentLabel','cohortSize','uniquePets','followUpRatePct','recurrenceRatePct','avgRecoveryDays','effectivenessScore']}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-white/10 text-left text-slate-500">
                      <th className="py-1.5 font-body font-600">Treatment</th>
                      <th className="py-1.5 font-body font-600 text-right">n</th>
                      <th className="py-1.5 font-body font-600 text-right">Follow-up</th>
                      <th className="py-1.5 font-body font-600 text-right">Recurrence</th>
                      <th className="py-1.5 font-body font-600 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cmp.treatments.map((t, j) => (
                      <tr key={j} className={`border-b border-slate-50 dark:border-white/5 ${j === 0 ? 'bg-emerald-50/40 dark:bg-emerald-500/5' : ''}`}>
                        <td className="py-1.5 font-body text-slate-700 dark:text-slate-200">
                          {j === 0 && <Award className="inline w-3 h-3 text-emerald-500 mr-1" />}
                          {t.treatmentLabel}
                        </td>
                        <td className="py-1.5 font-mono text-right text-slate-500">{t.cohortSize}</td>
                        <td className="py-1.5 font-mono text-right text-slate-500">{t.followUpRatePct}%</td>
                        <td className="py-1.5 font-mono text-right text-slate-500">{t.recurrenceRatePct}%</td>
                        <td className="py-1.5 font-mono text-right text-slate-700 dark:text-slate-200 font-600">{t.effectivenessScore}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          ))}
          {comparisons.length === 0 && (
            <div className="lg:col-span-2 p-8 text-center text-slate-400 font-body text-sm border border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
              No cohorts large enough to compare yet. Try a longer window or lower the cohort threshold.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TreatmentTab;
