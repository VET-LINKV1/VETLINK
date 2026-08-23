/**
 * PetRecordDrawer.jsx — Full Admin Pet Record view (11 sections).
 * Opens as a right-hand drawer. Mirrors the client record structure
 * plus appointments & billing sections for admin oversight.
 */
import { useState, useMemo } from 'react';
import { X, Calendar, Stethoscope, Syringe, Pill, FlaskConical, ShieldAlert,
  Weight, Scissors, FolderOpen, Clock, FileText, HeartPulse, Shield, PawPrint, User,
  Activity, Ruler, AlertTriangle, ChevronRight, ChevronDown,
} from 'lucide-react';
import VaccinationTimeline from '../../../components/passport/VaccinationTimeline';
import WeightChart from '../../../components/passport/WeightChart';

const SPECIES_EMOJI = { Dog: '🐕', Cat: '🐈', Bird: '🐦', Rabbit: '🐇', Hamster: '🐹', Fish: '🐠', Reptile: '🦎', Other: '🐾' };
const SPECIES_TINT = {
  Dog: 'bg-amber-50 text-amber-600', Cat: 'bg-violet-50 text-violet-600', Bird: 'bg-cyan-50 text-cyan-600',
  Rabbit: 'bg-rose-50 text-rose-600', Hamster: 'bg-orange-50 text-orange-600', Fish: 'bg-cyan-50 text-cyan-600',
  Reptile: 'bg-teal-50 text-teal-600', Other: 'bg-slate-100 text-slate-500',
};

const SECTIONS = [
  { id: 'profile',       label: 'Pet Profile',          icon: PawPrint },
  { id: 'owner',         label: 'Owner Information',    icon: User },
  { id: 'overview',      label: 'Health Overview',      icon: Activity },
  { id: 'vaccinations',  label: 'Vaccinations',         icon: Syringe },
  { id: 'history',       label: 'Medical History',      icon: Stethoscope },
  { id: 'medications',   label: 'Medications',          icon: Pill },
  { id: 'lab',           label: 'Lab Results',          icon: FlaskConical },
  { id: 'allergies',     label: 'Allergies',            icon: ShieldAlert },
  { id: 'weight',        label: 'Weight & BCS',         icon: Weight },
  { id: 'procedures',    label: 'Procedures',           icon: Scissors },
  { id: 'appointments',  label: 'Appointments',         icon: Calendar },
  { id: 'billing',       label: 'Billing',              icon: FileText },
  { id: 'documents',     label: 'Documents',            icon: FolderOpen },
  { id: 'timeline',      label: 'Care Timeline',        icon: Clock },
];

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return '—'; }
}
function fmtDateFull(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return '—'; }
}

function StatusBadge({ status, type }) {
  const base = 'text-[10px] font-body font-600 px-2 py-0.5 rounded-md';
  const maps = {
    vax: {
      up_to_date: 'bg-emerald-50 text-emerald-700',
      expiring_soon: 'bg-amber-50 text-amber-700',
      overdue: 'bg-red-50 text-red-700',
      protected: 'bg-emerald-50 text-emerald-700',
      scheduled: 'bg-blue-50 text-blue-700',
    },
    rx: {
      active: 'bg-emerald-50 text-emerald-700',
      discontinued: 'bg-amber-50 text-amber-700',
      completed: 'bg-slate-100 text-slate-500',
      expired: 'bg-slate-100 text-slate-500',
    },
    appt: {
      pending: 'bg-amber-50 text-amber-700',
      confirmed: 'bg-blue-50 text-blue-700',
      completed: 'bg-slate-100 text-slate-500',
      cancelled: 'bg-red-50 text-red-700',
      no_show: 'bg-red-50 text-red-700',
    },
  };
  const m = maps[type] || maps.vax;
  return <span className={`${base} border ${m[status] || 'bg-slate-100 text-slate-500'}`}>{status?.replace('_', ' ')}</span>;
}

