import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, LogOut, ChevronDown, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import NotificationBell from '../appointments/NotificationBell';
import ThemeSwitch from '../ui/ThemeSwitch';

const ROLE_LABELS = {
  admin: 'Administrator', veterinarian: 'Veterinarian',
  staff: 'Clinical Staff', client: 'Pet Owner',
};

export default function Topbar({ onMenuClick }) {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() || '?';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-white/10 flex items-center justify-between px-4 md:px-6 lg:px-8 shrink-0 relative z-10">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="lg:hidden p-2 rounded-lg text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-display text-slate-800 dark:text-white text-base font-600 leading-tight">
            {greeting}, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-slate-400 dark:text-slate-500 text-xs font-body hidden sm:block">
            {new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <ThemeSwitch />
        <NotificationBell />

        <div className="relative">
          <button onClick={() => setOpen(o => !o)}
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.name} className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-white/10" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-display font-700 text-sm">{initials}</div>
            )}
            <div className="hidden sm:block text-left">
              <p className="font-display text-slate-800 dark:text-white text-sm font-600 leading-tight">{user?.name}</p>
              <p className="text-slate-400 dark:text-slate-500 text-xs font-body">{ROLE_LABELS[role]}</p>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-white/10 z-20 overflow-hidden">
                <div className="flex items-center gap-3 p-3.5 border-b border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                  {user?.avatar_url
                    ? <img src={user.avatar_url} alt={user.name} className="w-9 h-9 rounded-lg object-cover border border-slate-200 dark:border-white/10 shrink-0" />
                    : <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-display font-700 text-sm shrink-0">{initials}</div>}
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-slate-700 dark:text-slate-200 text-sm font-500 truncate">{user?.name}</p>
                    <p className="font-body text-slate-400 dark:text-slate-500 text-xs truncate">{user?.email}</p>
                  </div>
                </div>
                <button onClick={() => { setOpen(false); navigate('/profile'); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 text-sm font-body">
                  <User className="w-4 h-4" /> My Profile
                </button>
                <button onClick={logout}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 text-sm font-body border-t border-slate-100 dark:border-white/10">
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
