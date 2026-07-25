/**
 * AuditLogDrawer.jsx
 * Right-side drawer listing the most recent admin actions.
 */
import { useEffect, useState } from 'react';
import {
  X, Loader2, ScrollText, UserPlus, Pencil, ShieldOff, ShieldCheck,
  KeyRound, BadgeCheck, Trash2, RefreshCw, Upload,
} from 'lucide-react';
import { userManagementService } from '../../../services/userManagementService';

const ACTION_META = {
  create_user:    { label: 'Created user',      icon: UserPlus,    color: 'text-emerald-600 bg-emerald-50' },
  update_user:    { label: 'Updated profile',   icon: Pencil,      color: 'text-slate-600 bg-slate-50' },
  change_role:    { label: 'Changed role',      icon: Pencil,      color: 'text-blue-600 bg-blue-50' },
  suspend:        { label: 'Suspended',         icon: ShieldOff,   color: 'text-red-600 bg-red-50' },
  reactivate:     { label: 'Reactivated',       icon: ShieldCheck, color: 'text-emerald-600 bg-emerald-50' },
  delete_user:    { label: 'Deleted user',      icon: Trash2,      color: 'text-red-700 bg-red-50' },
  reset_password: { label: 'Reset password',    icon: KeyRound,    color: 'text-amber-600 bg-amber-50' },
  send_invite:    { label: 'Sent invite',       icon: KeyRound,    color: 'text-amber-600 bg-amber-50' },
  verify_user:    { label: 'Marked verified',   icon: BadgeCheck,  color: 'text-emerald-600 bg-emerald-50' },
  bulk_import:    { label: 'Bulk import',       icon: Upload,      color: 'text-blue-600 bg-blue-50' },
};

function fmt(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleString(); } catch { return d; }
}

export default function AuditLogDrawer({ onClose }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const data = await userManagementService.audit({ limit: 150 });
      setItems(data?.items || []);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load audit log.');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const onEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-xl flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
          <div>
            <h2 className="font-display font-700 text-sm text-slate-800 dark:text-white flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-blue-600" /> Admin audit log
            </h2>
            <p className="text-xs font-body text-slate-400">Last 150 actions.</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={load} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
          ) : error ? (
            <p className="text-sm text-red-600 font-body">{error}</p>
          ) : !items.length ? (
            <p className="text-sm text-slate-400 font-body text-center py-8">No audit entries yet.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((it) => {
                const meta = ACTION_META[it.action] || { label: it.action, icon: ScrollText, color: 'text-slate-600 bg-slate-50' };
                const Icon = meta.icon;
                return (
                  <li key={it.id} className="border border-slate-100 dark:border-white/10 rounded-xl p-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${meta.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-body font-600 text-slate-700 dark:text-slate-200">
                          {meta.label}
                        </p>
                        {it.summary && <p className="text-xs font-body text-slate-500 dark:text-slate-400 truncate">{it.summary}</p>}
                      </div>
                      <p className="text-[10px] font-body text-slate-400 shrink-0">{fmt(it.created_at)}</p>
                    </div>
                    <div className="mt-1.5 text-[11px] font-body text-slate-500 dark:text-slate-400 flex gap-3 flex-wrap">
                      {it.actor && <span>by <b>{it.actor.name}</b></span>}
                      {it.target && <span>→ {it.target.name} ({it.target.role})</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
