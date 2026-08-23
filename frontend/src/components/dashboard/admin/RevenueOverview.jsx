/**
 * RevenueOverview.jsx
 * Today's revenue, monthly revenue, outstanding balances, refunds, plus a
 * 12-month revenue trend line (Recharts).
 */
import { useState, useEffect } from 'react';
import { Wallet, TrendingUp, AlertCircle, Undo2 } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Card, SectionHeader, Skeleton, ErrorState } from './primitives';
import { dashboardApi } from './mockData';

const peso = (v) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 0 }).format(v);

function OverviewTile({ Icon, label, value, tone }) {
  const toneMap = {
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
    amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
    red: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400',
  };
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${toneMap[tone]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="font-mono text-slate-800 dark:text-white text-base font-700 tabular-nums truncate">{value}</p>
        <p className="font-body text-slate-400 dark:text-slate-500 text-xs">{label}</p>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-lg p-2.5">
      <p className="font-body text-slate-500 dark:text-slate-400 text-xs mb-1">{label} 2026</p>
      <p className="font-mono text-slate-800 dark:text-white text-sm font-700">
        ₱{((payload[0].value || 0) * 1000).toLocaleString()}
      </p>
    </div>
  );
}

export default function RevenueOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setData(await dashboardApi.getRevenue());
    } catch (e) {
      setError(e.message || 'Failed to load revenue');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  return (
    <Card>
      <SectionHeader title="Revenue Overview" subtitle="Current financial snapshot" icon={Wallet} />

      <div className="p-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <OverviewTile Icon={Wallet} label="Today's Revenue" value={peso(data.today)} tone="emerald" />
              <OverviewTile Icon={TrendingUp} label="This Month" value={peso(data.monthly)} tone="blue" />
              <OverviewTile Icon={AlertCircle} label="Outstanding" value={peso(data.outstanding)} tone="amber" />
              <OverviewTile Icon={Undo2} label="Refunds (MTD)" value={peso(data.refunds)} tone="red" />
            </div>

            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false}
                    tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'DM Sans' }} dy={6} />
                  <YAxis axisLine={false} tickLine={false}
                    tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'DM Sans' }}
                    tickFormatter={(v) => `₱${v}k`} dx={-4} width={42} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} fill="url(#revGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="font-body text-slate-400 dark:text-slate-500 text-xs text-center mt-2">
              Monthly revenue · trailing 12 months (₱ thousands)
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
