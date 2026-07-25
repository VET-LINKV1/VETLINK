/**
 * UserManagementPage.jsx
 * Admin-only single page for managing users (admins/vets/staff/clients).
 *
 * Layout:
 *   Top:      stats cards
 *   Toolbar:  search, role filter, status filter, "+ New user", "Import CSV", "Audit log"
 *   Table:    paginated list with row actions
 *   Drawers:  Edit user, Activity, Create, Bulk import, Audit log
 */
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { userManagementService } from '../../services/userManagementService';
import UserTable          from '../../components/admin/users/UserTable';
import UserFormDialog     from '../../components/admin/users/UserFormDialog';
import UserActivityDrawer from '../../components/admin/users/UserActivityDrawer';
import CsvImportDialog    from '../../components/admin/users/CsvImportDialog';
import AuditLogDrawer     from '../../components/admin/users/AuditLogDrawer';
import {
  Users, Search, Plus, Upload, ScrollText, Loader2, RefreshCw, ShieldCheck, ShieldOff, UserCheck,
} from 'lucide-react';

const ROLE_FILTERS = [
  { key: '',             label: 'All roles' },
  { key: 'admin',        label: 'Admins' },
  { key: 'veterinarian', label: 'Veterinarians' },
  { key: 'staff',        label: 'Staff' },
  { key: 'client',       label: 'Clients' },
];

const STATUS_FILTERS = [
  { key: 'all',       label: 'All' },
  { key: 'active',    label: 'Active' },
  { key: 'suspended', label: 'Suspended' },
];

