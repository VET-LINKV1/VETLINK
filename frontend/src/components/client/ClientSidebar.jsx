import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, PawPrint, BarChart2, Activity, LogOut, X, ChevronRight, User, Shield, Heart, MessageCircle, Video, Syringe } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard',        to: '/client' },
  { icon: Calendar,        label: 'Appointments',     to: '/client/appointments' },
  { icon: PawPrint,        label: 'Pet Records',      to: '/client/pets' },
  { icon: Heart,           label: 'Post-Care & Pharmacy', to: '/client/postcare' },
  { icon: MessageCircle,   label: 'Communications',   to: '/client/communications' },
  { icon: BarChart2,       label: 'Analytics',        to: '/client/analytics' },
  { icon: Activity,        label: 'Health Check',     to: '/client/health-check' },
  { icon: Syringe,         label: 'Reminders',         to: '/client/reminders' },
];

function ClientSidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <aside className={`
      fixed inset-y-0 left-0 z-30
      flex flex-col w-60 bg-white dark:bg-slate-900 border-r border-slate-100
      shadow-xl
      transition-transform duration-300 ease-in-out
      ${open ? 'translate-x-0' : '-translate-x-full'}
    `}>
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-slate-100 dark:border-white/10 shrink-0">
        <div className="flex items-center gap-2.5">
          <img src="/PHVC_Logo.png" alt="PHVC" className="w-8 h-8 rounded-lg object-cover border border-blue-100" />
          <div>
            <p className="font-display text-slate-800 dark:text-white font-700 text-sm leading-tight">PHVC</p>
            <p className="text-slate-400 dark:text-slate-500 text-xs font-body leading-tight">Vet Clinic</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-100 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Profile link */}
      <div className="px-3 py-3 border-b border-slate-100 dark:border-white/10 dark:border-white/10">
        <button
          onClick={() => { onClose(); navigate('/profile'); }}
          className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50 transition-colors group"
        >
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt={user.name}
              className="w-8 h-8 rounded-lg object-cover shrink-0 border border-slate-200 dark:border-white/10 dark:border-white/10" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-display font-700 text-xs shrink-0">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0 text-left">
            <p className="font-display text-slate-800 dark:text-white text-xs font-600 truncate group-hover:text-blue-700 transition-colors">{user?.name}</p>
            <span className="text-xs font-body font-500 px-1.5 py-0.5 rounded-md bg-sky-100 text-sky-700">Pet Owner</span>
          </div>
          <User className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-blue-400 transition-colors shrink-0" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 scrollbar-thin">
        <p className="px-2 mb-2 text-xs font-body font-600 text-slate-400 dark:text-slate-500 uppercase tracking-wider">Menu</p>
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ icon: Icon, label, to }) => (
            <li key={to}>
              <NavLink to={to} end={to === '/client'} onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-150 text-sm
                  ${isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 dark:text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:bg-slate-800/50 hover:text-slate-800'}`
                }>
                {({ isActive }) => (
                  <>
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="font-body font-medium flex-1">{label}</span>
                    {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Logout */}
      <div className="px-2 py-3 border-t border-slate-100 dark:border-white/10 dark:border-white/10">
        <button onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-red-500 hover:bg-red-50 transition-colors text-sm">
          <LogOut className="w-4 h-4 shrink-0" />
          <span className="font-body font-medium">Sign Out</span>
        </button>
        <p className="text-center text-xs text-slate-300 dark:text-slate-600 font-body mt-2">PHVC v1.0.0</p>
      </div>
    </aside>
  );
}
export default ClientSidebar;
