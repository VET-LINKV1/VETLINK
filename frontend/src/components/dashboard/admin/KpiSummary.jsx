/**
 * KpiSummary.jsx
 * Eight metric cards with value, label, sub-label, and delta trend.
 * Static class maps keep Tailwind's purge happy.
 */
import { useState, useEffect } from 'react';
import {
  Calendar, Users, PawPrint, Stethoscope, DollarSign,
  FlaskConical, Pill, AlertTriangle,
} from 'lucide-react';
import { Card, TrendPill, SkeletonRows, ErrorState } from './primitives';
import { dashboardApi } from './mockData';

const ICONS = {
  todaysAppointments: Calendar,
  totalActivePets: PawPrint,
  registeredOwners: Users,
  activeVets: Stethoscope,
  todaysRevenue: DollarSign,
  pendingLabResults: FlaskConical,
  refillRequests: Pill,
  pendingActions: AlertTriangle,
};

const LABELS = {
  todaysAppointments: "Today's Appointments",
  totalActivePets: 'Total Active Pets',
  registeredOwners: 'Registered Pet Owners',
  activeVets: 'Active Veterinarians',
  todaysRevenue: "Today's Revenue",
  pendingLabResults: 'Pending Lab Results',
  refillRequests: 'Refill Requests',
  pendingActions: 'Pending Actions',
};

// Full static class strings (Tailwind cannot see interpolated names).
const STYLE = {
  blue:    { box: 'bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20',  icon: 'text-blue-600 dark:text-blue-400' },
  violet:  { box: 'bg-violet-50 dark:bg-violet-500/10 border-violet-100 dark:border-violet-500/20', icon: 'text-violet-600 dark:text-violet-400' },
  teal:    { box: 'bg-teal-50 dark:bg-teal-500/10 border-teal-100 dark:border-teal-500/20',  icon: 'text-teal-600 dark:text-teal-400' },
  indigo:  { box: 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20', icon: 'text-indigo-600 dark:text-indigo-400' },
  emerald: { box: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20', icon: 'text-emerald-600 dark:text-emerald-400' },
  amber:   { box: 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20', icon: 'text-amber-600 dark:text-amber-400' },
  sky:     { box: 'bg-sky-50 dark:bg-sky-500/10 border-sky-100 dark:border-sky-500/20',       icon: 'text-sky-600 dark:text-sky-400' },
  red:     { box: 'bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20',       icon: 'text-red-600 dark:text-red-400' },
};

const COLORS = {
  todaysAppointments: 'blue',
  totalActivePets: 'violet',
  registeredOwners: 'teal',
  activeVets: 'indigo',
  todaysRevenue: 'emerald',
  pendingLabResults: 'amber',
  refillRequests: 'sky',
  pendingActions: 'red',
};

function formatCurrency(value) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 0 }).format(value);
}

export default function KpiSummary() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setData(await dashboardApi.getKpis());
    } catch (e) {
      setError(e.message || 'Failed to load KPIs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <Card className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <SkeletonRows rows={1} />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-5">
        <div className="text-center py-8"><ErrorState message={error} onRetry={load} /></div>
      </Card>
    );
  }

  const keys = Object.keys(LABELS);
  return (
    <Card className="p-4 sm:p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {keys.map((key) => {
          const Icon = ICONS[key];
          const color = STYLE[COLORS[key]];
          const value = data[key];
          const delta = data.deltas[key];
          const isCurrency = key === 'todaysRevenue';
          const displayValue = isCurrency ? formatCurrency(value) : value.toLocaleString();
          const sublabel =
            key === 'totalActivePets' ? `${data.registeredOwners.toLocaleString()} owners`
            : key === 'activeVets' ? `${data.todaysAppointments} appts today`
            : undefined;

          return (
            <div key={key}
              className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-white/10 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${color.box}`}>
                  <Icon className={`w-5.5 h-5.5 ${color.icon}`} />
                </div>
                <TrendPill value={delta} goodWhen={(key === 'pendingLabResults' || key === 'pendingActions') ? 'down' : 'up'} />
              </div>
              <p className="font-display text-slate-800 dark:text-white text-2xl sm:text-3xl font-700 tabular-nums">{displayValue}</p>
              <p className="font-body text-slate-500 dark:text-slate-400 text-sm mt-0.5">{LABELS[key]}</p>
              {sublabel && <p className="font-body text-slate-400 dark:text-slate-500 text-xs mt-1">{sublabel}</p>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
