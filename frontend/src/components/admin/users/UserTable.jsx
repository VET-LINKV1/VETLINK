/**
 * UserTable.jsx
 * Renders the table body for the User Management page.
 *
 * Props:
 *   items        Array of users from /api/admin/users
 *   currentUserId  The signed-in admin's id (to hide self-destructive actions)
 *   sort, dir, onSortChange
 *   onEdit, onActivity, onSuspend, onReactivate, onVerify, onResetPwd, onDelete
 */
import { useState } from 'react';
import {
  ArrowUpDown, MoreHorizontal, User, ShieldCheck, ShieldOff, Pencil,
  Activity, KeyRound, BadgeCheck, Trash2, Pause, Play,
} from 'lucide-react';

const ROLE_BADGE = {
  admin:        'bg-purple-100 text-purple-700',
  veterinarian: 'bg-blue-100   text-blue-700',
  staff:        'bg-amber-100  text-amber-700',
  client:       'bg-sky-100    text-sky-700',
};

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' }); }
  catch { return d; }
}

export default function UserTable({
  items, currentUserId,
  sort, dir, onSortChange,
  onEdit, onActivity, onSuspend, onReactivate, onVerify, onResetPwd, onDelete,
}) {
  const sortBtn = (col, label) => {
    const active = sort === col;
    const nextDir = active && dir === 'asc' ? 'desc' : 'asc';
    return (
      <button
        onClick={() => onSortChange(col, active ? nextDir : 'asc')}
        className={`inline-flex items-center gap-1 ${active ? 'text-blue-600' : 'text-slate-500 dark:text-slate-400'}`}
      >
        {label}
        <ArrowUpDown className="w-3 h-3 opacity-60" />
      </button>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm font-body">
        <thead className="bg-slate-50 dark:bg-white/5">
          <tr className="text-left text-xs font-600 uppercase tracking-wider text-slate-400">
            <th className="px-4 py-2.5">{sortBtn('name', 'User')}</th>
            <th className="px-4 py-2.5">{sortBtn('role', 'Role')}</th>
            <th className="px-4 py-2.5">Phone</th>
            <th className="px-4 py-2.5">{sortBtn('is_active', 'Status')}</th>
            <th className="px-4 py-2.5">{sortBtn('created_at', 'Joined')}</th>
            <th className="px-4 py-2.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-white/5">
          {items.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              isSelf={u.id === currentUserId}
              onEdit={onEdit}
              onActivity={onActivity}
              onSuspend={onSuspend}
              onReactivate={onReactivate}
              onVerify={onVerify}
              onResetPwd={onResetPwd}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserRow({ user: u, isSelf, onEdit, onActivity, onSuspend, onReactivate, onVerify, onResetPwd, onDelete }) {
  const [menu, setMenu] = useState(false);
  const initials = (u.name || '?').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();

  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          {u.avatar_url
            ? <img src={u.avatar_url} alt={u.name} className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-white/10" />
            : <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-display font-700 text-xs">{initials}</div>}
          <div className="min-w-0">
            <p className="font-600 text-slate-700 dark:text-slate-200 truncate">{u.name}{isSelf && <span className="ml-1.5 text-[10px] font-body font-600 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-500">you</span>}</p>
            <p className="text-xs text-slate-400 truncate">{u.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`text-[10px] font-700 uppercase tracking-wider px-2 py-0.5 rounded-full ${ROLE_BADGE[u.role] || 'bg-slate-100 text-slate-600'}`}>
          {u.role}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{u.phone_number || '—'}</td>
      <td className="px-4 py-3">
        {u.is_active ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-700 uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
            <ShieldCheck className="w-3 h-3" /> Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-700 uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-700">
            <ShieldOff className="w-3 h-3" /> Suspended
          </span>
        )}
        {!u.is_verified && (
          <span className="ml-1 inline-flex items-center text-[10px] font-700 uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
            Unverified
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{fmtDate(u.created_at)}</td>
      <td className="px-4 py-3 text-right relative">
        <div className="inline-flex items-center gap-1">
          <button onClick={() => onActivity(u)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500" title="Activity">
            <Activity className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onEdit(u)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500" title="Edit">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setMenu(s => !s)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500" title="More">
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          {menu && (
            <div className="absolute right-2 top-10 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-lg py-1.5 w-52 text-left">
              <MenuItem onClick={() => { setMenu(false); onResetPwd(u); }} icon={KeyRound}>Reset password</MenuItem>
              {!u.is_verified && (
                <MenuItem onClick={() => { setMenu(false); onVerify(u); }} icon={BadgeCheck}>Mark verified</MenuItem>
              )}
              {u.is_active ? (
                <MenuItem onClick={() => { setMenu(false); onSuspend(u); }} icon={Pause}>Suspend</MenuItem>
              ) : (
                <MenuItem onClick={() => { setMenu(false); onReactivate(u); }} icon={Play}>Reactivate</MenuItem>
              )}
              {!isSelf && (
                <MenuItem onClick={() => { setMenu(false); onDelete(u); }} icon={Trash2} danger>Delete user</MenuItem>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

function MenuItem({ icon: Icon, children, onClick, danger }) {
  return (
    <button onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-xs font-body flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-white/5
        ${danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 dark:text-slate-200'}`}>
      <Icon className="w-3.5 h-3.5" /> {children}
    </button>
  );
}
