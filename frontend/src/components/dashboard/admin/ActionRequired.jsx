/**
 * ActionRequired.jsx
 * Items needing administrative attention, ranked by severity.
 * Each row deep-links to the relevant module.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertOctagon, Clock3, FlaskConical, Pill, Receipt, UserX, ChevronRight, ArrowRight } from 'lucide-react';
import { Card, SectionHeader, SkeletonRows, ErrorState } from './primitives';
import { dashboardApi } from './mockData';

const KIND = {
  overdue:   { Icon: Clock3,   tone: 'red',    label: 'Overdue' },
  lab:       { Icon: FlaskConical, tone: 'amber', label: 'Lab' },
  refill:    { Icon: Pill,     tone: 'sky',    label: 'Refill' },
  invoice:   { Icon: Receipt,  tone: 'violet', label: 'Invoice' },
  'no-show': { Icon: UserX,    tone: 'slate',  label: 'No-show' },
};

const SEVERITY_RANK = { high: 0, medium: 1, low: 2 };

export default function ActionRequired() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setItems(await dashboardApi.getActions());
    } catch (e) {
      setError(e.message || 'Failed to load action items');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const sorted = [...items].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  const highCount = items.filter((i) => i.severity === 'high').length;

  return (
    <Card>
      <SectionHeader
        title="Action Required"
        subtitle={`${items.length} items · ${highCount} high priority`}
        icon={AlertOctagon}
        action={
          <span className={`inline-flex items-center gap-1.5 text-xs font-body font-700 px-2.5 py-1 rounded-lg ${
            highCount ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${highCount ? 'bg-red-500' : 'bg-emerald-500'}`} />
            {highCount ? 'Attention' : 'All clear'}
          </span>
        }
      />
      <div className="p-3 sm:p-4">
        {loading ? (
          <SkeletonRows rows={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-3">
              <ArrowRight className="w-6 h-6 text-emerald-500" />
            </div>
            <p className="font-body text-slate-500 dark:text-slate-400 text-sm">Nothing needs your attention right now.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((item) => {
              const cfg = KIND[item.kind] || KIND.overdue;
              const { Icon } = cfg;
              const toneSoft = {
                red: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',
                amber: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
                sky: 'bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/20',
                violet: 'bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20',
                slate: 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10',
              }[cfg.tone];
              return (
                <Link
                  key={item.id}
                  to={item.to}
                  className="group flex items-center gap-3 p-3 rounded-xl border transition-all hover:shadow-sm hover:-translate-y-0.5"
                >
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${toneSoft}`}>
                    <Icon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-body text-slate-800 dark:text-slate-100 text-sm font-600 truncate">{item.title}</p>
                      {item.severity === 'high' && (
                        <span className="text-[10px] font-700 px-1.5 py-0.5 rounded bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400 uppercase tracking-wide">Urgent</span>
                      )}
                    </div>
                    <p className="font-body text-slate-400 dark:text-slate-500 text-xs truncate">{item.detail}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-body font-600 text-blue-600 dark:text-blue-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.action}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
