/**
 * RecentActivity.jsx
 * Unified feed: new owners, new pets, completed appointments, payments, labs.
 */
import { useState, useEffect } from 'react';
import { Activity, UserPlus, PawPrint, CalendarCheck, CreditCard, FlaskConical, Pill, ChevronRight } from 'lucide-react';
import { Card, SectionHeader, SkeletonRows, ErrorState } from './primitives';
import { dashboardApi } from './mockData';

const TYPE = {
  owner: { Icon: UserPlus, color: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  pet: { Icon: PawPrint, color: 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  appointment: { Icon: CalendarCheck, color: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  payment: { Icon: CreditCard, color: 'bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400' },
  lab: { Icon: FlaskConical, color: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  refill: { Icon: Pill, color: 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400' },
};

export default function RecentActivity() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setItems(await dashboardApi.getActivity());
    } catch (e) {
      setError(e.message || 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  return (
    <Card>
      <SectionHeader title="Recent Activity" subtitle="Live clinic events" icon={Activity} />
      <div className="p-3 sm:p-4">
        {loading ? (
          <SkeletonRows rows={7} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : items.length === 0 ? (
          <div className="text-center py-10">
            <Activity className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="font-body text-slate-500 dark:text-slate-400 text-sm">No recent activity yet.</p>
          </div>
        ) : (
          <ol className="relative space-y-3">
            <span className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-100 dark:bg-white/10" aria-hidden />
            {items.map((it) => {
              const cfg = TYPE[it.type] || TYPE.owner;
              const { Icon } = cfg;
              return (
                <li key={it.id} className="relative flex items-start gap-3">
                  <div className={`relative z-10 w-8 h-8 rounded-full border border-slate-100 dark:border-white/10 flex items-center justify-center shrink-0 ${cfg.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1 pb-1">
                    <p className="font-body text-slate-700 dark:text-slate-200 text-sm">
                      <span className="font-600">{it.text}</span>
                      {it.who && <span className="font-600 text-slate-800 dark:text-white"> — {it.who}</span>}
                    </p>
                    {it.meta && <p className="font-body text-slate-400 dark:text-slate-500 text-xs truncate">{it.meta}</p>}
                  </div>
                  <span className="font-body text-slate-400 dark:text-slate-500 text-xs shrink-0 whitespace-nowrap">{it.time}</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Card>
  );
}