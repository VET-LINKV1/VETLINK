/**
 * ConversationList.jsx
 * Inbox-style list of conversations for staff.
 *
 * Props:
 *   items        Array from /api/comms/conversations
 *   selectedId
 *   onSelect(conv)
 *   searchable   default true
 */
import { useMemo, useState } from 'react';
import { Search, User, MessageCircle, Stethoscope } from 'lucide-react';

function fmtRelative(d) {
  if (!d) return '';
  const t = new Date(d).getTime();
  const diff = Date.now() - t;
  if (diff < 60_000)      return 'just now';
  if (diff < 3600_000)    return Math.floor(diff / 60_000) + 'm';
  if (diff < 86400_000)   return Math.floor(diff / 3600_000) + 'h';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
}

export default function ConversationList({ items = [], selectedId, onSelect, searchable = true }) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const t = q.trim().toLowerCase();
    return items.filter(c =>
      c.client_name?.toLowerCase().includes(t) ||
      c.client_email?.toLowerCase().includes(t) ||
      c.assigned_vet_name?.toLowerCase().includes(t) ||
      c.last_message_preview?.toLowerCase().includes(t)
    );
  }, [items, q]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl h-full flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-white/10">
        <p className="text-xs font-body font-600 uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
          <MessageCircle className="w-3.5 h-3.5" /> Inbox
        </p>
        {searchable && (
          <label className="flex items-center gap-2 bg-slate-50 dark:bg-white/5 rounded-lg px-2.5 py-1.5">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search messages…"
              className="flex-1 bg-transparent outline-none text-sm font-body text-slate-700 dark:text-slate-200 placeholder:text-slate-400" />
          </label>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {!filtered.length ? (
          <p className="text-sm text-slate-400 font-body text-center py-8 px-4">No conversations.</p>
        ) : (
          <ul className="divide-y divide-slate-50 dark:divide-white/5">
            {filtered.map((c) => {
              const active = selectedId === c.id;
              const unread = c.unread_for_staff || 0;
              return (
                <li key={c.id}>
                  <button onClick={() => onSelect && onSelect(c)}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors
                      ${active ? 'bg-blue-50 dark:bg-blue-500/10 border-l-2 border-blue-500' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                        {c.client_avatar
                          ? <img src={c.client_avatar} alt={c.client_name} className="w-full h-full rounded-xl object-cover" />
                          : <User className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-body font-600 text-slate-700 dark:text-slate-200 truncate flex-1">
                            {c.client_name || '— client —'}
                          </p>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {fmtRelative(c.last_message_at)}
                          </span>
                        </div>
                        <p className={`text-xs font-body truncate mt-0.5 ${unread > 0 ? 'text-slate-700 dark:text-slate-200 font-600' : 'text-slate-500'}`}>
                          {c.last_message_preview || 'No messages yet.'}
                        </p>
                        {c.assigned_vet_name && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-teal-600 font-body mt-0.5">
                            <Stethoscope className="w-2.5 h-2.5" /> {c.assigned_vet_name}
                          </span>
                        )}
                      </div>
                      {unread > 0 && (
                        <span className="bg-blue-600 text-white text-[10px] font-700 rounded-full min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center shrink-0">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
