/**
 * ChurnTab.jsx
 * Churn analysis with root-cause attribution.
 */
import {
  Users, UserMinus, UserPlus, AlertTriangle, Clock, TrendingUp, BadgeDollarSign, XCircle,
} from 'lucide-react';
import KpiTile  from '../../components/healthcheck/KpiTile';
import ChartCard from '../../components/healthcheck/ChartCard';
import { BarChart, HBarChart, DonutChart } from '../../components/healthcheck/charts';

function fmtPHP(n) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(n || 0);
}

function ChurnTab({ data, loading }) {
  if (!data) {
    return (
      <div className="p-8 text-center text-slate-400 font-body text-sm border border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
        {loading ? 'Loading churn analysis…' : 'No churn data yet for this window.'}
      </div>
    );
  }
  const k = data.kpis || {};
  const c = data.charts || {};
  const churned = data.churnedClientsList || [];

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile icon={UserMinus} color="red"
                 label="Churned clients" value={k.churnedClients}
                 sublabel={`${k.churnRatePercent}% churn rate`} />
        <KpiTile icon={Users}     color="emerald"
                 label="Retained" value={k.retainedClients}
                 sublabel={`of ${k.priorActiveClients} prior-active`} />
        <KpiTile icon={UserPlus}  color="sky"
                 label="New in window" value={k.newClientsInWindow}
                 sublabel={`${k.currentActiveClients} currently active`} />
        <KpiTile icon={Clock}     color="amber"
                 label="Avg wait (mins)" value={k.avgWaitMins}
                 sublabel={`${k.longWaitVisits} long-wait visits`} />

        <KpiTile icon={BadgeDollarSign} color="violet"
                 label="Services with price ↑" value={k.servicesPriceIncreased}
                 sublabel="> 10% vs prior window" />
        <KpiTile icon={XCircle} color="slate"
                 label="Churned cancel rate" value={`${k.churnedCancelRatePct}%`}
                 sublabel={`vs ${k.retainedCancelRatePct}% retained`} />
        <KpiTile icon={AlertTriangle} color="amber"
                 label="Top vet attrition"
                 value={c.retentionByVet?.[0]?.vet || '—'}
                 sublabel={c.retentionByVet?.[0]
                   ? `${c.retentionByVet[0].retention_pct}% retention`
                   : 'no data'} />
        <KpiTile icon={TrendingUp} color="teal"
                 label="Current active" value={k.currentActiveClients}
                 sublabel="distinct clients seen" />
      </div>

      {/* Root cause + churn-by-vet */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard
          title="Root cause attribution"
          subtitle="Estimated weight of each cause among churned clients"
          csvFilename="churn-root-cause"
          csvData={c.rootCauseBreakdown}
        >
          <DonutChart data={c.rootCauseBreakdown} />
        </ChartCard>

        <div className="lg:col-span-2">
          <ChartCard
            title="Retention by veterinarian"
            subtitle="Worst-retaining vets first (≥2 prior-window clients required)"
            csvFilename="retention-by-vet"
            csvData={c.retentionByVet}
            csvColumns={['key','prev_clients','retained_clients','retention_pct']}
          >
            <HBarChart
              data={(c.retentionByVet || []).map((r) => ({ key: r.key, count: r.retention_pct }))}
            />
          </ChartCard>
        </div>
      </div>

      {/* Wait + cancellations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Wait-time distribution (prior window)"
          subtitle="Scheduled → completion elapsed minutes"
          csvFilename="wait-time-distribution"
          csvData={c.waitTimeDistribution}
          csvColumns={['key','count','churned']}
        >
          <BarChart data={c.waitTimeDistribution} />
        </ChartCard>

        <ChartCard
          title="Cancellation reasons (churned clients)"
          subtitle="Most common reasons among the people who didn't come back"
          csvFilename="cancel-reasons"
          csvData={c.cancelReasons}
        >
          <HBarChart data={c.cancelReasons} />
        </ChartCard>
      </div>

      {/* Price trend table */}
      <ChartCard
        title="Price trend by service"
        subtitle="Current vs prior window — services with significant price increases drive churn risk"
        csvFilename="price-trend"
        csvData={c.priceTrend}
        csvColumns={['service','current_avg_php','prior_avg_php','current_count','prior_count','price_change_pct']}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/10 text-left text-slate-500">
                <th className="py-2 font-body font-600">Service</th>
                <th className="py-2 font-body font-600 text-right">Current avg</th>
                <th className="py-2 font-body font-600 text-right">Prior avg</th>
                <th className="py-2 font-body font-600 text-right">Δ %</th>
                <th className="py-2 font-body font-600 text-right">Current n</th>
                <th className="py-2 font-body font-600 text-right">Prior n</th>
              </tr>
            </thead>
            <tbody>
              {(c.priceTrend || []).map((p, i) => {
                const delta = p.price_change_pct;
                const up = delta != null && delta > 10;
                const down = delta != null && delta < -10;
                return (
                  <tr key={i} className="border-b border-slate-50 dark:border-white/5">
                    <td className="py-2 font-body text-slate-700 dark:text-slate-200 capitalize">{p.service}</td>
                    <td className="py-2 font-mono text-right text-slate-600 dark:text-slate-300">{fmtPHP(p.current_avg_php)}</td>
                    <td className="py-2 font-mono text-right text-slate-500">{fmtPHP(p.prior_avg_php)}</td>
                    <td className={`py-2 font-mono text-right ${up ? 'text-red-500' : down ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`}
                    </td>
                    <td className="py-2 font-mono text-right text-slate-400">{p.current_count}</td>
                    <td className="py-2 font-mono text-right text-slate-400">{p.prior_count}</td>
                  </tr>
                );
              })}
              {(!c.priceTrend || c.priceTrend.length === 0) && (
                <tr><td colSpan={6} className="py-6 text-center text-slate-400 font-body">No priced services in this window.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {/* Churned client list */}
      <ChartCard
        title={`Churned clients (${churned.length})`}
        subtitle="Each row shows the client's LAST visit before they stopped coming"
        csvFilename="churned-clients"
        csvData={churned}
        csvColumns={['clientName','lastVetName','lastVisit','lastStatus','elapsedMins','amountPHP','cancelReason']}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/10 text-left text-slate-500">
                <th className="py-2 font-body font-600">Client</th>
                <th className="py-2 font-body font-600">Last vet</th>
                <th className="py-2 font-body font-600">Last visit</th>
                <th className="py-2 font-body font-600">Status</th>
                <th className="py-2 font-body font-600 text-right">Elapsed</th>
                <th className="py-2 font-body font-600 text-right">Spend</th>
                <th className="py-2 font-body font-600">Cancel reason</th>
              </tr>
            </thead>
            <tbody>
              {churned.slice(0, 30).map((row, i) => (
                <tr key={i} className="border-b border-slate-50 dark:border-white/5">
                  <td className="py-2 font-body text-slate-700 dark:text-slate-200">{row.clientName || '—'}</td>
                  <td className="py-2 font-body text-slate-600 dark:text-slate-300">{row.lastVetName || '—'}</td>
                  <td className="py-2 font-mono text-slate-500">{row.lastVisit ? new Date(row.lastVisit).toISOString().slice(0,10) : '—'}</td>
                  <td className="py-2 font-body text-slate-500 capitalize">{row.lastStatus || '—'}</td>
                  <td className="py-2 font-mono text-right text-slate-500">{row.elapsedMins != null ? `${row.elapsedMins} m` : '—'}</td>
                  <td className="py-2 font-mono text-right text-slate-500">{fmtPHP(row.amountPHP)}</td>
                  <td className="py-2 font-body text-slate-400 truncate max-w-[12rem]" title={row.cancelReason}>{row.cancelReason || '—'}</td>
                </tr>
              ))}
              {churned.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-slate-400 font-body">No churned clients — that's good news.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}

export default ChurnTab;
