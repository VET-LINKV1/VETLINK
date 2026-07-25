import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, PawPrint, AlertCircle, CheckCircle } from 'lucide-react';
import StatCard from '../ui/StatCard';
import SectionCard from '../ui/SectionCard';
import Badge from '../ui/Badge';
import { appointmentService } from '../../services/appointmentService';
import { scheduleService } from '../../services/scheduleService';

// Returns today's date in the user's local timezone as YYYY-MM-DD.
// (Using toISOString() returns UTC, which causes the dashboard to query
// "yesterday" between midnight and ~8am local time in UTC+8 zones.)
function localDateYMD(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function StaffDashboard({ user }) {
  const [todays, setTodays]   = useState([]);
  const [vets, setVets]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const today = localDateYMD();

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      appointmentService.getAll({ date: today }),
      scheduleService.getAllVets(),
    ])
      .then(([tRes, vRes]) => {
        if (cancelled) return;
        setTodays(tRes.status === 'fulfilled' ? (tRes.value || []) : []);
        setVets(vRes.status === 'fulfilled' ? (vRes.value || []) : []);
        const errs = [tRes, vRes].filter(r => r.status === 'rejected');
        if (errs.length) {
          const r = errs[0].reason;
          const status = r?.response?.status;
          const msg = r?.response?.data?.error
            || (status === 401 ? 'Your session expired — please sign in again.' : null)
            || (status === 403 ? 'You do not have permission to load some of this data.' : null)
            || r?.message
            || 'Some data could not be loaded.';
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

  const pending   = todays.filter(a => a.status === 'pending').length;
  const confirmed = todays.filter(a => a.status === 'confirmed').length;
  const completed = todays.filter(a => a.status === 'completed').length;
  const dow = new Date().getDay();
  const onCallToday = vets.filter(v =>
    (v.vet_schedules || []).some(s => s.day_of_week === dow && s.is_active)
  );

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-teal-700 to-teal-500 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.15) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.15) 1px,transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-3 py-1 mb-3">
              <Clock className="w-3 h-3 text-white/80" />
              <span className="text-white/90 text-xs font-body font-500">Reception Desk</span>
            </div>
            <h2 className="font-display text-2xl font-700 mb-1">Today's Bookings</h2>
            <p className="text-white/70 font-body text-sm">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-white/10 border border-white/20 items-center justify-center">
            <Calendar className="w-7 h-7 text-white/80" />
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
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard icon={Calendar}    label="Today's Bookings" value={todays.length}    color="teal"  sublabel={`${onCallToday.length} vets on duty`} />
        <StatCard icon={Clock}       label="Pending"          value={pending}          color="amber" sublabel="Awaiting confirmation" />
        <StatCard icon={CheckCircle} label="Confirmed"        value={confirmed}        color="blue"  sublabel="Ready to receive" />
        <StatCard icon={PawPrint}    label="Completed"        value={completed}        color="sky"   sublabel="Today's visits done" />
      </div>

      {/* Today's appointments — REAL */}
      <SectionCard title="Today's Appointments" subtitle={`${todays.length} across all vets`}
        action={<Link to="/appointments" className="text-xs text-blue-500 hover:text-blue-700 font-body font-600">View all</Link>}>
        {sortedToday.length === 0 ? (
          <div className="text-center py-10">
            <Calendar className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500 text-sm font-body">No appointments today</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
            {sortedToday.map(appt => {
              const t    = appt.appointment_at ? new Date(appt.appointment_at) : null;
              const time = t ? t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—';
              const urgent = appt.urgency === 'urgent' || appt.urgency === 'emergency';
              const reasonText = appt.reason_code
                ? appt.reason_code.replace(/_/g, ' ')
                : appt.type;
              return (
                <div key={appt.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border
                    ${urgent
                      ? 'bg-red-50 border-red-200'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-white/10'}`}>
                  <div className="text-center w-14 shrink-0">
                    <p className={`font-mono text-xs font-600 ${urgent ? 'text-red-600' : 'text-slate-600 dark:text-slate-300'}`}>
                      {time}
                    </p>
                  </div>
                  <div className="w-px h-8 bg-slate-200 dark:bg-white/10 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-display text-slate-800 dark:text-white text-sm font-600 truncate">{appt.pets?.name || 'Pet'}</p>
                      <span className="text-slate-300 dark:text-slate-600 text-xs">·</span>
                      <p className="font-body text-slate-500 dark:text-slate-400 text-xs truncate">{appt.client?.name || 'Owner'}</p>
                      {urgent && (
                        <span className="text-[10px] font-700 uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-red-600 text-white">
                          {appt.urgency}
                        </span>
                      )}
                    </div>
                    <p className="font-body text-slate-400 dark:text-slate-500 text-xs truncate capitalize">
                      {reasonText || 'visit'}
                      {appt.vet?.name ? ` · ${appt.vet.name}` : ''}
                    </p>
                  </div>
                  <Badge label={appt.status} variant={appt.status} />
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* On-call today — REAL from vet_schedules */}
      <SectionCard title="On-Call Today" subtitle={`${onCallToday.length} vet${onCallToday.length === 1 ? '' : 's'} working`}>
        {onCallToday.length === 0 ? (
          <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-sm font-body">No vets scheduled for today</div>
        ) : (
          <div className="space-y-2">
            {onCallToday.map(vet => {
              const todayHrs = (vet.vet_schedules || []).find(s => s.day_of_week === dow && s.is_active);
              const initials = vet.name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() || '?';
              return (
                <div key={vet.id} className="flex items-center justify-between p-3.5 rounded-xl bg-blue-50 border border-blue-100">
                  <div className="flex items-center gap-3">
                    {vet.avatar_url
                      ? <img src={vet.avatar_url} alt={vet.name} className="w-10 h-10 rounded-xl object-cover" />
                      : <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-display font-700 text-sm">{initials}</div>}
                    <div>
                      <p className="font-display text-slate-800 dark:text-white text-sm font-600">{vet.name}</p>
                      <p className="font-body text-slate-400 dark:text-slate-500 text-xs">
                        {vet.staff_profiles?.[0]?.specialization || 'Veterinarian'}
                        {todayHrs ? ` · ${todayHrs.start_time?.slice(0,5)}–${todayHrs.end_time?.slice(0,5)}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse block" />
                    <span className="text-blue-600 text-xs font-body font-500">Available</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
export default StaffDashboard;
