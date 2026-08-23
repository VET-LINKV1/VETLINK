/**
 * AuditLogs.jsx
 * Append-only administrative activity log.
 * Records: logins, user creation, permission changes, pet/medical/prescription/payment updates,
 * appointment changes, system config changes.
 * Protected from unauthorized modification or deletion.
 */
import { useState, useEffect } from 'react';
import { ScrollText, Loader2, RefreshCw, Search, Filter, ChevronLeft, ChevronRight, Download, Shield, AlertTriangle } from 'lucide-react';
import { settingsService } from '../../services/settingsService';
import { SettingCard, Field, Select, StatusPill, Note, ErrorCard } from './primitives';

const ACTION_META = {
  login:             { label: 'User login',           icon: ScrollText,  color: 'text-blue-600 bg-blue-50' },
  logout:            { label: 'User logout',          icon: ScrollText,  color: 'text-slate-600 bg-slate-50' },
  user_create:       { label: 'User created',         icon: ScrollText,  color: 'text-emerald-600 bg-emerald-50' },
  user_update:       { label: 'User updated',         icon: ScrollText,  color: 'text-slate-600 bg-slate-50' },
  permission_change: { label: 'Permission changed',   icon: Shield,      color: 'text-blue-600 bg-blue-50' },
  pet_update:        { label: 'Pet record updated',   icon: ScrollText,  color: 'text-slate-600 bg-slate-50' },
  medical_update:    { label: 'Medical record mod.',  icon: ScrollText,  color: 'text-sky-600 bg-sky-50' },
  appointment_change:{ label: 'Appointment changed',  icon: ScrollText,  color: 'text-amber-600 bg-amber-50' },
  prescription_change:{label: 'Prescription changed', icon: ScrollText,  color: 'text-purple-600 bg-purple-50' },
  payment_change:    { label: 'Payment changed',      icon: ScrollText,  color: 'text-emerald-600 bg-emerald-50' },
  config_change:     { label: 'System config changed',icon: Shield,      color: 'text-red-600 bg-red-50' },
};

const FILTER_OPTIONS = [
  { key: 'all',           label: 'All actions' },
  { key: 'login',         label: 'Logins' },
  { key: 'user_create',   label: 'User creation' },
  { key: 'permission_change', label: 'Permission changes' },
  { key: 'pet_update',    label: 'Pet records' },
  { key: 'medical_update',label: 'Medical records' },
  { key: 'appointment_change', label: 'Appointments' },
  { key: 'prescription_change',label: 'Prescriptions' },
  { key: 'payment_change',label: 'Payments' },
  { key: 'config_change', label: 'Config changes' },
];

function fmt(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleString(); } catch { return d; }
}

export default function AuditLogs() {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize] = useState(25);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  // Load audit log on mount and when filter/page/search changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const offset = page * pageSize;
        const action = filter === 'all' ? 'all' : filter;
        const result = await settingsService.getAuditLog({
          limit: pageSize,
          offset,
          action,
          q: search,
        });
        if (!cancelled) {
          setError(null);
          setEntries(result.items || []);
          setTotal(result.total || 0);
        }
      } catch (err) {
        console.error('Failed to load audit log:', err);
        if (!cancelled) {
          setEntries([]);
          setTotal(0);
          setError('Failed to load audit log. Is the backend running and the Phase 20 migration applied?');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [filter, search, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleExport = async () => {
    setExporting(true);
    try {
      // Fetch all pages for export
      const allItems = [];
      const totalPagesExport = Math.max(1, Math.ceil(total / pageSize));
      for (let p = 0; p < totalPagesExport; p++) {
        const offset = p * pageSize;
        const action = filter === 'all' ? 'all' : filter;
        const result = await settingsService.getAuditLog({
          limit: pageSize,
          offset,
          action,
          q: search,
        });
        if (result.items) {
          allItems.push(...result.items);
        }
      }
      const csv = ['ID,Action,Actor,Summary,Timestamp', ...allItems.map(e => `${e.id},${e.action},${e.actor},"${e.summary}",${e.at}`)].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <SettingCard title="Audit Log" subtitle="Immutable record of all administrative actions." icon={ScrollText}>
        {error && <div className="mb-4"><ErrorCard message={error} onRetry={() => window.location.reload()} /></div>}
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => { setPage(0); setSearch(e.target.value); }}
              placeholder="Search action, actor, or summary…"
              className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm font-body text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <select value={filter} onChange={e => { setPage(0); setFilter(e.target.value); }}
            className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-body text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500">
            {FILTER_OPTIONS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>

          <button onClick={handleExport} disabled={exporting}
            className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 text-sm font-body font-600 flex items-center gap-1.5 hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-50">
            <Download className="w-4 h-4" /> Export CSV
          </button>

          <Note tone="info" className="ml-auto mb-0">This log is append-only and cannot be modified or deleted.</Note>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead className="bg-slate-50 dark:bg-white/5">
              <tr className="text-left text-xs font-600 uppercase tracking-wider text-slate-400">
                <th className="px-4 py-2.5">Time</th>
                <th className="px-4 py-2.5">Action</th>
                <th className="px-4 py-2.5">Actor</th>
                <th className="px-4 py-2.5">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Loading…
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-400">No entries match these filters.</td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const meta = ACTION_META[entry.action] || { label: entry.action, icon: ScrollText, color: 'text-slate-600 bg-slate-50' };
                  const Icon = meta.icon;
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmt(entry.at)}</td>
                      <td className="px-4 py-3">
                        <StatusPill tone="neutral" className={meta.color}>
                          <Icon className="w-3.5 h-3.5" />
                          {meta.label}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-3 font-body font-600 text-slate-700 dark:text-slate-200">{entry.actor}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 truncate max-w-xs">{entry.summary}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/10">
            <p className="text-xs font-body text-slate-400">
              Page {page + 1} of {totalPages} · {total} entries
            </p>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0 || loading}
                className="px-2.5 py-1.5 rounded-lg text-xs font-body font-600 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 disabled:opacity-40">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page + 1 >= totalPages || loading}
                className="px-2.5 py-1.5 rounded-lg text-xs font-body font-600 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 disabled:opacity-40">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </SettingCard>

      <div className="bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-display text-red-800 dark:text-red-200 font-600">Audit Log Protection</h4>
            <ul className="text-sm font-body text-red-700 dark:text-red-300 mt-1 space-y-1 list-disc list-inside">
              <li>Audit entries are <strong>append-only</strong> — no UI or API permits editing or deleting existing records.</li>
              <li>Retention: 500 most recent entries in browser storage; backend must enforce immutable storage.</li>
              <li>Export creates a CSV snapshot; the live log is never altered.</li>
              <li>Any attempt to modify the log is itself logged as <code>config_change</code>.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}