import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, PawPrint, CheckCircle, Clock, FileText, AlertCircle } from 'lucide-react';
import StatCard from '../ui/StatCard';
import SectionCard from '../ui/SectionCard';
import Badge from '../ui/Badge';
import { appointmentService } from '../../services/appointmentService';
import { medicalRecordService } from '../../services/medicalRecordService';

function VetDashboard({ user }) {
  const [todays, setTodays]       = useState([]);
  const [allMine, setAllMine]     = useState([]);
  const [recordsCount, setRC]     = useState(0);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    let cancelled = false;
    // allSettled so one missing/broken endpoint (e.g. medical_records table not yet
    // created in Supabase) doesn't blank out the rest of the dashboard.
    Promise.allSettled([
      appointmentService.getAll({ date: today }),
      appointmentService.getAll(),
      medicalRecordService.getMyRecords(),
    ])
      .then(([tRes, allRes, mrRes]) => {
        if (cancelled) return;
        setTodays(tRes.status === 'fulfilled' ? (tRes.value || []) : []);
        setAllMine(allRes.status === 'fulfilled' ? (allRes.value || []) : []);
        setRC(mrRes.status === 'fulfilled' ? ((mrRes.value || []).length) : 0);

        // Surface the first error (if any) as a soft banner — page still renders
        const firstErr = [tRes, allRes, mrRes].find(r => r.status === 'rejected');
        if (firstErr) {
          const msg = firstErr.reason?.response?.data?.error || firstErr.reason?.message || 'Some data could not be loaded.';
          setError(msg);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [today]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex gap-1.5">
        {[0,1,2].map(i => <div key={i} className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-bounce" style={{animationDelay:`${i*0.15}s`}} />)}
      </div>
    </div>
  );

  const sortedToday = [...todays].sort((a, b) =>
    new Date(a.appointment_at).getTime() - new Date(b.appointment_at).getTime()
  );
  const completedToday = todays.filter(a => a.status === 'completed').length;
  const pendingToday   = todays.filter(a => a.status === 'pending').length;
  const uniquePets     = new Set(allMine.map(a => a.pet_id)).size;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-blue-700 to-sky-500 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.15) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.15) 1px,transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-3 py-1 mb-3">
              <Clock className="w-3 h-3 text-white/80" />
              <span className="text-white/90 text-xs font-body font-500">Today's Schedule</span>
            </div>
            <h2 className="font-display text-2xl font-700 mb-1">Good day, {user?.name?.split(' ')[0]}</h2>
            <p className="text-white/70 font-body text-sm">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-white/10 border border-white/20 items-center justify-center">
            <PawPrint className="w-7 h-7 text-white/80" />
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-red-600 font-body text-sm">{error}</p>
        </div>
      )}

      {/* Stats — real */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard icon={Calendar}    label="Today's Appointments" value={todays.length}        color="blue"
          sublabel={`${pendingToday} pending`} />
        <StatCard icon={CheckCircle} label="Completed Today"      value={completedToday}       color="teal"
          sublabel={todays.length === 0 ? 'No appointments today' : `of ${todays.length}`} />
        <StatCard icon={PawPrint}    label="Unique Patients"      value={uniquePets}           color="sky"
          sublabel="Pets you've treated" />
        <StatCard icon={FileText}    label="Medical Records"      value={recordsCount}         color="violet"
          sublabel="You've authored" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's schedule — REAL */}
        <SectionCard title="Today's Appointments" subtitle={`${todays.length} scheduled today`}
          action={<Link to="/appointments" className="text-xs text-blue-500 hover:text-blue-700 font-body font-600">View all</Link>}>
          {sortedToday.length === 0 ? (
            <div className="text-center py-10">
              <Calendar className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500 text-sm font-body">No appointments today</p>
              <p className="text-slate-400 dark:text-slate-500 text-xs font-body mt-1">Enjoy your day off</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin">
              {sortedToday.map(appt => {
                const t = new Date(appt.appointment_at);
                const time = t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={appt.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/10 dark:border-white/10">
                    <div className="text-center w-20 shrink-0">
                      <p className="font-mono text-xs font-600 text-blue-600">{time}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-slate-800 dark:text-white text-sm font-600 truncate">
                        {appt.pets?.name || 'Pet'}
                        {appt.pets?.breed && <span className="text-slate-400 dark:text-slate-500 font-body font-400 text-xs ml-1.5">· {appt.pets.breed}</span>}
                      </p>
                      <p className="font-body text-slate-400 dark:text-slate-500 text-xs truncate">{appt.client?.name || 'Owner'} · {appt.type}</p>
                    </div>
                    <Badge label={appt.status} variant={appt.status} />
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Quick actions — REAL nav */}
        <SectionCard title="Quick Actions" subtitle="Jump to what you need">
          <div className="grid grid-cols-2 gap-3">
            {[
              { Icon: Calendar,    label: "Today's Schedule", desc: `${todays.length} appointments`, to: '/appointments' },
              { Icon: FileText,    label: 'Medical Records',   desc: `${recordsCount} authored`,     to: '/medical-records' },
              { Icon: PawPrint,    label: 'My Patients',       desc: `${uniquePets} unique pets`,    to: '/pets' },
              { Icon: Clock,       label: 'My Schedule',       desc: 'Manage availability',          to: '/schedule' },
            ].map(({ Icon, label, desc, to }) => (
              <Link key={label} to={to}
                className="flex flex-col gap-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/10 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                <Icon className="w-4 h-4 text-blue-500" />
                <p className="font-display text-slate-700 dark:text-slate-200 text-xs font-600 mt-1">{label}</p>
                <p className="font-body text-slate-400 dark:text-slate-500 text-xs">{desc}</p>
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
export default VetDashboard;
