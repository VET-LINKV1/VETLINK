/**
 * InventoryForecastTab.jsx
 * Seasonal inventory forecasting — predicts medicine/supply demand
 * for the upcoming N months and flags low-stock risks.
 */
import {
  Boxes, AlertCircle, PackageX, TrendingUp, Calendar,
} from 'lucide-react';
import KpiTile  from '../../components/healthcheck/KpiTile';
import ChartCard from '../../components/healthcheck/ChartCard';
import { BarChart, HBarChart, LineChart } from '../../components/healthcheck/charts';
import RiskBadge from '../../components/predictive/RiskBadge';

function InventoryForecastTab({ data, loading }) {
  if (!data) {
    return (
      <div className="p-8 text-center text-slate-400 font-body text-sm border border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
        {loading ? 'Forecasting demand…' : 'No inventory forecast yet.'}
      </div>
    );
  }

  const k = data.kpis || {};
  const monthly = (data.monthlyTotals || []).map((m) => ({ key: m.key, count: m.count }));
  const meds = data.medicationForecasts || [];
  const services = data.serviceForecasts || [];

  const peakService = services.reduce((b, s) => ((s?.peak?.predicted || 0) > (b?.peak?.predicted || 0) ? s : b), null);

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile icon={Boxes}     color="blue"
                 label="Medications tracked" value={k.tracked_medications}
                 sublabel="With usage history" />
        <KpiTile icon={PackageX}  color="red"
                 label="Out of stock" value={k.out_of_stock}
                 sublabel={`${k.below_reorder} below reorder`} />
        <KpiTile icon={AlertCircle} color="amber"
                 label="Stockout-soon" value={k.stockout_soon}
                 sublabel={`${k.low_cover} with <2 mo cover`} />
        <KpiTile icon={TrendingUp} color="violet"
                 label="Peak service" value={peakService?.service || '—'}
                 sublabel={peakService?.peak?.label
                   ? `${peakService.peak.predicted} appts in ${peakService.peak.label}`
                   : 'no data'} />
      </div>

      {/* Monthly demand totals */}
      <ChartCard
        title="Forecasted monthly medication demand"
        subtitle={`Total predicted units across all medications, next ${data.horizon_months} months`}
        csvFilename="inventory-monthly-totals"
        csvData={monthly}
      >
        <BarChart data={monthly} />
      </ChartCard>

      {/* Service demand forecast */}
      <ChartCard
        title="Service demand forecast"
        subtitle="Predicted appointment counts per service for upcoming months"
        csvFilename="service-demand-forecast"
        csvData={services.flatMap((s) => s.points.map((p) => ({
          service:  s.service,
          month:    p.label,
          predicted: p.predicted,
        })))}
        csvColumns={['service','month','predicted']}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="text-left text-xs font-600 text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-white/10">
                <th className="py-2 pr-3">Service</th>
                <th className="py-2 pr-3">Baseline / mo</th>
                <th className="py-2 pr-3">Trend</th>
                <th className="py-2 pr-3">Peak</th>
                <th className="py-2 pr-3">Total in horizon</th>
              </tr>
            </thead>
            <tbody>
              {services.slice(0, 12).map((s) => (
                <tr key={s.service} className="border-b border-slate-50 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">{s.service}</td>
                  <td className="py-2 pr-3 text-slate-500">{s.baseline}</td>
                  <td className="py-2 pr-3 text-slate-500">
                    <span className={s.trend_slope > 0 ? 'text-emerald-600' : s.trend_slope < 0 ? 'text-red-500' : 'text-slate-400'}>
                      {s.trend_slope > 0 ? '+' : ''}{s.trend_slope}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-slate-500 text-xs">
                    {s.peak ? `${s.peak.label} (${s.peak.predicted})` : '—'}
                  </td>
                  <td className="py-2 pr-3 font-600 text-slate-700 dark:text-slate-200">{s.total_horizon}</td>
                </tr>
              ))}
              {services.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-slate-400 text-xs">
                  No service history available.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {/* Medication low-stock risk table */}
      <ChartCard
        title="Medication forecast & low-stock risk"
        subtitle="Forecasted demand vs current stock, ordered by risk"
        csvFilename="medication-stock-risk"
        csvData={meds.map((m) => ({
          name: m.name, category: m.category, stock_on_hand: m.stock_on_hand,
          reorder_level: m.reorder_level, avg_monthly_usage: m.avg_monthly_usage,
          horizon_demand: m.horizon_demand, months_of_cover: m.months_of_cover, risk: m.risk,
        }))}
        csvColumns={['name','category','stock_on_hand','reorder_level','avg_monthly_usage','horizon_demand','months_of_cover','risk']}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="text-left text-xs font-600 text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-white/10">
                <th className="py-2 pr-3">Medication</th>
                <th className="py-2 pr-3">Risk</th>
                <th className="py-2 pr-3">On hand</th>
                <th className="py-2 pr-3">Reorder ≤</th>
                <th className="py-2 pr-3">Monthly avg</th>
                <th className="py-2 pr-3">Horizon demand</th>
                <th className="py-2 pr-3">Months cover</th>
              </tr>
            </thead>
            <tbody>
              {meds.slice(0, 25).map((m) => (
                <tr key={m.medication_id} className="border-b border-slate-50 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">
                    {m.name}
                    {m.category && (
                      <span className="ml-2 text-[10px] text-slate-400 uppercase tracking-wider">{m.category}</span>
                    )}
                  </td>
                  <td className="py-2 pr-3"><RiskBadge band={m.risk} /></td>
                  <td className="py-2 pr-3 text-slate-500">{m.stock_on_hand}</td>
                  <td className="py-2 pr-3 text-slate-400">{m.reorder_level}</td>
                  <td className="py-2 pr-3 text-slate-500">{m.avg_monthly_usage}</td>
                  <td className="py-2 pr-3 font-600 text-slate-700 dark:text-slate-200">{m.horizon_demand}</td>
                  <td className="py-2 pr-3 text-slate-500">{m.months_of_cover ?? '—'}</td>
                </tr>
              ))}
              {meds.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-slate-400 text-xs">
                  No medication transactions on record yet.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </ChartCard>

      <p className="text-xs font-body text-slate-400 italic">
        <Calendar className="w-3 h-3 inline-block mr-1" />
        Model: seasonal-naive (mean of month-of-year over a 24-month lookback) combined with a
        per-medication linear trend. Months-of-cover compares stock on hand to average forecasted demand.
      </p>
    </div>
  );
}

export default InventoryForecastTab;
