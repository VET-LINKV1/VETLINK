/**
 * DiagnosticAnalyticsPage.jsx
 *
 * Diagnostic Analytics (Root Cause) — admin-only.
 * Three tabs: Churn / Treatment Effectiveness / Inventory Shrinkage.
 *
 * Backend:
 *   GET /api/diagnostic/churn       — root-cause attribution for client churn
 *   GET /api/diagnostic/treatment   — protocol comparison + recurrence
 *   GET /api/diagnostic/shrinkage   — used vs billed, expiries, low stock
 *
 * Filters: date-range chips + custom range (shared across tabs)
 * Export:  per-chart CSV (already supported by ChartCard) + full-page PDF
 */
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, Printer, RefreshCcw, Zap, Users, Stethoscope, Boxes,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import diagnosticService from '../../services/diagnosticService';
import { exportPagePdf } from '../../utils/exportHelpers';
import DateRangeFilter from '../../components/healthcheck/DateRangeFilter';

import ChurnTab      from './ChurnTab';
import TreatmentTab  from './TreatmentTab';
import ShrinkageTab  from './ShrinkageTab';

const TABS = [
  { id: 'churn',     label: 'Churn Analysis',         icon: Users      },
  { id: 'treatment', label: 'Treatment Effectiveness', icon: Stethoscope },
  { id: 'shrinkage', label: 'Inventory Shrinkage',     icon: Boxes      },
];

function DiagnosticAnalyticsPage() {
  const { user } = useAuth();
  const [tab, setTab]         = useState('churn');
  const [filters, setFilters] = useState({ startDate: null, endDate: null });
  const [churn, setChurn]         = useState(null);
  const [treatment, setTreatment] = useState(null);
  const [shrinkage, setShrinkage] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  // Each tab loads its own data lazily (the first time it's selected).
  // We always preload Churn since it's the default tab.
  useEffect(() => {
    if (!filters.startDate || !filters.endDate) return; // wait for DateRangeFilter to seed
    let cancelled = false;
    setLoading(true);
    setError('');

    const loader = (() => {
      if (tab === 'churn')     return diagnosticService.getChurn(filters).then((d) => setChurn(d));
      if (tab === 'treatment') return diagnosticService.getTreatment(filters).then((d) => setTreatment(d));
      if (tab === 'shrinkage') return diagnosticService.getShrinkage(filters).then((d) => setShrinkage(d));
      return Promise.resolve();
    })();

    loader
      .catch((err) => {
        if (cancelled) return;
        const msg = err?.response?.data?.error || err?.message || 'Failed to load diagnostic analytics.';
        setError(msg);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [tab, filters.startDate, filters.endDate, reloadKey]);

  const ActiveBody = useMemo(() => {
    if (tab === 'churn')     return <ChurnTab      data={churn}     loading={loading && !churn} />;
    if (tab === 'treatment') return <TreatmentTab  data={treatment} loading={loading && !treatment} />;
    if (tab === 'shrinkage') return <ShrinkageTab  data={shrinkage} loading={loading && !shrinkage} />;
    return null;
  }, [tab, churn, treatment, shrinkage, loading]);

  const dataForCurrent = tab === 'churn' ? churn : tab === 'treatment' ? treatment : shrinkage;

  return (
    <div className="space-y-5 diagnostic-printable">
      {/* Print-only stylesheet */}
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden, header.app-topbar, aside, .ProtectedRoute > nav { display: none !important; }
          main { padding: 0 !important; }
          .diagnostic-printable section { break-inside: avoid; page-break-inside: avoid; box-shadow: none !important; border-color: #e2e8f0 !important; }
          .diagnostic-printable { padding: 16px; }
          .grid { gap: 12px !important; }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 mb-2 px-2.5 py-1 rounded-full bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-400/20">
            <Zap className="w-3.5 h-3.5 text-violet-600" />
            <span className="text-xs font-body font-600 text-violet-700 dark:text-violet-300 uppercase tracking-wider">
              Diagnostic Analytics
            </span>
          </div>
          <h1 className="font-display text-slate-800 dark:text-white text-2xl lg:text-3xl font-700">
            Root Cause Analysis
          </h1>
          <p className="font-body text-slate-500 dark:text-slate-400 text-sm mt-1">
            Why metrics moved — churn drivers, treatment effectiveness, inventory shrinkage.
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
            Reload
          </button>
          <button
            onClick={() => exportPagePdf(`diagnostic-${tab}-${dataForCurrent?.window?.end || 'today'}.pdf`)}
            disabled={!dataForCurrent}
            className="inline-flex items-center gap-1.5 text-xs font-body font-600 text-white px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 transition-colors shadow-sm shadow-violet-500/20"
          >
            <Printer className="w-3.5 h-3.5" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Date filter */}
      <DateRangeFilter value={filters} onChange={setFilters} />

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

      {/* Window summary */}
      {dataForCurrent?.window && (
        <p className="font-body text-xs text-slate-400">
          Window: <span className="font-mono">{dataForCurrent.window.start}</span> →{' '}
          <span className="font-mono">{dataForCurrent.window.end}</span>
          {dataForCurrent.window.prev_start && (
            <>
              {' '}&middot; compared to <span className="font-mono">{dataForCurrent.window.prev_start}</span> →{' '}
              <span className="font-mono">{dataForCurrent.window.prev_end}</span>
            </>
          )}
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-400/20 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-display text-red-700 dark:text-red-300 font-600 text-sm">Couldn't load diagnostic analytics</p>
            <p className="font-body text-red-600 dark:text-red-400 text-xs mt-0.5">{error}</p>
            <p className="font-body text-red-500 dark:text-red-400 text-xs mt-1">
              Make sure <code className="font-mono">database/phase6_diagnostic.sql</code> has been applied.
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

export default DiagnosticAnalyticsPage;
