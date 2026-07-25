/**
 * NotificationBell.jsx
 * Topbar notification panel — real API, mark read, unread badge.
 */
import { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import { notificationService } from '../../services/appointmentService';

const TYPE_STYLES = {
  success: 'bg-blue-50 border-l-4 border-blue-400',
  info:    'bg-slate-50 border-l-4 border-slate-300',
  warning: 'bg-amber-50 border-l-4 border-amber-400',
  reminder:'bg-violet-50 border-l-4 border-violet-400',
};

export default function NotificationBell() {
  const [open, setOpen]           = useState(false);
  const [notifications, setNots]  = useState([]);
  const [unread, setUnread]       = useState(0);
  const [loading, setLoading]     = useState(false);
  const panelRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const { notifications: n, unread: u } = await notificationService.getAll();
      setNots(n);
      setUnread(u);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000); // poll every 60s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleMarkRead = async (id) => {
    await notificationService.markRead(id);
    setNots(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnread(prev => Math.max(0, prev - 1));
  };

  const handleMarkAll = async () => {
    await notificationService.markAllRead();
    setNots(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnread(0);
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="relative" ref={panelRef}>
      <button onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors">
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] rounded-full bg-blue-600 text-white text-xs font-body font-700 flex items-center justify-center px-1">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-slate-800 text-sm font-700">Notifications</h3>
              {unread > 0 && (
                <span className="bg-blue-100 text-blue-700 text-xs font-body font-600 px-2 py-0.5 rounded-full">
                  {unread} new
                </span>
              )}
            </div>
            {unread > 0 && (
              <button onClick={handleMarkAll}
                className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-body transition-colors">
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="py-8 text-center text-slate-300 text-sm font-body">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-slate-400 text-sm font-body">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id}
                  className={`px-4 py-3 transition-colors cursor-default ${n.is_read ? 'bg-white' : TYPE_STYLES[n.type] || TYPE_STYLES.info}`}
                  onClick={() => !n.is_read && handleMarkRead(n.id)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-body font-600 ${n.is_read ? 'text-slate-600' : 'text-slate-800'}`}>
                        {n.title}
                      </p>
                      <p className="text-xs font-body text-slate-500 mt-0.5 leading-relaxed">{n.message}</p>
                      <p className="text-xs font-body text-slate-300 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
