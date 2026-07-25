/**
 * ChurnPredictionTab.jsx
 * Predict which clients are likely to stop visiting.
 * Decision-tree-style classifier output rendered with risk distribution,
 * top drivers, and a per-client list.
 */
import {
  UserMinus, Users, AlertTriangle, TrendingDown, Activity,
} from 'lucide-react';
import KpiTile  from '../../components/healthcheck/KpiTile';
import ChartCard from '../../components/healthcheck/ChartCard';
import { BarChart, HBarChart, DonutChart } from '../../components/healthcheck/charts';
import RiskBadge from '../../components/predictive/RiskBadge';

function ChurnPredictionTab({ data, loading }) {
  if (!data) {
    return (
      <div className="p-8 text-center text-slate-400 font-body text-sm border border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
        {loading ? 'Scoring clients with the churn model…' : 'No churn predictions yet.'}
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

  const drivers = (data.drivers || []).slice(0, 10).map((d) => ({ key: d.key, count: d.count }));
  const atRisk  = data.atRiskClients || [];

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile icon={Users}        color="blue"
                 label="Clients scored" value={data.population}
                 sublabel="Total client population" />
        <KpiTile icon={UserMinus}    color="red"
                 label="At-risk clients" value={data.atRiskCount}
                 sublabel={`${data.atRiskShare}% of population`} />
        <KpiTile icon={Activity}     color="violet"
                 label="Avg churn score" value={`${data.averageScore}/100`}
                 sublabel="Higher = more likely to churn" />
        <KpiTile icon={AlertTriangle} color="amber"
                 label="Critical band" value={dist.critical || 0}
                 sublabel={`${dist.high || 0} high · ${dist.medium || 0} medium`} />
      </div>

      {/* Distribution + drivers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard
          title="Risk distribution"
          subtitle="How clients fall across the four risk bands"
          csvFilename="churn-risk-distribution"
          csvData={distChart}
        >
          <DonutChart data={distChart} />
        </ChartCard>

        <div className="lg:col-span-2">
          <ChartCard
            title="Top churn drivers"
            subtitle="Which decision-tree rules fire most often across at-risk clients"
            csvFilename="churn-drivers"
            csvData={drivers}
          >
            <HBarChart data={drivers} />
          </ChartCard>
        </div>
      </div>

      {/* At-risk client list */}
      <ChartCard
        title="Predicted at-risk clients"
        subtitle={`Showing top ${Math.min(atRisk.length, 30)} of ${atRisk.length}`}
        csvFilename="at-risk-clients"
        csvData={atRisk.map((c) => ({
          clientName:        c.clientName,
          riskScore:         c.risk_score,
          riskBand:          c.risk_band,
          daysSinceLastVisit:c.daysSinceLastVisit,
          missedCount:       c.missedCount,
          lifetimeSpendPHP:  c.lifetimeSpendPHP,
        }))}
        csvColumns={['clientName','riskScore','riskBand','daysSinceLastVisit','missedCount','lifetimeSpendPHP']}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="text-left text-xs font-600 text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-white/10">
                <th className="py-2 pr-3">Client</th>
                <th className="py-2 pr-3">Risk</th>
                <th className="py-2 pr-3">Score</th>
                <th className="py-2 pr-3">Inactive (d)</th>
                <th className="py-2 pr-3">Missed</th>
                <th className="py-2 pr-3">Lifetime (₱)</th>
                <th className="py-2 pr-3">Top reasons</th>
              </tr>
            </thead>
            <tbody>
              {atRisk.slice(0, 30).map((c) => (
                <tr key={c.clientId} className="border-b border-slate-50 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">{c.clientName || '—'}</td>
                  <td className="py-2 pr-3"><RiskBadge band={c.risk_band} /></td>
                  <td className="py-2 pr-3 font-600 text-slate-700 dark:text-slate-200">{c.risk_score}</td>
                  <td className="py-2 pr-3 text-slate-500">{c.daysSinceLastVisit ?? '—'}</td>
                  <td className="py-2 pr-3 text-slate-500">{c.missedCount}</td>
                  <td className="py-2 pr-3 text-slate-500">{(c.lifetimeSpendPHP || 0).toLocaleString()}</td>
                  <td className="py-2 pr-3 text-slate-500 text-xs">
                    {(c.reasons || []).filter((r) => r.weight > 0).slice(0, 2).map((r, i) => (
                      <span key={i} className="inline-block mr-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300">
                        {r.label}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
              {atRisk.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400 text-xs">
                    No clients in the high/critical bands — retention looks healthy.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {/* Modeling note */}
      <p className="text-xs font-body text-slate-400 italic">
        <TrendingDown className="w-3 h-3 inline-block mr-1" />
        Model: interpretable decision-tree rules over inactivity, missed/cancelled patterns,
        spending trend, and visit cadence. Each prediction lists the rules that fired.
      </p>
    </div>
  );
}

export default ChurnPredictionTab;
