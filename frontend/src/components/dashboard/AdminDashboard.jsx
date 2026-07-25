import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Calendar, PawPrint, Activity, AlertCircle, CheckCircle, Clock, ShieldCheck, Stethoscope } from 'lucide-react';
import StatCard from '../ui/StatCard';
import SectionCard from '../ui/SectionCard';
import { adminService } from '../../services/adminService';

const ROLE_BADGE = {
  admin:        { label: 'Administrator', color: 'bg-violet-100 text-violet-700', Icon: ShieldCheck },
  veterinarian: { label: 'Veterinarian',  color: 'bg-blue-100 text-blue-700',     Icon: Stethoscope },
  staff:        { label: 'Clinical Staff',color: 'bg-teal-100 text-teal-700',     Icon: Users },
};

function AdminDashboard({ user }) {
  const [stats, setStats] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([adminService.getStats(), adminService.getStaff()])
      .then(([sRes, stRes]) => {
        if (cancelled) return;
        if (sRes.status === 'fulfilled') setStats(sRes.value);
        if (stRes.status === 'fulfilled') setStaff(stRes.value);
        const firstErr = [sRes, stRes].find(r => r.status === 'rejected');
        if (firstErr) {
          const msg = firstErr.reason?.response?.data?.error || firstErr.reason?.message || 'Some admin data could not be loaded.';
          setError(msg);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex gap-1.5">
        {[0,1,2].map(i => <div key={i} className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-bounce" style={{animationDelay:`${i*0.15}s`}} />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-500 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.15) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.15) 1px,transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-3 py-1 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse block" />
              <span className="text-white/90 text-xs font-body font-500">System Active</span>
            </div>
            <h2 className="font-display text-2xl font-700 mb-1">System Overview</h2>
            <p className="text-white/70 font-body text-sm">Welcome back, {user?.name?.split(' ')[0]} — full administrative access</p>
          </div>
          <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-white/10 border border-white/20 items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-white/80" />
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-red-600 font-body text-sm">{error}</p>
        </div>
      )}

      {/* Real stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Calendar} label="Total Appointments" value={stats?.totals?.appointments ?? 0} color="blue"
          sublabel={`${stats?.appointmentsByStatus?.pending ?? 0} pending · ${stats?.appointmentsByStatus?.confirmed ?? 0} confirmed`} />
        <StatCard icon={PawPrint} label="Registered Pets"    value={stats?.totals?.pets ?? 0}         color="violet"
          sublabel={`${stats?.totals?.clients ?? 0} pet owners`} />
        <StatCard icon={Users}    label="Active Staff"       value={stats?.totals?.staff ?? 0}        color="teal"
          sublabel="Admin · Vet · Staff" />
        <StatCard icon={CheckCircle} label="Completed Visits" value={stats?.appointmentsByStatus?.completed ?? 0} color="sky"
          sublabel={`${stats?.appointmentsByStatus?.cancelled ?? 0} cancelled`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status breakdown */}
        <SectionCard title="Appointments by Status" subtitle="Live database snapshot">
          <div className="space-y-2.5">
            {[
              { key:'pending',   label:'Pending',   color:'bg-amber-50 border-amber-200 text-amber-700', dot:'bg-amber-400' },
              { key:'confirmed', label:'Confirmed', color:'bg-blue-50 border-blue-200 text-blue-700',     dot:'bg-blue-400' },
              { key:'completed', label:'Completed', color:'bg-teal-50 border-teal-200 text-teal-700',     dot:'bg-teal-400' },
              { key:'cancelled', label:'Cancelled', color:'bg-red-50 border-red-200 text-red-700',         dot:'bg-red-400' },
            ].map(({ key, label, color, dot }) => {
              const count = stats?.appointmentsByStatus?.[key] ?? 0;
              const total = stats?.totals?.appointments || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={key} className={`flex items-center justify-between p-3 rounded-xl border ${color}`}>
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2 h-2 rounded-full ${dot}`} />
                    <span className="font-body text-sm font-600">{label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-base font-700">{count}</span>
                    <span className="font-body text-xs opacity-60">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* Staff accounts */}
        <SectionCard title="Staff Accounts" subtitle={`${staff.length} active`}>
          {staff.length === 0 ? (
            <div className="text-center py-10">
              <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500 text-sm font-body">No staff accounts yet</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
              {staff.map(u => {
                const cfg = ROLE_BADGE[u.role] || { label: u.role, color: 'bg-slate-100 text-slate-700', Icon: Users };
                const initials = u.name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() || '?';
                return (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/10 dark:border-white/10">
                    <div className="flex items-center gap-3 min-w-0">
                      {u.avatar_url
                        ? <img src={u.avatar_url} alt={u.name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                        : <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-display font-700 text-xs shrink-0">{initials}</div>}
                      <div className="min-w-0">
                        <p className="font-body text-slate-700 dark:text-slate-200 text-sm font-500 truncate">{u.name}</p>
                        <p className="font-body text-slate-400 dark:text-slate-500 text-xs truncate">{u.email}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-body font-600 px-2.5 py-1 rounded-lg ${cfg.color} shrink-0`}>{cfg.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Quick links */}
      <SectionCard title="Quick Links" subtitle="Manage the clinic">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { Icon: Calendar,    label: 'Appointments', to: '/appointments' },
            { Icon: PawPrint,    label: 'Pet Profiles', to: '/pets' },
            { Icon: Activity,    label: 'My Profile',   to: '/profile' },
            { Icon: AlertCircle, label: 'Records',      to: '/medical-records' },
          ].map(({ Icon, label, to }) => (
            <Link key={label} to={to}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/10 hover:bg-blue-50 hover:border-blue-200 transition-colors">
              <Icon className="w-5 h-5 text-blue-500" />
              <span className="font-body text-slate-700 dark:text-slate-200 text-xs font-600">{label}</span>
            </Link>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
export default AdminDashboard;
