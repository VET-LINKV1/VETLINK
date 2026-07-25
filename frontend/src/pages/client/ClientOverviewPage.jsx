import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { clientService } from '../../services/clientService';
import { PawPrint, Calendar, CheckCircle, Plus, ChevronRight, Clock, AlertCircle, Bell, Syringe } from 'lucide-react';
import StatCard from '../../components/ui/StatCard';
import SectionCard from '../../components/ui/SectionCard';
import Badge from '../../components/ui/Badge';

function ClientOverviewPage() {
  const { user } = useAuth();
  const [data, setData] = useState({ pets:[], appointments:[], stats:{ totalPets:0, upcomingAppointments:0, completedVisits:0 } });
  const [reminderSummary, setReminderSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const firstName = user?.name?.split(' ')[0] || 'there';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [d, r] = await Promise.all([
          clientService.getDashboard(),
          import('../../services/reminderService').then(m => m.reminderService.getSummary()).catch(() => null),
        ]);
        if (!cancelled) {
          setData(d);
          if (r) setReminderSummary(r);
        }
      } catch (err) {
        console.warn('[Overview]', err.message);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex gap-1.5">
        {[0,1,2].map(i => <div key={i} className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-bounce" style={{animationDelay:`${i*0.15}s`}} />)}
      </div>
    </div>
  );

  const { stats, pets, appointments } = data;
  const upcoming = appointments.filter(a => a.status === 'pending' || a.status === 'confirmed');

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-500 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="relative z-10">
          <p className="text-blue-200 text-sm font-body mb-1">
            {new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}
          </p>
          <h1 className="font-display text-2xl md:text-3xl font-700 mb-2">Hello, {firstName}! 👋</h1>
          <p className="text-white/70 font-body text-sm">
            {pets.length === 0 ? 'Welcome! Add your first pet to get started.'
              : `${pets.length} pet${pets.length>1?'s':''} registered · ${stats.upcomingAppointments} upcoming appointment${stats.upcomingAppointments!==1?'s':''}`}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={PawPrint}    label="My Pets"               value={stats.totalPets}            color="blue" />
        <StatCard icon={Calendar}    label="Upcoming Appointments" value={stats.upcomingAppointments} color="amber" />
        <StatCard icon={CheckCircle} label="Completed Visits"      value={stats.completedVisits}      color="teal" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pets */}
        <SectionCard title="My Pets" subtitle={`${pets.length} registered`}
          action={<Link to="/client/pets" className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-body font-600 transition-colors">View all <ChevronRight className="w-3.5 h-3.5" /></Link>}>
          {pets.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3"><PawPrint className="w-7 h-7 text-slate-300 dark:text-slate-600 dark:text-slate-600" /></div>
              <p className="font-display text-slate-500 dark:text-slate-400 dark:text-slate-500 font-600 text-sm mb-4">No pets yet</p>
              <Link to="/client/pets" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-body font-600 hover:bg-blue-700 shadow-md shadow-blue-500/25 transition-colors">
                <Plus className="w-4 h-4" /> Add Pet
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {pets.slice(0,4).map(pet => (
                <div key={pet.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/10 dark:border-white/10">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0"><PawPrint className="w-5 h-5 text-blue-500" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-slate-800 dark:text-white text-sm font-600">{pet.name}</p>
                    <p className="text-slate-400 dark:text-slate-500 text-xs font-body">{pet.species}{pet.breed?` · ${pet.breed}`:''}{pet.age?` · ${pet.age}y`:''}</p>
                  </div>
                  <span className="text-xs font-body px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 dark:text-slate-500 capitalize">{pet.gender}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Appointments */}
        <SectionCard title="Upcoming Appointments" subtitle={`${upcoming.length} scheduled`}
          action={<Link to="/client/appointments" className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-body font-600 transition-colors">View all <ChevronRight className="w-3.5 h-3.5" /></Link>}>
          {upcoming.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3"><Calendar className="w-7 h-7 text-slate-300 dark:text-slate-600 dark:text-slate-600" /></div>
              <p className="font-display text-slate-500 dark:text-slate-400 dark:text-slate-500 font-600 text-sm mb-4">No upcoming appointments</p>
              <Link to="/client/appointments" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-body font-600 hover:bg-blue-700 shadow-md shadow-blue-500/25 transition-colors">
                <Plus className="w-4 h-4" /> Book Appointment
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.slice(0,4).map(appt => (
                <div key={appt.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/10 dark:border-white/10">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0"><Clock className="w-5 h-5 text-amber-500" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-slate-800 dark:text-white text-sm font-600">{appt.pets?.name || 'Pet'}</p>
                    <p className="text-slate-400 dark:text-slate-500 text-xs font-body">{appt.type}</p>
                  </div>
                  <Badge label={appt.status} variant={appt.status} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Reminders */}
      <SectionCard title="Reminders & Notifications" subtitle="Stay on top of your pets' health"
        action={<Link to="/client/reminders" className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-body font-600 transition-colors">View all <ChevronRight className="w-3.5 h-3.5" /></Link>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link to="/client/reminders" className="flex items-center gap-3 p-4 rounded-xl border border-blue-100 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-200 transition-colors group">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-100 group-hover:bg-blue-200 transition-colors">
              <Syringe className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-body text-slate-700 text-sm font-600 group-hover:text-blue-700 transition-colors">
                Vaccination & Deworming
                {reminderSummary && (
                  <span className="ml-2 text-xs font-700 bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-lg">
                    {reminderSummary.upcoming} upcoming
                  </span>
                )}
                {reminderSummary?.overdue > 0 && (
                  <span className="ml-1 text-xs font-700 bg-red-100 text-red-600 px-1.5 py-0.5 rounded-lg">
                    {reminderSummary.overdue} overdue
                  </span>
                )}
              </p>
              <p className="font-body text-slate-400 text-xs mt-0.5">Upcoming shots and deworming schedule</p>
            </div>
          </Link>

          <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-50">
              <Bell className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="font-body text-slate-700 dark:text-slate-200 text-sm font-600">Appointment reminders</p>
              <p className="font-body text-slate-400 dark:text-slate-500 text-xs mt-0.5">SMS and email notifications</p>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
export default ClientOverviewPage;
