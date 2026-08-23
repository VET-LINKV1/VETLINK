/**
 * ClientOverviewPage.jsx — Pet Owner Dashboard
 *
 * The Pet Owner's command center. Everything is organized around an
 * ACTIVE PET SWITCHER (section 2): the owner picks which pet they're
 * looking at, and the pet-specific sections (health snapshot, weight
 * trend, vaccination status, active medications, latest lab results)
 * reflect that pet. Whole-account sections (next appointment, active
 * reminders, notifications, clinic info) stay at the account level.
 *
 * Sections (per spec):
 *   1.  Dashboard Header
 *   2.  Active Pet Switcher
 *   3.  Quick Actions
 *   4.  Next Appointment (primary dashboard card)
 *   5.  Active Reminders
 *   6.  Pet Health Snapshot
 *   7.  Weight Trend
 *   8.  Vaccination Status
 *   9.  Active Medications
 *   10. Latest Lab Results
 *   11. Clinic Information
 *   12. Notifications
 *   13. Empty States
 *   14. Loading States
 *   15. Error States
 *   16. Responsive Design
 *
 * Data comes from a single enriched GET /client/dashboard call that
 * composes: pets, appointments, per-pet detail (weight series,
 * vaccinations, active prescriptions, lab results), notifications,
 * active reminders, and static clinic info.
 */
import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { clientService } from '../../services/clientService';
import { notificationService } from '../../services/appointmentService';
import SectionCard from '../../components/ui/SectionCard';
import Badge from '../../components/ui/Badge';
import WeightChart from '../../components/passport/WeightChart';
import VaccinationTimeline from '../../components/passport/VaccinationTimeline';
import {
  PawPrint, Calendar, CalendarPlus, Plus, ChevronRight, Clock, AlertCircle,
  Bell, Syringe, Activity, LineChart, Pill, FlaskConical, MapPin,
  Phone, Mail, Clock3, Globe, CheckCircle2, BellRing, Stethoscope,
  ArrowRight, RefreshCw,
} from 'lucide-react';

const SPECIES_EMOJI = {
  Dog: '🐕', Cat: '🐈', Bird: '🐦', Rabbit: '🐇',
  Hamster: '🐹', Fish: '🐠', Reptile: '🦎', Other: '🐾',
};
const SPECIES_TINT = {
  Dog: 'bg-amber-50 text-amber-600',
  Cat: 'bg-violet-50 text-violet-600',
  Bird: 'bg-cyan-50 text-cyan-600',
  Rabbit: 'bg-rose-50 text-rose-600',
  Hamster: 'bg-orange-50 text-orange-600',
  Fish: 'bg-cyan-50 text-cyan-600',
  Reptile: 'bg-teal-50 text-teal-600',
  Other: 'bg-slate-100 text-slate-500',
};

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
function fmtDateTime(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return d; }
}
function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}

/* ───────────────────────── 1. DASHBOARD HEADER ───────────────────────── */
function DashboardHeader({ firstName, petCount, upcomingCount }) {
  return (
    <div className="bg-gradient-to-r from-blue-700 to-blue-500 rounded-2xl p-6 text-white relative overflow-hidden">
      <div className="absolute right-0 top-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
      <div className="relative z-10">
        <p className="text-blue-200 text-sm font-body mb-1">{todayLabel()}</p>
        <h1 className="font-display text-2xl md:text-3xl font-700 mb-2">Hello, {firstName}! 👋</h1>
        <p className="text-white/70 font-body text-sm">
          {petCount === 0
            ? 'Welcome! Add your first pet to get started.'
            : `${petCount} pet${petCount !== 1 ? 's' : ''} registered · ${upcomingCount} upcoming appointment${upcomingCount !== 1 ? 's' : ''}`}
        </p>
      </div>
    </div>
  );
}

