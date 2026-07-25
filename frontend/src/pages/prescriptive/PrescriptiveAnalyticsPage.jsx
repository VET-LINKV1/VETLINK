/**
 * PrescriptiveAnalyticsPage.jsx
 *
 * Prescriptive Analytics (Action Plan) — admin / vet.
 * Three tabs: Scheduling / Wellness / Ordering.
 *
 * Backend:
 *   GET /api/prescriptive/scheduling — schedule recommendations
 *   GET /api/prescriptive/wellness   — per-pet wellness plans
 *   GET /api/prescriptive/ordering   — purchase-order recommendations
 *
 * Lazy-loads each tab. Horizon picker controls the ordering tab's coverage.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, Printer, RefreshCcw, Wand2,
  Calendar, HeartPulse, ShoppingCart,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import prescriptiveService from '../../services/prescriptiveService';
import { exportPagePdf } from '../../utils/exportHelpers';
import HorizonSelector from '../../components/predictive/HorizonSelector';

import SchedulingTab from './SchedulingTab';
import WellnessTab   from './WellnessTab';
import OrderingTab   from './OrderingTab';

const TABS = [
  { id: 'scheduling', label: 'Dynamic Scheduling',  icon: Calendar     },
  { id: 'wellness',   label: 'Wellness Plans',      icon: HeartPulse   },
  { id: 'ordering',   label: 'Optimised Ordering',  icon: ShoppingCart },
];

function PrescriptiveAnalyticsPage() {
  const { user } = useAuth();
  const [tab, setTab]               = useState('scheduling');
  const [horizon, setHorizon]       = useState(6); // months — converted to days for ordering
  const [scheduling, setScheduling] = useState(null);
  const [wellness, setWellness]     = useState(null);
  const [ordering, setOrdering]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [reloadKey, setReloadKey]   = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    const loader = (() => {
      if (tab === 'scheduling') return prescriptiveService.getScheduling().then(setScheduling);
      if (tab === 'wellness')   return prescriptiveService.getWellness().then(setWellness);
      if (tab === 'ordering')   return prescriptiveService.getOrdering({ horizonDays: horizon * 30 }).then(setOrdering);
      return Promise.resolve();
    })();

    loader
      .catch((err) => {
        if (cancelled) return;
        const msg = err?.response?.data?.error || err?.message || 'Failed to load prescriptive analytics.';
        setError(msg);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [tab, horizon, reloadKey]);

  const ActiveBody = useMemo(() => {
    if (tab === 'scheduling') return <SchedulingTab data={scheduling} loading={loading && !scheduling} />;
    if (tab === 'wellness')   return <WellnessTab   data={wellness}   loading={loading && !wellness} />;
    if (tab === 'ordering')   return <OrderingTab   data={ordering}   loading={loading && !ordering} />;
    return null;
  }, [tab, scheduling, wellness, ordering, loading]);

  const dataForCurrent =
    tab === 'scheduling' ? scheduling :
    tab === 'wellness'   ? wellness :
                            ordering;

  return (
    <div className="space-y-5 prescriptive-printable">
      {/* Print-only stylesheet */}
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden, header.app-topbar, aside { display: none !important; }
          main { padding: 0 !important; }
          .prescriptive-printable section { break-inside: avoid; page-break-inside: avoid; box-shadow: none !important; border-color: #e2e8f0 !important; }
          .prescriptive-printable { padding: 16px; }
          .grid { gap: 12px !important; }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 mb-2 px-2.5 py-1 rounded-full bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-400/20">
            <Wand2 className="w-3.5 h-3.5 text-violet-600" />
            <span className="text-xs font-body font-600 text-violet-700 dark:text-violet-300 uppercase tracking-wider">
              Prescriptive Analytics
            </span>
          </div>
          <h1 className="font-display text-slate-800 dark:text-white text-2xl lg:text-3xl font-700">
            Action Plan
          </h1>
          <p className="font-body text-slate-500 dark:text-slate-400 text-sm mt-1">
            Specific, ranked recommendations — best schedules, custom wellness plans, optimised orders.
            {user?.name && <span className="text-slate-400"> &middot; viewing as {user.name}</span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs font-body font-500 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 hover:border-violet-300 hover:text-violet-600 disabled:opacity-50 transition-colors"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Regenerate
          </button>
          <button
            onClick={() => exportPagePdf(`prescriptive-${tab}-${new Date().toISOString().slice(0, 10)}.pdf`)}
            disabled={!dataForCurrent}
            className="inline-flex items-center gap-1.5 text-xs font-body font-600 text-white px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 transition-colors shadow-sm shadow-violet-500/20"
          >
            <Printer className="w-3.5 h-3.5" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Horizon — only meaningful for ordering, but always visible for consistency */}
      {tab === 'ordering' && (
        <HorizonSelector value={horizon} onChange={setHorizon} />
      )}

      {/* Tab bar */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-white/10 w-fit print:hidden">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 text-xs font-body font-600 px-3 py-2 rounded-lg transition-colors ${
                active
                  ? 'bg-white dark:bg-slate-800 text-violet-700 dark:text-violet-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Engine meta line */}
      {dataForCurrent?.meta && (
        <p className="font-body text-xs text-slate-400">
          Engine: <span className="font-mono">{dataForCurrent.meta.engine || '—'}</span>
          {' '}&middot; generated <span className="font-mono">{new Date(dataForCurrent.meta.generated_at).toLocaleString()}</span>
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-400/20 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-display text-red-700 dark:text-red-300 font-600 text-sm">Couldn't load prescriptive analytics</p>
            <p className="font-body text-red-600 dark:text-red-400 text-xs mt-0.5">{error}</p>
            <p className="font-body text-red-500 dark:text-red-400 text-xs mt-1">
              Make sure <code className="font-mono">database/phase8_prescriptive.sql</code> has been applied
              (after phase7_predictive.sql).
            </p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && !dataForCurrent && (
        <div className="flex items-center justify-center py-16">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i}
                   className="w-2.5 h-2.5 rounded-full bg-violet-400 animate-bounce"
                   style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}

      {/* Body */}
      {!error && ActiveBody}
    </div>
  );
}

export default PrescriptiveAnalyticsPage;
