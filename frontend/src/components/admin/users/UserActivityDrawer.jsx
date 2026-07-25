/**
 * UserActivityDrawer.jsx
 * Right-side drawer showing a per-user activity bundle:
 * pets, recent appointments, recent messages, audit history.
 */
import { useEffect, useState } from 'react';
import { X, Loader2, PawPrint, Calendar, MessageCircle, ScrollText } from 'lucide-react';
import { userManagementService } from '../../../services/userManagementService';

const ACTION_LABEL = {
  create_user:    'Created account',
  update_user:    'Updated profile',
  change_role:    'Changed role',
  suspend:        'Suspended',
  reactivate:     'Reactivated',
  delete_user:    'Deleted',
  reset_password: 'Sent password reset',
  send_invite:    'Sent invite',
  verify_user:    'Marked verified',
  bulk_import:    'Imported via CSV',
};

function fmt(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleString(); } catch { return d; }
}

export default function UserActivityDrawer({ user, onClose }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError('');
      try {
        const d = await userManagementService.activity(user.id);
        if (alive) setData(d);
      } catch (e) {
        setError(e?.response?.data?.error || 'Failed to load activity.');
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [user.id]);

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
            <h2 className="font-display font-700 text-sm text-slate-800 dark:text-white">Activity</h2>
            <p className="text-xs font-body text-slate-400 truncate">{user.name} · {user.email}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 scrollbar-thin">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
          ) : error ? (
            <p className="text-sm text-red-600 font-body">{error}</p>
          ) : !data ? null : (
            <>
              <Section icon={ScrollText} title="Audit history">
                {data.audit?.length ? data.audit.map(a => (
                  <Row key={a.id} title={ACTION_LABEL[a.action] || a.action} subtitle={a.summary} when={a.created_at} />
                )) : <Empty>No audit entries yet.</Empty>}
              </Section>

              <Section icon={PawPrint} title="Pets">
                {data.pets?.length ? data.pets.map(p => (
                  <Row key={p.id} title={p.name} subtitle={[p.species, p.breed].filter(Boolean).join(' · ')} when={p.created_at} />
                )) : <Empty>No pets on file.</Empty>}
              </Section>

              <Section icon={Calendar} title="Recent appointments">
                {data.appointments?.length ? data.appointments.map(a => (
                  <Row key={a.id} title={a.reason || 'Visit'} subtitle={a.status} when={a.appointment_at} />
                )) : <Empty>No recent appointments.</Empty>}
              </Section>

              <Section icon={MessageCircle} title="Recent messages">
                {data.messages?.length ? data.messages.map(m => (
                  <Row key={m.id} title={m.kind} subtitle="" when={m.created_at} />
                )) : <Empty>No recent messages.</Empty>}
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div>
      <p className="text-xs font-body font-600 uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {title}
      </p>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}
function Row({ title, subtitle, when }) {
  return (
    <li className="bg-slate-50 dark:bg-white/5 rounded-xl px-3 py-2 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-body font-600 text-slate-700 dark:text-slate-200 truncate">{title}</p>
        {subtitle && <p className="text-xs font-body text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>}
      </div>
      <p className="text-[10px] font-body text-slate-400 shrink-0">{fmt(when)}</p>
    </li>
  );
}
function Empty({ children }) {
  return <li className="text-xs font-body text-slate-400 italic">{children}</li>;
}
