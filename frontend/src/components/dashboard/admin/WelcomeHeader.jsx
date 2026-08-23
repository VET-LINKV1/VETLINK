/**
 * WelcomeHeader.jsx
 * Personalized greeting + live status badge + branch/clinic selector
 * + notification bell + user menu (delegates to Topbar for the menu itself).
 */
import { useState, useEffect } from 'react';
import { Bell, ChevronDown, MapPin, User, ShieldCheck, Sparkles } from 'lucide-react';
import { Card, SectionHeader, Skeleton } from './primitives';
import { BRANCHES, ADMIN } from './mockData';
import NotificationBell from '../../appointments/NotificationBell';
import { useAuth } from '../../../hooks/useAuth';

export default function WelcomeHeader() {
  const { user, role } = useAuth();
  const [branch, setBranch] = useState(BRANCHES[0]);
  const [systemStatus, setSystemStatus] = useState('operational');
  const [time, setTime] = useState(new Date());

  // Update time every minute
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const hour = time.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const displayName = user?.name?.split(' ')[0] || ADMIN.name.split(' ')[0];

  // Pulse the system status occasionally to simulate live health
  useEffect(() => {
    const id = setInterval(() => {
      // Mostly operational; briefly show "active" pulse
      setSystemStatus((s) => (s === 'operational' ? 'active' : 'operational'));
      setTimeout(() => setSystemStatus('operational'), 2000);
    }, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <Card className="relative overflow-hidden">
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.15) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.15) 1px,transparent 1px)',
          backgroundSize: '32px 32px',
        }} />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 sm:p-6">
        {/* Left: greeting + role + branch selector */}
        <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <div className={`w-12 h-12 rounded-2xl ${ADMIN.avatarColor} flex items-center justify-center text-white font-display font-700 text-xl shrink-0`}>
              {ADMIN.initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="font-display text-slate-800 dark:text-white text-[22px] font-700 leading-tight truncate">
                  {greeting}, {displayName}
                </h2>
                {systemStatus === 'active' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-label="System active" />
                )}
              </div>
              <p className="font-body text-slate-500 dark:text-slate-400 text-sm mt-0.5 truncate">
                <span className="font-medium">{ADMIN.role}</span> · {' '}
                <span className="inline-flex items-center gap-1 text-slate-400 dark:text-slate-500">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  {branch.name}
                </span>
              </p>
            </div>
          </div>

          {/* Branch selector */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => setBranch((b) => BRANCHES[(BRANCHES.indexOf(b) + 1) % BRANCHES.length])}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              aria-label="Switch branch"
            >
              <MapPin className="w-4 h-4 text-slate-500" />
              <span className="font-body text-slate-700 dark:text-slate-200 text-sm font-500">{branch.code}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Right: notification + quick actions */}
        <div className="flex items-center gap-2">
          {/* System status indicator */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
            <span className={`w-2 h-2 rounded-full ${
              systemStatus === 'operational' ? 'bg-emerald-400' : 'bg-blue-400 animate-pulse'
            }`} />
            <span className="font-body text-slate-600 dark:text-slate-300 text-xs font-500">System Online</span>
          </div>

          {/* Notification bell (shared component) */}
          <NotificationBell />

          {/* User avatar handled by Topbar; we don't duplicate it here */}
        </div>
      </div>
    </Card>
  );
}