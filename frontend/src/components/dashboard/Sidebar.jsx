import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  LayoutDashboard, Calendar, Users, PawPrint,
  FileText, Settings, X, ChevronRight, LogOut, Activity, Zap, Sparkles, Wand2, Stethoscope, Shield, ClipboardList, Pill, MessageCircle, Video,
} from 'lucide-react';

const NAV_ITEMS = {
  admin: [
    { icon: LayoutDashboard, label: 'Overview',       to: '/dashboard' },
    { icon: Calendar,        label: 'Appointments',   to: '/appointments' },
    { icon: PawPrint,        label: 'Pet Profiles',   to: '/pets' },
    { icon: FileText,        label: 'Medical Records',to: '/medical-records' },
    { icon: Stethoscope,     label: 'EMR',            to: '/emr' },
    { icon: ClipboardList,   label: 'Pre-visit Review',to: '/vet/intake-review' },
    { icon: Pill,            label: 'Pharmacy',       to: '/pharmacy' },
    { icon: Shield,          label: 'Health Passport',to: '/passport' },
    { icon: MessageCircle,   label: 'Communications', to: '/communications' },
    { icon: Activity,        label: 'Health Check',   to: '/health-check' },
    { icon: Zap,             label: 'Root Cause',     to: '/diagnostic-analytics' },
    { icon: Sparkles,        label: 'Predictive',     to: '/predictive-analytics' },
    { icon: Wand2,           label: 'Action Plan',    to: '/prescriptive-analytics' },
    { icon: Users,           label: 'User Management',to: '/admin/users' },
    { icon: Settings,        label: 'Settings',       to: '/settings',      soon: true },
  ],
  veterinarian: [
    { icon: LayoutDashboard, label: 'Dashboard',      to: '/dashboard' },
    { icon: Calendar,        label: 'My Schedule',    to: '/schedule' },
    { icon: Calendar,        label: 'Appointments',   to: '/appointments' },
    { icon: PawPrint,        label: 'Pet Profiles',   to: '/pets' },
    { icon: FileText,        label: 'Medical Records',to: '/medical-records' },
    { icon: Stethoscope,     label: 'EMR',            to: '/emr' },
    { icon: ClipboardList,   label: 'Pre-visit Review',to: '/vet/intake-review' },
    { icon: Shield,          label: 'Health Passport',to: '/passport' },
    { icon: MessageCircle,   label: 'Communications', to: '/communications' },
    { icon: Activity,        label: 'Health Check',   to: '/health-check' },
  ],
  staff: [
    { icon: LayoutDashboard, label: 'Dashboard',      to: '/dashboard' },
    { icon: Calendar,        label: 'Appointments',   to: '/appointments' },
    { icon: PawPrint,        label: 'Pet Profiles',   to: '/pets' },
    { icon: FileText,        label: 'Medical Records',to: '/medical-records' },
    { icon: Stethoscope,     label: 'EMR',            to: '/emr' },
    { icon: ClipboardList,   label: 'Pre-visit Review',to: '/vet/intake-review' },
    { icon: Shield,          label: 'Health Passport',to: '/passport' },
    { icon: MessageCircle,   label: 'Communications', to: '/communications' },
    { icon: Activity,        label: 'Health Check',   to: '/health-check' },
  ],
};

function Sidebar({ open, onClose }) {
  const { role, logout } = useAuth();
  const navItems = NAV_ITEMS[role] || NAV_ITEMS.staff;

  return (
    <aside className={`
      fixed inset-y-0 left-0 z-30
      flex flex-col w-60 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-white/10
      shadow-xl
      transition-transform duration-300 ease-in-out
      ${open ? 'translate-x-0' : '-translate-x-full'}
    `}>
      <div className="flex items-center justify-between px-4 h-16 border-b border-slate-100 dark:border-white/10 shrink-0">
        <div className="flex items-center gap-2.5">
          <img src="/PHVC_Logo.png" alt="PHVC"
            className="w-8 h-8 rounded-lg object-cover border border-blue-100 dark:border-white/10" />
          <div>
            <p className="font-display text-slate-800 dark:text-white font-700 text-sm leading-tight">PHVC</p>
            <p className="text-slate-400 dark:text-slate-500 text-xs font-body leading-tight">Vet Clinic</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 scrollbar-thin">
        <p className="px-2 mb-2 text-xs font-body font-600 text-slate-400 dark:text-slate-500 uppercase tracking-wider">Menu</p>
        <ul className="space-y-0.5">
          {navItems.map(({ icon: Icon, label, to, soon }) => (
            <li key={label + to}>
              {soon ? (
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-400 dark:text-slate-600 cursor-not-allowed">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="font-body text-sm flex-1">{label}</span>
                  <span className="text-xs bg-slate-100 dark:bg-white/10 text-slate-400 dark:text-slate-500 px-1.5 py-0.5 rounded-md font-600">Soon</span>
                </div>
              ) : (
                <NavLink to={to} end onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-150 text-sm
                    ${isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-white'}`
                  }>
                  {({ isActive }) => (
                    <>
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="font-body font-medium flex-1">{label}</span>
                      {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
                    </>
                  )}
                </NavLink>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="px-2 py-3 border-t border-slate-100 dark:border-white/10">
        <button onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-sm">
          <LogOut className="w-4 h-4 shrink-0" />
          <span className="font-body font-medium">Sign Out</span>
        </button>
        <p className="text-center text-xs text-slate-300 dark:text-slate-600 font-body mt-2">PHVC v1.0.0</p>
      </div>
    </aside>
  );
}
export default Sidebar;