/* ─────────────────── 2. ACTIVE PET SWITCHER ─────────────────── */
function ActivePetSwitcher({ pets, activePetId, onSelect }) {
  if (pets.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-body font-600 text-slate-400 uppercase tracking-wider mb-2 px-1">
        Active Pet
      </p>
      <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-2">
        {pets.map(pet => {
          const active = pet.id === activePetId;
          return (
            <button key={pet.id} onClick={() => onSelect(pet.id)}
              className={`shrink-0 w-40 flex flex-col items-center text-center p-4 rounded-2xl border transition-all duration-200
                ${active
                  ? 'bg-white border-blue-300 shadow-md shadow-blue-500/10 ring-2 ring-blue-200'
                  : 'bg-white/70 border-slate-100 hover:border-blue-200 hover:shadow-sm'}`}>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-2 ${SPECIES_TINT[pet.species] || SPECIES_TINT.Other}`}>
                {SPECIES_EMOJI[pet.species] || '🐾'}
              </div>
              <p className={`font-display font-700 text-sm ${active ? 'text-blue-700' : 'text-slate-800'}`}>{pet.name}</p>
              <p className="text-xs font-body text-slate-400 mt-0.5 truncate w-full">
                {pet.species}{pet.age != null ? ` · ${pet.age}y` : ''}
              </p>
              {active && (
                <span className="mt-2 text-[10px] font-body font-600 uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                  Selected
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────── 3. QUICK ACTIONS ───────────────────── */
function QuickActions() {
  const actions = [
    { key: 'book',    label: 'Book Appointment', icon: CalendarPlus, to: '/client/appointments', primary: true },
    { key: 'pets',    label: 'Add / View Pets',  icon: Plus,         to: '/client/pets' },
    { key: 'remind',  label: 'Reminders',         icon: Syringe,      to: '/client/reminders' },
    { key: 'records', label: 'Pet Records',       icon: PawPrint,     to: '/client/pets' },
    { key: 'comms',   label: 'Messages',          icon: Bell,         to: '/client/communications' },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {actions.map(a => {
        const Icon = a.icon;
        return (
          <Link key={a.key} to={a.to}
            className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border text-center transition-all
              ${a.primary
                ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-md shadow-blue-500/20'
                : 'bg-white hover:border-blue-300 hover:shadow-sm border-slate-100 text-slate-700'}`}>
            <Icon className={`w-5 h-5 ${a.primary ? 'text-white' : 'text-blue-500'}`} />
            <span className="font-body font-600 text-xs">{a.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

/* ──────────────── 4. NEXT APPOINTMENT (PRIMARY CARD) ──────────────── */
function NextAppointmentCard({ appointment }) {
  if (!appointment) {
    return (
      <SectionCard title="Next Appointment" subtitle="Upcoming visit">
        <div className="text-center py-8">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Calendar className="w-7 h-7 text-slate-300" />
          </div>
          <p className="font-display text-slate-500 font-600 text-sm mb-4">No upcoming appointments</p>
          <Link to="/client/appointments"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-body font-600 hover:bg-blue-700 shadow-md shadow-blue-500/25 transition-colors">
            <CalendarPlus className="w-4 h-4" /> Book Appointment
          </Link>
        </div>
      </SectionCard>
    );
  }
  const petName = appointment.pets?.name || 'Your pet';
  return (
    <div className="bg-gradient-to-br from-blue-600 to-blue-500 rounded-2xl p-6 text-white shadow-lg shadow-blue-500/20 relative overflow-hidden">
      <div className="absolute right-3 top-3 opacity-15 text-6xl pointer-events-none">📅</div>
      <div className="relative z-10">
        <p className="flex items-center gap-2 text-blue-100 text-xs font-body font-600 uppercase tracking-wider mb-3">
          <Calendar className="w-4 h-4" /> Next Appointment
        </p>
        <p className="font-display text-xl font-700 mb-1">{petName}</p>
        <p className="text-white/85 font-body text-sm mb-4">{appointment.type || 'Visit'}</p>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 border border-white/20 text-sm font-body">
            <Clock className="w-4 h-4" /> {fmtDateTime(appointment.appointment_at)}
          </span>
          <Badge label={appointment.status} variant={appointment.status} />
        </div>
        <Link to="/client/appointments"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-blue-700 text-sm font-body font-600 hover:bg-blue-50 transition-colors">
          View details <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

/* ───────────────────── 5. ACTIVE REMINDERS ───────────────────── */
function ActiveReminders({ summary }) {
  const upcoming = summary?.upcoming || 0;
  const overdue  = summary?.overdue || 0;
  return (
    <SectionCard title="Active Reminders" subtitle="Vaccination & deworming"
      action={<Link to="/client/reminders" className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-body font-600">View all <ChevronRight className="w-3.5 h-3.5" /></Link>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link to="/client/reminders" className="flex items-center gap-3 p-4 rounded-xl border border-blue-100 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-200 transition-colors group">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-100 group-hover:bg-blue-200 transition-colors">
            <Syringe className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="font-body text-slate-700 text-sm font-600 group-hover:text-blue-700 transition-colors flex items-center gap-2">
              Vaccination & Deworming
              {upcoming > 0 && <span className="text-xs font-700 bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-lg">{upcoming} upcoming</span>}
              {overdue > 0 && <span className="text-xs font-700 bg-red-100 text-red-600 px-1.5 py-0.5 rounded-lg">{overdue} overdue</span>}
            </p>
            <p className="font-body text-slate-400 text-xs mt-0.5">Upcoming shots and deworming schedule</p>
          </div>
        </Link>
        <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-50">
            <Bell className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="font-body text-slate-700 text-sm font-600">Appointment reminders</p>
            <p className="font-body text-slate-400 text-xs mt-0.5">SMS and email notifications</p>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

/* ────────────── 6. PET HEALTH SNAPSHOT ────────────── */
function PetHealthSnapshot({ pet }) {
  if (!pet) return null;
  const stats = [
    { label: 'Age',     value: pet.age != null ? `${pet.age} yr${pet.age !== 1 ? 's' : ''}` : '—', icon: Calendar },
    { label: 'Gender',  value: pet.gender ? pet.gender[0].toUpperCase() + pet.gender.slice(1) : '—', icon: Activity },
    { label: 'Breed',   value: pet.breed || '—', icon: PawPrint },
    { label: 'Weight',  value: pet.weight_kg ? `${pet.weight_kg} kg` : '—', icon: LineChart },
  ];
  return (
    <SectionCard title="Pet Health Snapshot" subtitle={pet.name}
      action={<Link to="/client/pets" className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-body font-600">Details <ChevronRight className="w-3.5 h-3.5" /></Link>}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="min-w-0 rounded-2xl bg-slate-50 border border-slate-100 p-4">
              <div className="flex items-center gap-2 text-slate-400 mb-1 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="text-xs font-body font-600 uppercase tracking-wider truncate">{s.label}</span>
              </div>
              <p className="text-base font-display font-700 text-slate-800 truncate">{s.value}</p>
            </div>
          );
        })}
      </div>
      {pet.notes && (
        <div className="mt-4">
          <p className="text-[10px] font-body font-600 uppercase tracking-wider text-slate-400 mb-1.5">Notes</p>
          <p className="text-sm font-body text-slate-600 leading-relaxed bg-slate-50 rounded-xl p-3">{pet.notes}</p>
        </div>
      )}
    </SectionCard>
  );
}

/* ───────────────── 7. WEIGHT TREND ───────────────── */
function WeightTrend({ pet, detail }) {
  const weights = detail?.weights || [];
  return (
    <SectionCard title="Weight Trend" subtitle={`${weights.length} measurement${weights.length === 1 ? '' : 's'}`}
      action={<Link to="/client/pets" className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-body font-600">History <ChevronRight className="w-3.5 h-3.5" /></Link>}>
      <WeightChart petId={pet.id} weights={weights} canWrite={false} onChange={() => {}} />
    </SectionCard>
  );
}

/* ───────────────── 8. VACCINATION STATUS ───────────────── */
function VaccinationStatus({ detail }) {
  const vax = detail?.vaccinations || [];
  return (
    <SectionCard title="Vaccination Status" subtitle={`${vax.length} on file`}
      action={<Link to="/client/reminders" className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-body font-600">Reminders <ChevronRight className="w-3.5 h-3.5" /></Link>}>
      <VaccinationTimeline items={vax} />
    </SectionCard>
  );
}

/* ───────────────── 9. ACTIVE MEDICATIONS ───────────────── */
function ActiveMedications({ detail }) {
  const meds = detail?.prescriptions || [];
  return (
    <SectionCard title="Active Medications" subtitle={`${meds.length} active`}
      action={<Link to="/client/pets" className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-body font-600">Records <ChevronRight className="w-3.5 h-3.5" /></Link>}>
      {meds.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3"><Pill className="w-6 h-6 text-slate-300" /></div>
          <p className="font-display text-slate-500 font-600 text-sm">No active medications</p>
        </div>
      ) : (
        <div className="space-y-2">
          {meds.map(m => (
            <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0"><Pill className="w-5 h-5 text-violet-600" /></div>
              <div className="flex-1 min-w-0">
                <p className="font-display text-slate-800 text-sm font-600 truncate">{m.medication_name}</p>
                <p className="text-slate-400 text-xs font-body truncate">
                  {m.dosage}{m.frequency ? ` · ${m.frequency}` : ''}{m.route ? ` · ${m.route}` : ''}
                </p>
              </div>
              <span className="text-xs font-body font-600 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">Active</span>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

/* ───────────────── 10. LATEST LAB RESULTS ───────────────── */
function LatestLabResults({ detail }) {
  const labs = detail?.labResults || [];
  return (
    <SectionCard title="Latest Lab Results" subtitle={`${labs.length} result${labs.length === 1 ? '' : 's'}`}
      action={<Link to="/client/pets" className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-body font-600">All <ChevronRight className="w-3.5 h-3.5" /></Link>}>
      {labs.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3"><FlaskConical className="w-6 h-6 text-slate-300" /></div>
          <p className="font-display text-slate-500 font-600 text-sm">No lab results yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {labs.slice(0, 4).map(l => (
            <div key={l.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0"><FlaskConical className="w-5 h-5 text-emerald-600" /></div>
              <div className="flex-1 min-w-0">
                <p className="font-display text-slate-800 text-sm font-600 truncate">{l.title}</p>
                <p className="text-slate-400 text-xs font-body">{fmtDate(l.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

/* ───────────────── 11. CLINIC INFORMATION ───────────────── */
function ClinicInformation({ clinic }) {
  if (!clinic) return null;
  const rows = [
    { icon: MapPin, label: 'Address', value: clinic.address },
    { icon: Phone,  label: 'Phone',   value: clinic.phone },
    { icon: Mail,   label: 'Email',   value: clinic.email },
    { icon: Clock3, label: 'Hours',   value: clinic.hours },
    { icon: Globe,  label: 'Website', value: clinic.website },
  ];
  return (
    <SectionCard title="Clinic Information" subtitle={clinic.name}>
      <div className="space-y-3">
        {rows.map(r => {
          const Icon = r.icon;
          return (
            <div key={r.label} className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0"><Icon className="w-4 h-4 text-blue-500" /></div>
              <div className="min-w-0">
                <p className="text-[10px] font-body font-600 uppercase tracking-wider text-slate-400">{r.label}</p>
                <p className="font-body text-slate-700 text-sm font-500 break-words">{r.value}</p>
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

/* ───────────────── 12. NOTIFICATIONS ───────────────── */
function NotificationRow({ n, onMarkRead }) {
  const meta = {
    reminder: { icon: Bell,        tint: 'bg-blue-50 text-blue-600' },
    warning:  { icon: AlertCircle,  tint: 'bg-red-50 text-red-600' },
    info:     { icon: Stethoscope,  tint: 'bg-teal-50 text-teal-600' },
    success:  { icon: CheckCircle2, tint: 'bg-emerald-50 text-emerald-600' },
  }[n.type] || { icon: Stethoscope, tint: 'bg-teal-50 text-teal-600' };
  const Icon = meta.icon;
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border transition-colors
      ${n.is_read ? 'bg-slate-50 border-slate-100' : 'bg-blue-50/40 border-blue-200'}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.tint}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-display text-slate-800 text-sm font-600">{n.title}</p>
        <p className="font-body text-slate-500 text-xs mt-0.5">{n.message}</p>
        <p className="font-body text-slate-400 text-[11px] mt-1">{fmtDate(n.created_at)}</p>
      </div>
      {!n.is_read && (
        <button onClick={() => onMarkRead(n.id)} title="Mark as read"
          className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-100 transition-colors shrink-0">
          <CheckCircle2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/* ───────────────── 14. LOADING / 15. ERROR STATES ───────────────── */
function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
      <div className="flex gap-1.5 justify-center py-12">
        {[0,1,2].map(i => <div key={i} className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-48 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="h-48 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4"><AlertCircle className="w-8 h-8 text-red-500" /></div>
      <p className="font-display text-slate-700 font-600 mb-1">Couldn't load your dashboard</p>
      <p className="font-body text-slate-400 text-sm mb-5 max-w-sm">{error || 'Something went wrong. Please try again.'}</p>
      <button onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-body font-600 transition-colors">
        <RefreshCw className="w-4 h-4" /> Try again
      </button>
    </div>
  );
}

/* ───────────────── EMPTY STATE (no pets) ───────────────── */
function EmptyPetsState({ onCreate }) {
  return (
    <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4 text-3xl">🐾</div>
      <p className="font-display text-slate-600 font-600 mb-2">No pets registered yet</p>
      <p className="text-slate-400 font-body text-sm mb-5">Add your first companion to start tracking their health.</p>
      <button onClick={onCreate}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-body font-600 shadow-md shadow-blue-500/25">
        <Plus className="w-4 h-4" /> Add Pet
      </button>
    </div>
  );
}

/* ════════════════════════════ MAIN PAGE ════════════════════════════ */
export default function ClientOverviewPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const firstName = user?.name?.split(' ')[0] || 'there';

  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [activePetId, setActivePetId] = useState(null);
  const [notifLocal, setNotifLocal] = useState([]);
  const [unread, setUnread]         = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await clientService.getDashboard();
      setData(d);
      if (d.pets?.length) setActivePetId(prev => prev || d.pets[0].id);
      const notes = d.notifications || [];
      setNotifLocal(notes);
      setUnread(d.unreadCount || notes.filter(n => !n.is_read).length);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = useCallback(async (id) => {
    setNotifLocal(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnread(u => Math.max(0, u - 1));
    try { await notificationService.markRead(id); } catch (_) {}
  }, []);

  const markAll = useCallback(async () => {
    setNotifLocal(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnread(0);
    try { await notificationService.markAllRead(); } catch (_) {}
  }, []);

  // 14. Loading state
  if (loading) return <LoadingState />;
  // 15. Error state
  if (error)   return <ErrorState error={error} onRetry={load} />;

  const pets = data?.pets || [];
  const appointments = data?.appointments || [];
  const upcoming = appointments
    .filter(a => a.status === 'pending' || a.status === 'confirmed')
    .sort((a, b) => new Date(a.appointment_at) - new Date(b.appointment_at));
  const nextAppt = upcoming[0] || null;

  const activePet = pets.find(p => p.id === activePetId) || pets[0] || null;
  const petDetail = activePet ? data?.petDetails?.[activePet.id] : null;

  return (
    <div className="space-y-6">
      {/* 1. Dashboard Header */}
      <DashboardHeader
        firstName={firstName}
        petCount={pets.length}
        upcomingCount={upcoming.length}
      />

      {/* 3. Quick Actions */}
      <QuickActions />

      {/* 2. Active Pet Switcher */}
      {pets.length > 0 && (
        <ActivePetSwitcher pets={pets} activePetId={activePet?.id} onSelect={setActivePetId} />
      )}

      {/* 13. Empty state — no pets */}
      {pets.length === 0 ? (
        <EmptyPetsState onCreate={() => navigate('/client/pets')} />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 4. Next Appointment (primary card) — spans 1 col */}
            <div className="lg:col-span-1">
              <NextAppointmentCard appointment={nextAppt} />
            </div>
            {/* 5. Active Reminders */}
            <div className="lg:col-span-2">
              <ActiveReminders summary={data?.reminders?.length
                ? { upcoming: data.reminders.reduce((s, g) => s + g.reminders.filter(r => r.status === 'scheduled').length, 0),
                    overdue:  data.reminders.reduce((s, g) => s + g.reminders.filter(r => r.status === 'overdue').length, 0) }
                : { upcoming: 0, overdue: 0 }} />
            </div>
          </div>

          {/* 6. Pet Health Snapshot + 7. Weight Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PetHealthSnapshot pet={activePet} />
            {activePet && <WeightTrend pet={activePet} detail={petDetail} />}
          </div>

          {/* 8. Vaccination Status + 9. Active Medications */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {activePet && <VaccinationStatus detail={petDetail} />}
            {activePet && <ActiveMedications detail={petDetail} />}
          </div>

          {/* 10. Latest Lab Results + 11. Clinic Information */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {activePet && <LatestLabResults detail={petDetail} />}
            <ClinicInformation clinic={data?.clinic} />
          </div>

          {/* 12. Notifications (full width) */}
          <SectionCard title="Notifications" subtitle={`${unread} unread`}
            action={
              <div className="flex items-center gap-2">
                <button onClick={load} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 font-body font-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title="Refresh">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                {unread > 0 && (
                  <button onClick={markAll} className="text-xs text-blue-500 hover:text-blue-700 font-body font-600">Mark all read</button>
                )}
              </div>
            }>
            {notifLocal.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3"><BellRing className="w-6 h-6 text-slate-300" /></div>
                <p className="font-display text-slate-500 font-600 text-sm">No notifications yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifLocal.map(n => <NotificationRow key={n.id} n={n} onMarkRead={markRead} />)}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
