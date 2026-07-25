/**
 * AppointmentForecastTab.jsx
 * Predicted appointment volume + density heatmap (day-of-week × hour).
 */
import {
  Calendar, Clock, TrendingUp, CalendarClock,
} from 'lucide-react';
import KpiTile  from '../../components/healthcheck/KpiTile';
import ChartCard from '../../components/healthcheck/ChartCard';
import { BarChart, LineChart } from '../../components/healthcheck/charts';

function Heatmap({ grid }) {
  if (!grid || !grid.length) {
    return <div className="text-slate-400 text-xs text-center py-8">No density data yet.</div>;
  }
  const max = grid.reduce((m, row) => Math.max(m, ...row.hours.map((h) => h.count)), 0) || 1;

  const cellColor = (n) => {
    if (!n) return 'bg-slate-50 dark:bg-slate-800/40';
    const t = n / max;
    if (t > 0.8) return 'bg-violet-600 text-white';
    if (t > 0.6) return 'bg-violet-500 text-white';
    if (t > 0.4) return 'bg-violet-400 text-white';
    if (t > 0.2) return 'bg-violet-300 dark:bg-violet-500/30';
    if (t > 0.1) return 'bg-violet-200 dark:bg-violet-500/20';
    return 'bg-violet-100 dark:bg-violet-500/10';
  };

  return (
    <div className="overflow-x-auto">
      <table className="border-separate" style={{ borderSpacing: '2px' }}>
        <thead>
          <tr>
            <th className="w-12"></th>
            {Array.from({ length: 24 }, (_, h) => (
              <th key={h} className="text-[10px] text-slate-400 font-600 px-1 py-1">
                {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((row) => (
            <tr key={row.dow}>
              <td className="text-[11px] text-slate-500 font-600 pr-2 text-right">{row.dow_label}</td>
              {row.hours.map((c) => (
                <td key={c.hour}
                    title={`${row.dow_label} ${String(c.hour).padStart(2, '0')}:00 — ${c.count} appts`}
                    className={`text-[10px] text-center w-6 h-6 rounded ${cellColor(c.count)}`}>
                  {c.count || ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AppointmentForecastTab({ data, loading }) {
  if (!data) {
    return (
      <div className="p-8 text-center text-slate-400 font-body text-sm border border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
        {loading ? 'Forecasting appointments…' : 'No forecast yet.'}
      </div>
    );
  }

  const k = data.kpis || {};
  const mf = data.monthlyForecast || {};
  const df = data.densityForecast || {};

  const monthlyChart = (mf.points || []).map((p) => ({ key: p.label, count: p.predicted }));
  const historicalChart = (mf.historical || []).map((h) => ({ key: h.label, count: h.count }));
  const busiestDays = df.busiestDays || [];
  const busiestHours = df.busiestHours || [];

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile icon={Calendar}    color="blue"
                 label="Baseline / month" value={k.baseline_monthly}
                 sublabel={`from ${k.history_months} months of history`} />
        <KpiTile icon={TrendingUp}  color="emerald"
                 label="Monthly trend" value={`${k.trend_slope > 0 ? '+' : ''}${k.trend_slope}`}
                 sublabel="appts per month, regression slope" />
        <KpiTile icon={CalendarClock} color="violet"
                 label="Peak forecast" value={k.peak_month?.predicted ?? '—'}
                 sublabel={k.peak_month?.label || ''} />
        <KpiTile icon={Clock}        color="amber"
                 label="Busiest slot" value={k.busiest_hour || '—'}
                 sublabel={`on ${k.busiest_day || '—'}`} />
      </div>

      {/* Forecast vs historical */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Forecasted monthly volume"
          subtitle={`Next ${data.horizon_months} months — linear trend + seasonal index`}
          csvFilename="appointments-forecast"
          csvData={monthlyChart}
        >
          <BarChart data={monthlyChart} />
        </ChartCard>
        <ChartCard
          title="Last 12 months — historical volume"
          subtitle="What the model learned from"
          csvFilename="appointments-historical"
          csvData={historicalChart}
        >
          <BarChart data={historicalChart} />
        </ChartCard>
      </div>

      {/* Density heatmap */}
      <ChartCard
        title="Busy hours & days (last 365 days)"
        subtitle="Darker cells = more appointments. Use this to staff peak slots."
      >
        <Heatmap grid={df.grid} />
      </ChartCard>

      {/* Busiest day/hour rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Busiest days of the week"
          subtitle="Total appointments per weekday"
          csvFilename="busiest-days"
          csvData={busiestDays}
        >
          <BarChart data={busiestDays} />
        </ChartCard>
        <ChartCard
          title="Busiest hours of the day"
          subtitle="Aggregated across the week"
          csvFilename="busiest-hours"
          csvData={busiestHours}
        >
          <BarChart data={busiestHours} />
        </ChartCard>
      </div>

      <p className="text-xs font-body text-slate-400 italic">
        Model: linear-regression trend × month-of-year seasonal multiplier.
        Density grid is the rolling 365-day histogram (DOW × hour).
      </p>
    </div>
  );
}

export default AppointmentForecastTab;
