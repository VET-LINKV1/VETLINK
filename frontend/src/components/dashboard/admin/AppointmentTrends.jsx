/**
 * AppointmentTrends.jsx
 * Stacked area chart (Recharts) showing completed, cancelled, rescheduled,
 * no-show over selectable periods. Includes tooltip, legend, responsive.
 */
import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Calendar, ChevronDown } from 'lucide-react';
import { Card, SectionHeader, Skeleton, ErrorState } from './primitives';
import { dashboardApi } from './mockData';

const PERIODS = ['7 Days', '30 Days', '3 Months', '6 Months', '1 Year'];

const COLORS = {
  completed: '#10b981',
  cancelled: '#ef4444',
  rescheduled: '#f59e0b',
  noShow: '#94a3b8',
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-lg p-3">
      <p className="font-display text-slate-800 dark:text-white text-xs font-600 mb-2">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full" style={{ background: COLORS[entry.dataKey] || '#666' }} />
          <span className="font-body text-slate-600 dark:text-slate-300">{entry.name}:</span>
          <span className="font-mono text-slate-800 dark:text-white font-600">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function AppointmentTrends() {
  const [period, setPeriod] = useState('7 Days');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setData(await dashboardApi.getTrends(period));
    } catch (e) {
      setError(e.message || 'Failed to load trends');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [period]);

  const totals = data.reduce(
    (acc, d) => {
      acc.completed += d.completed || 0;
      acc.cancelled += d.cancelled || 0;
      acc.rescheduled += d.rescheduled || 0;
      acc.noShow += d.noShow || 0;
      return acc;
    },
    { completed: 0, cancelled: 0, rescheduled: 0, noShow: 0 }
  );

  return (
    <Card>
      <SectionHeader
        title="Appointment Trends"
        subtitle={`${totals.completed + totals.cancelled + totals.rescheduled + totals.noShow} total in period`}
        icon={Calendar}
        action={
          <div className="relative">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="appearance-none pr-8 pl-2.5 py-1.5 text-xs font-body bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
          </div>
        }
      />

      <div className="p-4">
        {loading ? (
          <div className="h-[260px] flex items-center justify-center">
            <Skeleton className="w-full h-full rounded-xl" />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  {Object.entries(COLORS).map(([key, color]) => (
                    <linearGradient key={key} id={`color-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'DM Sans' }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'DM Sans' }}
                  tickCount={4}
                  dx={-8}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  layout="horizontal"
                  align="center"
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={6}
                  wrapperStyle={{ paddingTop: 8, fontSize: 10, fontFamily: 'DM Sans', color: '#64748b' }}
                  formatter={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
                />
                {Object.entries(COLORS).map(([key, color]) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={color}
                    fill={`url(#color-${key})`}
                    strokeWidth={2}
                    fillOpacity={1}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Summary row */}
      <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-white/10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          {[
            { key: 'completed', label: 'Completed', color: COLORS.completed },
            { key: 'cancelled', label: 'Cancelled', color: COLORS.cancelled },
            { key: 'rescheduled', label: 'Rescheduled', color: COLORS.rescheduled },
            { key: 'noShow', label: 'No-Show', color: COLORS.noShow },
          ].map(({ key, label, color }) => (
            <div key={key} className="py-2">
              <p className="font-display text-2xl font-700 tabular-nums" style={{ color }}>
                {totals[key]}
              </p>
              <p className="font-body text-slate-500 dark:text-slate-400 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}