/**
 * HealthCheckPage.jsx
 *
 * "The Health Check" — VETLINK's descriptive analytics module.
 * One page, four role-aware dashboards (admin / vet / staff / client).
 *
 * Backend: GET /api/analytics/health-check  (auto-routes by caller role)
 * Filters: date-range chips + custom range
 * Export:  per-chart CSV   +   full-page PDF (browser print)
 */
import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertCircle, Printer, RefreshCcw } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import healthCheckService from '../services/healthCheckService';
import { exportPagePdf } from '../utils/exportHelpers';
import DateRangeFilter from '../components/healthcheck/DateRangeFilter';

import AdminHealthCheck  from './health-check/AdminHealthCheck';
import VetHealthCheck    from './health-check/VetHealthCheck';
import StaffHealthCheck  from './health-check/StaffHealthCheck';
import ClientHealthCheck from './health-check/ClientHealthCheck';

const ROLE_TITLE = {
  admin:        'Clinic Health Check',
  veterinarian: 'My Caseload Health Check',
  staff:        'Operations Health Check',
  client:       'Pet Family Health Check',
};

const ROLE_BLURB = {
  admin:        'Clinic-wide descriptive analytics — appointments, patients, diagnoses, and revenue.',
  veterinarian: 'Your caseload, recorded diagnoses, and follow-up workload.',
  staff:        'Throughput, queue mix, no-shows, and money in & out.',
  client:       "Your pets' visit history, growth, and upcoming care.",
};

function HealthCheckPage() {
  const { user, role } = useAuth();
  const [filters, setFilters] = useState({ startDate: null, endDate: null });
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!filters.startDate || !filters.endDate) return; // wait for DateRangeFilter to seed
    setLoading(true);
    setError('');
    healthCheckService.getMine(filters)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err) => {
        if (cancelled) return;
        const msg = err?.response?.data?.error || err?.message || 'Failed to load analytics.';
        setError(msg);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters.startDate, filters.endDate, reloadKey]);

  const title = ROLE_TITLE[role]  || 'Health Check';
  const blurb = ROLE_BLURB[role]  || 'Descriptive analytics dashboard.';

  const Body = useMemo(() => {
    if (!data) return null;
    if (role === 'admin')             return <AdminHealthCheck  data={data} />;
    if (role === 'veterinarian')      return <VetHealthCheck    data={data} />;
    if (role === 'staff')             return <StaffHealthCheck  data={data} />;
    return <ClientHealthCheck data={data} />;
  }, [data, role]);

  return (
    <div className="space-y-5 health-check-printable">
      {/* Print-only stylesheet — keeps PDF clean */}
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden, header.app-topbar, aside, .ProtectedRoute > nav { display: none !important; }
          main { padding: 0 !important; }
          .health-check-printable section { break-inside: avoid; page-break-inside: avoid; box-shadow: none !important; border-color: #e2e8f0 !important; }
          .health-check-printable { padding: 16px; }
          .grid { gap: 12px !important; }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 mb-2 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-400/20">
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-body font-600 text-blue-700 dark:text-blue-300 uppercase tracking-wider">
              Descriptive Analytics
            </span>
          </div>
          <h1 className="font-display text-slate-800 dark:text-white text-2xl lg:text-3xl font-700">{title}</h1>
          <p className="font-body text-slate-500 dark:text-slate-400 text-sm mt-1">
            {blurb}
            {user?.name && <span className="text-slate-400"> &middot; for {user.name}</span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs font-body font-500 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 hover:border-blue-300 hover:text-blue-600 disabled:opacity-50 transition-colors"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Reload
          </button>
          <button
            onClick={() => exportPagePdf(`health-check-${role}-${data?.window?.end || 'today'}.pdf`)}
            disabled={!data}
            className="inline-flex items-center gap-1.5 text-xs font-body font-600 text-white px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm shadow-blue-500/20"
          >
            <Printer className="w-3.5 h-3.5" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Date filter */}
      <DateRangeFilter value={filters} onChange={setFilters} />

      {/* Window summary */}
      {data?.window && (
        <p className="font-body text-xs text-slate-400">
          Window: <span className="font-mono">{data.window.start}</span> → <span className="font-mono">{data.window.end}</span>
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-400/20 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-display text-red-700 dark:text-red-300 font-600 text-sm">Couldn't load analytics</p>
            <p className="font-body text-red-600 dark:text-red-400 text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex gap-1.5">
            {[0,1,2].map((i) => (
              <div key={i}
                   className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-bounce"
                   style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}

      {/* Body */}
      {!loading && !error && Body}
    </div>
  );
}

export default HealthCheckPage;