function SectionCard({ id, title, subtitle, icon: Icon, children, action }) {
  return (
    <section id={id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/10">
        <div className="flex items-center gap-2">
          {Icon && <span className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center"><Icon className="w-3.5 h-3.5" /></span>}
          <div>
            <h3 className="font-display text-slate-800 dark:text-white font-600">{title}</h3>
            {subtitle && <p className="text-xs font-body text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function EmptyHint({ icon: Icon, label, hint }) {
  return (
    <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl">
      <Icon className="w-8 h-8 text-slate-200 mx-auto mb-2" />
      <p className="font-display text-slate-400 font-600 text-sm">{label}</p>
      {hint && <p className="text-slate-300 text-xs font-body mt-1">{hint}</p>}
    </div>
  );
}

function TimelineDot({ color }) {
  return <span className={`absolute left-[14px] top-2 w-3 h-3 rounded-full border-2 border-white ${color}`} />;
}

export default function PetRecordDrawer({ record, onClose }) {
  const [openSections, setOpenSections] = useState(new Set(['profile', 'owner', 'overview', 'vaccinations', 'history']));

  if (!record) return null;

  const { petProfile, owner, healthOverview, vaccinations, medicalHistory, prescriptions,
          labResults, allergies, weightHistory, treatments, appointments, billing, documents, timeline } = record;

  const toggle = (id) => setOpenSections(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const getSubtitle = (id) => {
    const n = (arr) => (arr?.length || 0);
    switch (id) {
      case 'vaccinations':  return `${n(vaccinations)} records`;
      case 'history':        return `${n(medicalHistory)} visits`;
      case 'medications':    return `${n(prescriptions)} prescriptions`;
      case 'lab':            return `${n(labResults)} results`;
      case 'weight':         return `${n(weightHistory)} entries`;
      case 'procedures':     return `${n(treatments)} procedures`;
      case 'appointments':   return `${n(appointments)} appointments`;
      case 'billing':        return `PHP ${(billing?.billedTotal || 0).toLocaleString()} billed · PHP ${(billing?.unpaidTotal || 0).toLocaleString()} unpaid`;
      case 'documents':      return `${n(documents)} files`;
      case 'timeline':       return `${n(timeline)} events`;
      default:               return undefined;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 flex flex-col h-full shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/10 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${SPECIES_TINT[petProfile?.species] || SPECIES_TINT.Other}`}>
              {SPECIES_EMOJI[petProfile?.species] || '🐾'}
            </div>
            <div>
              <h2 className="font-display text-slate-800 dark:text-white text-lg font-700">{petProfile?.name}</h2>
              <p className="text-xs font-body text-slate-400">{petProfile?.species}{petProfile?.breed ? ` · ${petProfile?.breed}` : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"><X className="w-5 h-5" /></button>
        </div>

        {/* Sticky section nav */}
        <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-slate-100 dark:border-white/10 sticky top-[48px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-10 overflow-x-auto">
          {SECTIONS.map(s => {
            const SectionIcon = s.icon;
            return (
            <button key={s.id} onClick={() => toggle(s.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-body font-600 whitespace-nowrap transition-colors ${
                openSections.has(s.id)
                  ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'
              }`}>
              <SectionIcon className="w-3.5 h-3.5" />
              {s.label}
              <ChevronDown className={`w-3 h-3 transition-transform ${openSections.has(s.id) ? 'rotate-180' : ''}`} />
            </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {SECTIONS.map(section => (
            <SectionCard
              key={section.id}
              icon={section.icon}
              title={section.label}
              subtitle={getSubtitle(section.id)}
              action={<ChevronRight className={`w-4 h-4 text-slate-400 ${openSections.has(section.id) ? 'rotate-90' : ''}`} />}
            >
              {openSections.has(section.id) && renderSection(section.id)}
            </SectionCard>
          ))}
        </div>
      </div>
    </div>
  );

  function renderSection(id) {
    switch (id) {
      case 'profile':
        return (
          <div className="flex flex-col sm:flex-row gap-5">
            <div className={`shrink-0 w-28 h-28 rounded-2xl border-4 border-white shadow-sm flex items-center justify-center text-6xl ${SPECIES_TINT[petProfile.species] || SPECIES_TINT.Other}`}>
              {SPECIES_EMOJI[petProfile.species] || '🐾'}
            </div>
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat icon={Calendar} label="Age" value={petProfile.age != null ? `${petProfile.age} yr${petProfile.age !== 1 ? 's' : ''}` : '—'} />
              <Stat icon={HeartPulse} label="Sex" value={petProfile.gender ? petProfile.gender[0].toUpperCase() + petProfile.gender.slice(1) : '—'} />
              <Stat icon={PawPrint} label="Breed" value={petProfile.breed || '—'} />
              <Stat icon={Weight} label="Weight" value={petProfile.weight_kg ? `${petProfile.weight_kg} kg` : '—'} />
              <Stat icon={Shield} label="Spay/Neuter" value={petProfile.notes && petProfile.notes.includes('neutered') ? 'Neutered' : '—'} />
              <Stat icon={AlertTriangle} label="Microchip" value={petProfile.microchip_no || '—'} />
              <Stat icon={Calendar} label="Registered" value={fmtDateFull(petProfile.created_at)} />
              <Stat icon={Calendar} label="Updated" value={fmtDateFull(petProfile.updated_at)} />
            </div>
          </div>
        );
      case 'owner':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="font-display text-slate-800 dark:text-white text-lg">{owner?.name || '—'}</p>
              <p className="text-slate-500 text-sm">{owner?.email || '—'}</p>
              <p className="text-slate-500 text-sm">{owner?.phone_number || '—'}</p>
              {owner?.address && <p className="text-slate-500 text-sm">{owner.address}</p>}
            </div>
            <div className="text-right sm:text-left">
              {owner?.id && <p className="text-xs text-slate-400">Owner ID: {owner.id.slice(0, 8)}…</p>}
            </div>
          </div>
        );
      case 'overview':
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <OverviewStat icon={Stethoscope} label="Total Visits" value={healthOverview?.totalVisits || 0} tint="teal" />
            <OverviewStat icon={Shield} label="Completed" value={healthOverview?.completedVisits || 0} tint="emerald" />
            <OverviewStat icon={Pill} label="Active Rx" value={healthOverview?.activePrescriptions || 0} tint="violet" />
            <OverviewStat icon={Syringe} label="Upcoming Vax" value={healthOverview?.upcomingVaccinations || 0} tint="blue" />
            <OverviewStat icon={AlertTriangle} label="Overdue Vax" value={healthOverview?.overdueVaccinations || 0} tint={healthOverview?.overdueVaccinations ? 'red' : 'slate'} />
            <OverviewStat icon={Weight} label="Current Wt" value={healthOverview?.currentWeight ? `${healthOverview.currentWeight} kg` : '—'} tint="amber" />
            <OverviewStat icon={Ruler} label="Current BCS" value={healthOverview?.currentBCS ? `${healthOverview.currentBCS}/9` : '—'} tint="cyan" />
          </div>
        );
      case 'vaccinations':
        return vaccinations?.length ? (
          <VaccinationTimeline items={vaccinations} />
        ) : <EmptyHint icon={Syringe} label="No vaccination records" hint="Vaccines will appear here once administered." />;
      case 'history':
        return medicalHistory?.length ? (
          <div className="relative space-y-4">
            <div className="absolute left-[15px] top-3 bottom-3 w-0.5 bg-gradient-to-b from-teal-300 via-teal-100 to-teal-50 rounded-full" />
            {medicalHistory.map(r => (
              <div key={r.id} className="relative pl-10">
                <TimelineDot color="bg-teal-400" />
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-white/10 p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-display text-slate-800 dark:text-white text-sm font-700">{fmtDateFull(r.visit_date)}</p>
                      <p className="text-slate-500 text-xs font-body mt-0.5">
                        By {r.vet?.name || 'Vet'}
                        {(r.weight_kg || r.temperature_c) && (
                          <span className="ml-2">
                            {r.weight_kg && <span className="ml-1.5"><Weight className="w-3 h-3 inline" /> {r.weight_kg}kg</span>}
                            {r.temperature_c && <span className="ml-1.5"><Activity className="w-3 h-3 inline" /> {r.temperature_c}°C</span>}
                          </span>
                        )}
                      </p>
                    </div>
                    {r.follow_up_date && (
                      <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-lg font-body font-600 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {fmtDate(r.follow_up_date)}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 space-y-2">
                    <HistoryField icon={Stethoscope} color="text-teal-500" label="Diagnosis" value={r.diagnosis} />
                    {r.treatment && <HistoryField icon={Pill} color="text-violet-500" label="Treatment" value={r.treatment} />}
                    {r.prescription && <HistoryField icon={Pill} color="text-violet-500" label="Prescription" value={r.prescription} />}
                    {r.notes && <HistoryField icon={FileText} color="text-slate-400" label="Notes" value={r.notes} />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyHint icon={Stethoscope} label="No medical history" hint="Visits will appear here after a check-up." />;
      case 'medications':
        return prescriptions?.length ? (
          <div className="space-y-2">
            {prescriptions.map(m => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0"><Pill className="w-4.5 h-4.5 text-violet-600" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-slate-800 dark:text-white text-sm font-600 truncate">{m.medication_name}</p>
                  <p className="text-slate-400 text-xs font-body truncate">
                    {m.dosage}{m.frequency ? ` · ${m.frequency}` : ''}{m.route ? ` · ${m.route}` : ''}
                  </p>
                  <p className="text-slate-300 text-[11px] font-body mt-0.5">
                    {fmtDate(m.start_date)}{m.end_date ? ` – ${fmtDate(m.end_date)}` : ''}
                  </p>
                </div>
                <StatusBadge status={m.status} type="rx" />
              </div>
            ))}
          </div>
        ) : <EmptyHint icon={Pill} label="No prescriptions" hint="Medications prescribed will appear here." />;
      case 'lab':
        return labResults?.length ? (
          <div className="space-y-2">
            {labResults.map(f => (
              <FileRow key={f.id} file={f} />
            ))}
          </div>
        ) : <EmptyHint icon={FlaskConical} label="No lab results" hint="Uploaded lab & diagnostic files will appear here." />;
      case 'allergies':
        return allergies ? (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800">
            <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm font-body text-red-700 dark:text-red-300 leading-relaxed whitespace-pre-line">{allergies}</p>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800">
            <Shield className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-sm font-body text-emerald-700 dark:text-emerald-300">No known allergies recorded.</p>
          </div>
        );
      case 'weight':
        return weightHistory?.length ? (
          <>
            <WeightChart petId={petProfile.id} weights={weightHistory} canWrite={false} onChange={() => {}} />
            <div className="mt-4 space-y-2">
              {weightHistory.slice().reverse().map(w => (
                <div key={w.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                  <Weight className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="text-sm font-display font-600 text-slate-800 dark:text-white w-20">{w.weight_kg} kg</span>
                  <span className="text-xs font-body text-slate-400">BCS {w.body_condition_score ?? '—'}/9</span>
                  <span className="text-xs font-body text-slate-300 ml-auto">{fmtDate(w.recorded_at)}</span>
                </div>
              ))}
            </div>
          </>
        ) : <EmptyHint icon={Weight} label="No weight records" hint="Weight & BCS measurements will appear here." />;
      case 'procedures':
        return treatments?.length ? (
          <div className="space-y-2">
            {treatments.map(t => (
              <div key={t.id} className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <Scissors className="w-4 h-4 text-teal-500 shrink-0" />
                    <p className="font-display text-slate-800 dark:text-white text-sm font-600 truncate">{t.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.performed_date && <span className="text-xs font-body text-slate-400">{fmtDate(t.performed_date)}</span>}
                    <StatusBadge status={t.status} type="vax" />
                  </div>
                </div>
                {t.description && <p className="text-xs font-body text-slate-500 mt-1.5 ml-6">{t.description}</p>}
                {t.outcome && <p className="text-xs font-body text-slate-400 mt-1 ml-6 italic">Outcome: {t.outcome}</p>}
              </div>
            ))}
          </div>
        ) : <EmptyHint icon={Scissors} label="No procedures" hint="Surgeries & treatments will appear here." />;
      case 'appointments':
        return appointments?.length ? (
          <div className="space-y-2">
            {appointments.map(a => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                <div className="flex-1 min-w-0">
                  <p className="font-display text-slate-800 dark:text-white text-sm font-600">{a.type}</p>
                  <p className="text-slate-400 text-xs font-body truncate">
                    {fmtDateFull(a.appointment_at)} · {a.vet?.name || 'TBA'} · {a.reason || '—'}
                  </p>
                </div>
                <StatusBadge status={a.status} type="appt" />
              </div>
            ))}
          </div>
        ) : <EmptyHint icon={Calendar} label="No appointments" hint="Scheduled and past appointments will appear here." />;
      case 'billing':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <BillingStat label="Total Billed" value={`₱${(billing?.billedTotal || 0).toLocaleString()}`} />
              <BillingStat label="Unpaid" value={`₱${(billing?.unpaidTotal || 0).toLocaleString()}`} />
              <BillingStat label="Currency" value={billing?.currency || 'PHP'} />
            </div>
            {billing?.invoices?.length ? (
              <div className="space-y-2">
                {billing.invoices.slice(0, 10).map(inv => (
                  <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                    <div>
                      <p className="font-display text-slate-800 dark:text-white text-sm font-600">{inv.id.slice(0, 12)}</p>
                      <p className="text-slate-400 text-xs">{fmtDate(inv.issued_at)} · Due {fmtDate(inv.due_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-slate-800 dark:text-white font-600">₱{Number(inv.amount).toLocaleString()}</p>
                      <StatusBadge status={inv.status} type="vax" />
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyHint icon={FileText} label="No invoices" hint="Billing records will appear here." />}
          </div>
        );
      case 'documents':
        return documents?.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {documents.map(f => <FileRow key={f.id} file={f} />)}
          </div>
        ) : <EmptyHint icon={FolderOpen} label="No documents" hint="X-rays, photos & paperwork will appear here." />;
      case 'timeline':
        return timeline?.length ? (
          <div className="relative space-y-3">
            <div className="absolute left-[15px] top-3 bottom-3 w-0.5 bg-gradient-to-b from-teal-300 via-teal-100 to-teal-50 rounded-full" />
            {timeline.map(ev => {
              const meta = TIMELINE_META[ev.kind] || TIMELINE_META.visit;
              const Icon = meta.icon;
              return (
                <div key={ev.event_id} className="relative pl-10">
                  <TimelineDot color={meta.ringColor} />
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-white/10 px-3 py-2 flex items-center gap-3">
                    <Icon className={`w-4 h-4 shrink-0 ${meta.textColor}`} />
                    <p className="text-sm font-body text-slate-700 dark:text-slate-200 flex-1 min-w-0 truncate">{ev.summary}</p>
                    <span className="text-xs font-body text-slate-300 shrink-0">{fmtDate(ev.occurred_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <EmptyHint icon={Clock} label="No care events" hint="A unified timeline of visits, vaccines, meds & files." />;
      default:
        return null;
    }
  }
}

const TIMELINE_META = {
  visit:       { icon: Stethoscope, ringColor: 'bg-teal-400', textColor: 'text-teal-500' },
  vaccination: { icon: Syringe,     ringColor: 'bg-blue-400',  textColor: 'text-blue-500' },
  prescription:{ icon: Pill,        ringColor: 'bg-violet-400', textColor: 'text-violet-500' },
  treatment:   { icon: Scissors,    ringColor: 'bg-indigo-400', textColor: 'text-indigo-500' },
  file:        { icon: FileText,    ringColor: 'bg-slate-400', textColor: 'text-slate-500' },
  appointment: { icon: Calendar,    ringColor: 'bg-amber-400', textColor: 'text-amber-500' },
};

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 p-3">
      <div className="flex items-center gap-1.5 text-slate-400 mb-1 min-w-0">
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[10px] font-body font-600 uppercase tracking-wider truncate">{label}</span>
      </div>
      <p className="text-base font-display font-700 text-slate-800 dark:text-white truncate">{value}</p>
    </div>
  );
}

function OverviewStat({ icon: Icon, label, value, tint }) {
  const t = { teal: 'text-teal-600 bg-teal-50', violet: 'text-violet-600 bg-violet-50', blue: 'text-blue-600 bg-blue-50',
    red: 'text-red-600 bg-red-50', amber: 'text-amber-600 bg-amber-50', cyan: 'text-cyan-600 bg-cyan-50',
    emerald: 'text-emerald-600 bg-emerald-50', slate: 'text-slate-500 bg-slate-50' }[tint] || 'text-slate-500 bg-slate-50';
  return (
    <div className="rounded-xl border border-slate-100 dark:border-white/10 p-3 text-center">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-1.5 ${t}`}><Icon className="w-4 h-4" /></div>
      <p className="font-display text-slate-800 dark:text-white text-lg font-700">{value}</p>
      <p className="text-[10px] font-body font-600 uppercase tracking-wider text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}

function BillingStat({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 p-3 text-center">
      <p className="font-display text-slate-800 dark:text-white text-lg font-700">{value}</p>
      <p className="text-[10px] font-body font-600 uppercase tracking-wider text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}

function HistoryField({ icon: Icon, color, label, value }) {
  return (
    <div>
      <p className={`${color} text-[10px] font-body font-600 uppercase tracking-wide mb-1 flex items-center gap-1`}>
        <Icon className="w-3 h-3" /> {label}
      </p>
      <p className="text-sm font-body text-slate-700 dark:text-slate-200 whitespace-pre-line leading-relaxed">{value}</p>
    </div>
  );
}

function FileRow({ file }) {
  const Icon = file.kind === 'xray' ? FlaskConical : FileText;
  return (
    <button className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 hover:border-teal-200 hover:bg-teal-50/40 transition-colors text-left">
      <div className="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center shrink-0">
        <Icon className="w-4.5 h-4.5 text-teal-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-display text-slate-800 dark:text-white text-sm font-600 truncate">{file.title}</p>
        <p className="text-slate-400 text-xs font-body truncate">
          {file.kind || 'File'}{file.size_bytes ? ` · ${(file.size_bytes / 1024).toFixed(1)} KB` : ''} · {fmtDate(file.created_at)}
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
    </button>
  );
}