export default function UserManagementPage() {
  const { user: me } = useAuth();

  // Filters
  const [q, setQ]             = useState('');
  const [role, setRole]       = useState('');
  const [status, setStatus]   = useState('all');
  const [page, setPage]       = useState(0);
  const [sort, setSort]       = useState('created_at');
  const [dir,  setDir]        = useState('desc');
  const limit = 25;

  // Data
  const [list, setList]       = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [flash, setFlash]     = useState('');

  // Drawers / dialogs
  const [editing, setEditing]       = useState(null);   // user row being edited
  const [creating, setCreating]     = useState(false);
  const [activityFor, setActivity]  = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showAudit,  setShowAudit]  = useState(false);

  const reload = async () => {
    setLoading(true); setError('');
    try {
      const data = await userManagementService.list({
        q, role, status, sort, dir, limit, offset: page * limit,
      });
      setList(data || { items: [], total: 0 });
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load users.');
    } finally { setLoading(false); }
  };

  // Debounced reload on filter change
  useEffect(() => {
    const t = setTimeout(reload, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q, role, status, sort, dir, page]);

  // Stats derived from current list (small enough to compute client-side per page;
  // can be swapped to a dedicated /stats endpoint later).
  const stats = useMemo(() => {
    const items = list.items || [];
    return {
      total:      list.total || 0,
      pageActive: items.filter(u => u.is_active).length,
      pageStaff:  items.filter(u => u.role !== 'client').length,
      pageClient: items.filter(u => u.role === 'client').length,
    };
  }, [list]);

  // Row actions
  const doAction = async (fn, msg) => {
    try {
      await fn();
      setFlash(msg);
      reload();
      setTimeout(() => setFlash(''), 2500);
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
      setTimeout(() => setError(''), 4000);
    }
  };

  const onSuspend     = (u) => doAction(() => userManagementService.suspend(u.id),    `Suspended ${u.name}.`);
  const onReactivate  = (u) => doAction(() => userManagementService.reactivate(u.id), `Reactivated ${u.name}.`);
  const onVerify      = (u) => doAction(() => userManagementService.verify(u.id),     `Marked ${u.name} as verified.`);
  const onResetPwd    = async (u) => {
    try {
      const res = await userManagementService.resetPassword(u.id);
      const link = res?.link;
      if (link) {
        await navigator.clipboard.writeText(link).catch(() => {});
        setFlash(`Reset link copied for ${u.email}.`);
      } else {
        setFlash(`Reset link generated for ${u.email}.`);
      }
      setTimeout(() => setFlash(''), 3000);
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not generate reset link.');
      setTimeout(() => setError(''), 4000);
    }
  };
  const onDelete = async (u) => {
    if (u.id === me?.id) {
      setError('You cannot delete your own account.');
      setTimeout(() => setError(''), 3000);
      return;
    }
    if (!window.confirm(`Delete ${u.name} (${u.email})? This cannot be undone.`)) return;
    doAction(() => userManagementService.remove(u.id), `Deleted ${u.email}.`);
  };

  const totalPages = Math.max(1, Math.ceil((list.total || 0) / limit));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-700 text-xl text-slate-800 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" /> User Management
          </h1>
          <p className="text-xs font-body text-slate-400">Manage admins, veterinarians, staff, and clients.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAudit(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 text-xs font-body font-600 flex items-center gap-1.5 hover:bg-slate-200 dark:hover:bg-white/10">
            <ScrollText className="w-3.5 h-3.5" /> Audit log
          </button>
          <button onClick={() => setShowImport(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 text-xs font-body font-600 flex items-center gap-1.5 hover:bg-slate-200 dark:hover:bg-white/10">
            <Upload className="w-3.5 h-3.5" /> Import CSV
          </button>
          <button onClick={() => setCreating(true)}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-body font-600 flex items-center gap-1.5 shadow shadow-blue-500/20">
            <Plus className="w-3.5 h-3.5" /> New user
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Users}        label="Total users"      value={stats.total} />
        <StatCard icon={UserCheck}    label="Active on page"   value={stats.pageActive} />
        <StatCard icon={ShieldCheck}  label="Staff on page"    value={stats.pageStaff} />
        <StatCard icon={ShieldOff}    label="Clients on page"  value={stats.pageClient} />
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 bg-slate-50 dark:bg-white/5 rounded-lg px-2.5 py-1.5 min-w-[16rem] flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input value={q} onChange={(e) => { setPage(0); setQ(e.target.value); }}
              placeholder="Search by name, email, or phone…"
              className="flex-1 bg-transparent outline-none text-sm font-body text-slate-700 dark:text-slate-200 placeholder:text-slate-400" />
          </label>

          <select value={role} onChange={(e) => { setPage(0); setRole(e.target.value); }}
            className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-body text-slate-700 dark:text-slate-200">
            {ROLE_FILTERS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>

          <select value={status} onChange={(e) => { setPage(0); setStatus(e.target.value); }}
            className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-body text-slate-700 dark:text-slate-200">
            {STATUS_FILTERS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>

          <button onClick={reload}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
            title="Refresh">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Flash / error */}
      {flash && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-3 py-2 text-xs font-body">{flash}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-xs font-body">{error}</div>}

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : !list.items?.length ? (
          <div className="p-10 text-center">
            <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-body text-slate-400">No users match these filters.</p>
          </div>
        ) : (
          <UserTable
            items={list.items}
            currentUserId={me?.id}
            sort={sort} dir={dir}
            onSortChange={(s, d) => { setSort(s); setDir(d); }}
            onEdit={(u) => setEditing(u)}
            onActivity={(u) => setActivity(u)}
            onSuspend={onSuspend}
            onReactivate={onReactivate}
            onVerify={onVerify}
            onResetPwd={onResetPwd}
            onDelete={onDelete}
          />
        )}

        {/* Pagination */}
        {!loading && list.total > limit && (
          <div className="border-t border-slate-100 dark:border-white/10 px-4 py-2 flex items-center justify-between">
            <p className="text-xs font-body text-slate-400">
              Page {page + 1} of {totalPages} · {list.total} users
            </p>
            <div className="flex gap-1">
              <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}
                className="px-2 py-1 rounded-lg text-xs font-body font-600 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 disabled:opacity-40">
                Prev
              </button>
              <button disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}
                className="px-2 py-1 rounded-lg text-xs font-body font-600 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs / drawers */}
      {creating && (
        <UserFormDialog
          mode="create"
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); reload(); setFlash('User created.'); setTimeout(() => setFlash(''), 2500); }}
        />
      )}
      {editing && (
        <UserFormDialog
          mode="edit"
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); setFlash('Saved.'); setTimeout(() => setFlash(''), 2500); }}
        />
      )}
      {activityFor && (
        <UserActivityDrawer
          user={activityFor}
          onClose={() => setActivity(null)}
        />
      )}
      {showImport && (
        <CsvImportDialog
          onClose={() => setShowImport(false)}
          onDone={(res) => {
            setShowImport(false);
            reload();
            setFlash(`Imported ${res?.ok?.length || 0} users, ${res?.failed?.length || 0} failed.`);
            setTimeout(() => setFlash(''), 3500);
          }}
        />
      )}
      {showAudit && (
        <AuditLogDrawer onClose={() => setShowAudit(false)} />
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xs font-body text-slate-400">{label}</p>
        <p className="font-display font-700 text-lg text-slate-800 dark:text-white">{value}</p>
      </div>
    </div>
  );
}
