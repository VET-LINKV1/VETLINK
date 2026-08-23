/**
 * SettingsPage.jsx
 * Centralized admin configuration module.
 * Two-column layout: left navigation menu, right panel content.
 * Responsive (collapses to accordion on mobile), accessible (ARIA roles,
 * keyboard nav), visually consistent with the VETLINK Admin Portal.
 */
import { useState } from 'react';
import {
  Building2, User, ShieldCheck, Calendar, PawPrint, Pill, Microscope,
  DollarSign, Bell, DoorOpen, ShieldAlert, SlidersHorizontal, ScrollText,
  Menu, X, ChevronDown, Save, CheckCircle2,
} from 'lucide-react';
import ClinicSettings from '../../components/settings/ClinicSettings';
import ProfileSettings from '../../components/settings/ProfileSettings';
import RolesSettings from '../../components/settings/RolesSettings';
import AppointmentSettings from '../../components/settings/AppointmentSettings';
import PetSettings from '../../components/settings/PetSettings';
import PrescriptionSettings from '../../components/settings/PrescriptionSettings';
import LaboratorySettings from '../../components/settings/LaboratorySettings';
import BillingSettings from '../../components/settings/BillingSettings';
import NotificationSettings from '../../components/settings/NotificationSettings';
import BranchSettings from '../../components/settings/BranchSettings';
import SecuritySettings from '../../components/settings/SecuritySettings';
import SystemSettings from '../../components/settings/SystemSettings';
import AuditLogs from '../../components/settings/AuditLogs';

const SECTIONS = [
  { key: 'clinic',        label: 'Clinic Settings',        icon: Building2,      component: ClinicSettings,     group: 'General' },
  { key: 'profile',       label: 'My Profile',            icon: User,           component: ProfileSettings,    group: 'General' },
  { key: 'roles',         label: 'Roles & Permissions',   icon: ShieldCheck,    component: RolesSettings,      group: 'General' },
  { key: 'appointments',  label: 'Appointment Settings',  icon: Calendar,       component: AppointmentSettings,group: 'Operations' },
  { key: 'pets',          label: 'Pet & Medical Settings',icon: PawPrint,       component: PetSettings,        group: 'Operations' },
  { key: 'prescriptions', label: 'Prescription Settings', icon: Pill,           component: PrescriptionSettings,group:'Operations' },
  { key: 'laboratory',    label: 'Laboratory Settings',   icon: Microscope,     component: LaboratorySettings, group: 'Operations' },
  { key: 'billing',       label: 'Billing & Payment',    icon: DollarSign,     component: BillingSettings,    group: 'Operations' },
  { key: 'notifications', label: 'Notification Settings', icon: Bell,           component: NotificationSettings,group:'Operations' },
  { key: 'branches',      label: 'Branch & Room Settings',icon: DoorOpen,       component: BranchSettings,     group: 'Operations' },
  { key: 'security',      label: 'Security Settings',     icon: ShieldAlert,    component: SecuritySettings,   group: 'Administration' },
  { key: 'system',        label: 'System Preferences',    icon: SlidersHorizontal,component: SystemSettings,   group: 'Administration' },
  { key: 'audit',         label: 'Audit Logs',           icon: ScrollText,      component: AuditLogs,          group: 'Administration' },
];

const GROUP_ORDER = ['General', 'Operations', 'Administration'];

export default function SettingsPage() {
  const [active, setActive] = useState('clinic');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeSection = SECTIONS.find(s => s.key === active) || SECTIONS[0];
  const ActiveComponent = activeSection.component;

  const handleNav = (key) => {
    setActive(key);
    setMobileMenuOpen(false);
  };

  const grouped = GROUP_ORDER.map(group => ({
    group,
    items: SECTIONS.filter(s => s.group === group),
  })).filter(g => g.items.length > 0);

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center shadow shadow-blue-500/30">
            <SlidersHorizontal className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display font-700 text-xl text-slate-800 dark:text-white">Settings</h1>
            <p className="text-xs font-body text-slate-400">Manage clinic configuration, users, and system behavior.</p>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(o => !o)}
          className="lg:hidden px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-sm font-body font-600 flex items-center gap-2"
          aria-expanded={mobileMenuOpen}
          aria-controls="settings-nav"
        >
          <Menu className="w-4 h-4" />
          {activeSection.label}
          <ChevronDown className={`w-4 h-4 transition-transform ${mobileMenuOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">

        {/* Left navigation menu */}
        <aside
          id="settings-nav"
          className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm p-3
            ${mobileMenuOpen ? 'block' : 'hidden'} lg:block`}
          aria-label="Settings sections"
        >
          <nav className="space-y-4">
            {grouped.map(({ group, items }) => (
              <div key={group}>
                <p className="px-3 mb-1.5 text-xs font-body font-600 text-slate-400 dark:text-slate-500 uppercase tracking-wider">{group}</p>
                <ul className="space-y-0.5">
                  {items.map(({ key, label, icon: Icon }) => (
                    <li key={key}>
                      <button
                        onClick={() => handleNav(key)}
                        aria-current={active === key ? 'page' : undefined}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-body font-medium transition-all duration-150
                          ${active === key
                            ? 'bg-blue-600 text-white shadow shadow-blue-500/20'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-white'}`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="flex-1 text-left">{label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Right configuration panel */}
        <main className="min-w-0">
          <div className="flex items-center gap-2 mb-4">
            <activeSection.icon className="w-5 h-5 text-blue-600" />
            <h2 className="font-display font-700 text-lg text-slate-800 dark:text-white">{activeSection.label}</h2>
          </div>
          <ActiveComponent />
        </main>

      </div>
    </div>
  );
}