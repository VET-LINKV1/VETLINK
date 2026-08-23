/**
 * ClientPetsPage.jsx — Pet Records (per-pet health record)
 *
 * The client's full pet health record, organized into 11 sections
 * around a persistent pet roster (the owner switches between pets and
 * every section below reflects that pet).
 *
 * Sections (per spec):
 *   1.  Pet Profile / Identity
 *   2.  Health Overview
 *   3.  Vaccination Records
 *   4.  Medical History
 *   5.  Medications & Prescriptions
 *   6.  Laboratory & Diagnostic Results
 *   7.  Allergies
 *   8.  Weight & BCS History
 *   9.  Procedures & Surgeries
 *   10. Documents
 *   11. Timeline of Care
 *
 * Data comes from a single enriched GET /client/pets/:petId/record call
 * that composes: profile, health overview stats, vaccinations, medical
 * records, prescriptions, lab-result files, allergies, weight/BCS history,
 * treatments, documents, and a unified care timeline.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientService } from '../../services/clientService';
import VaccinationTimeline from '../../components/passport/VaccinationTimeline';
import WeightChart from '../../components/passport/WeightChart';
import {
  PawPrint, Plus, Edit2, X, Loader2, AlertCircle,
  FileText, Calendar, Stethoscope, Pill, Weight, Thermometer,
  HeartPulse, Shield, ShieldAlert, AlertTriangle, Syringe, FlaskConical,
  Activity, Scissors, FolderOpen, Clock, ArrowRight, Ruler,
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

const SECTION_LABELS = {
  identity:    'Pet Profile / Identity',
  overview:    'Health Overview',
  vaccinations:'Vaccination Records',
  history:     'Medical History',
  medications: 'Medications & Prescriptions',
  lab:         'Laboratory & Diagnostic Results',
  allergies:   'Allergies',
  weight:      'Weight & BCS History',
  procedures:  'Procedures & Surgeries',
  documents:   'Documents',
  timeline:    'Timeline of Care',
};

function today(d) {
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return '—'; }
}
function todayFull(d) {
  try { return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return '—'; }
}
function fileSize(bytes) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}
const KIND_LABEL = { xray: 'X-Ray', lab_result: 'Lab Result', prescription_doc: 'Prescription', document: 'Document', photo: 'Photo', other: 'File' };

/* ───────────────────────────── PET MODAL ───────────────────────────── */
function PetModal({ pet, onSave, onClose }) {
  const isEdit = !!pet?.id;
  const [form, setForm] = useState({
    name: pet?.name || '', species: pet?.species || 'Dog', breed: pet?.breed || '',
    age: pet?.age ?? '', gender: pet?.gender || 'unknown', notes: pet?.notes || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Pet name is required.'); return; }
    setLoading(true);
    try {
      const result = isEdit ? await clientService.updatePet(pet.id, form) : await clientService.addPet(form);
      onSave(result);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save pet.');
    } finally { setLoading(false); }
  };

  const inputClass = 'w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-body focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-teal-50/60">
          <h3 className="font-display text-slate-800 font-700">{isEdit ? 'Edit Pet' : 'Add New Pet'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-white transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-red-500 text-sm font-body">{error}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-600 text-slate-600 mb-1 font-body">Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Buddy" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-600 text-slate-600 mb-1 font-body">Species</label>
              <select value={form.species} onChange={e => set('species', e.target.value)} className={inputClass}>
                {['Dog','Cat','Bird','Rabbit','Hamster','Fish','Reptile','Other'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-600 text-slate-600 mb-1 font-body">Breed</label>
              <input value={form.breed} onChange={e => set('breed', e.target.value)} placeholder="Golden Retriever" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-600 text-slate-600 mb-1 font-body">Age (years)</label>
              <input type="number" min="0" max="50" value={form.age} onChange={e => set('age', e.target.value)} placeholder="3" className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-600 text-slate-600 mb-1 font-body">Gender</label>
            <div className="flex gap-2">
              {['male','female','unknown'].map(g => (
                <button key={g} type="button" onClick={() => set('gender', g)}
                  className={`flex-1 py-2 rounded-xl text-xs font-body font-500 capitalize border transition-all ${form.gender === g ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-600 text-slate-600 mb-1 font-body">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Allergies, special conditions..." className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-body focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none bg-white" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-body hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-display font-600 text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-500/25 disabled:opacity-60">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : isEdit ? 'Update' : 'Add Pet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ───────────────────────────── SHARED CARDS ───────────────────────────── */
function SectionCard({ id, icon: Icon, title, subtitle, action, children, className = '' }) {
  return (
    <section id={id} className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          {Icon && <span className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center"><Icon className="w-4 h-4" /></span>}
          <div>
            <h3 className="font-display text-slate-800 font-600 leading-tight">{title}</h3>
            {subtitle && <p className="text-xs font-body text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function EmptyHint({ icon: Icon, label, hint }) {
  return (
    <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl">
      <Icon className="w-10 h-10 text-slate-200 mx-auto mb-2" />
      <p className="font-display text-slate-400 font-600 text-sm">{label}</p>
      {hint && <p className="text-slate-300 text-xs font-body mt-1">{hint}</p>}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    active:       'bg-emerald-50 text-emerald-700 border-emerald-200',
    completed:    'bg-slate-100 text-slate-500 border-slate-200',
    discontinued: 'bg-amber-50 text-amber-700 border-amber-200',
    expired:      'bg-slate-100 text-slate-500 border-slate-200',
    scheduled:    'bg-teal-50 text-teal-700 border-teal-200',
    administered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    overdue:      'bg-red-50 text-red-700 border-red-200',
    cancelled:    'bg-slate-100 text-slate-500 border-slate-200',
    planned:      'bg-blue-50 text-blue-700 border-blue-200',
    in_progress:  'bg-indigo-50 text-indigo-700 border-indigo-200',
  };
  const cls = map[status] || 'bg-slate-100 text-slate-500 border-slate-200';
  return <span className={`text-xs font-body font-600 px-2 py-0.5 rounded-md border capitalize ${cls}`}>{status?.replace('_', ' ')}</span>;
}

/* ════════════════════════════ MAIN PAGE ════════════════════════════ */
export default function ClientPetsPage() {
  const [pets, setPets]               = useState([]);
  const [selectedPet, setSelectedPet] = useState(null);
  const [record, setRecord]           = useState(null);
  const [loadingPets, setLoadingPets] = useState(true);
  const [loadingRec, setLoadingRec]   = useState(false);
  const [fileUrls, setFileUrls]       = useState({});
  const [showModal, setShowModal]     = useState(false);
  const [editingPet, setEditingPet]   = useState(null);
  const [error, setError]             = useState('');
  const navigate = useNavigate();

  const loadPets = useCallback(async () => {
    setLoadingPets(true);
    try {
      const data = await clientService.getPets();
      setPets(data);
      if (data.length > 0 && !selectedPet) setSelectedPet(data[0]);
    } catch { setError('Failed to load pets.'); }
    finally { setLoadingPets(false); }
  }, []); // eslint-disable-line

  const loadRecord = useCallback(async (petId) => {
    setLoadingRec(true);
    setFileUrls({});
    try {
      const d = await clientService.getPetRecord(petId);
      setRecord(d);
    } catch {
      setRecord(null);
    } finally { setLoadingRec(false); }
  }, []);

  useEffect(() => { loadPets(); }, [loadPets]);
  useEffect(() => { if (selectedPet) loadRecord(selectedPet.id); }, [selectedPet, loadRecord]);

  const handlePetSaved = (pet) => {
    setShowModal(false);
    setEditingPet(null);
    loadPets();
    setSelectedPet(pet);
  };

  const openFile = async (file) => {
    if (fileUrls[file.id]) { window.open(fileUrls[file.id], '_blank'); return; }
    try {
      const { url } = await clientService.getFileUrl(file.id);
      setFileUrls(p => ({ ...p, [file.id]: url }));
      window.open(url, '_blank');
    } catch { /* ignore */ }
  };

  if (loadingPets) {
    return (
      <div className="space-y-6 bg-[#F8FAFC] -m-6 p-6 min-h-full rounded-none">
        <div className="flex items-center justify-center h-64">
          <div className="flex gap-1.5">{[0,1,2].map(i => <div key={i} className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-bounce" style={{animationDelay:`${i*0.15}s`}} />)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-[#F8FAFC] -m-6 p-6 min-h-full rounded-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-8 h-8 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center">
              <PawPrint className="w-4 h-4" />
            </span>
            <h1 className="font-display text-slate-800 text-2xl font-700">Pet Records</h1>
          </div>
          <p className="text-slate-400 font-body text-sm mt-0.5">
            {pets.length} companion{pets.length !== 1 ? 's' : ''} · Complete health record
          </p>
        </div>
        <button onClick={() => { setEditingPet(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-body font-600 text-sm shadow-lg shadow-teal-500/25 transition-all">
          <Plus className="w-4 h-4" /> Add Pet
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-red-500 text-sm font-body">{error}</p>
        </div>
      )}

      {pets.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto mb-4 text-3xl">🐾</div>
          <p className="font-display text-slate-600 font-600 mb-2">No pets registered yet</p>
          <p className="text-slate-400 font-body text-sm mb-5">Add your first companion to start tracking their health.</p>
          <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-body font-600 hover:bg-teal-700">
            <Plus className="w-4 h-4" /> Add Pet
          </button>
        </div>
      ) : (
        <>
          {/* Patient roster */}
          <div>
            <p className="text-xs font-body font-600 text-slate-400 uppercase tracking-wider mb-2 px-1">Your companions</p>
            <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-2">
              {pets.map(pet => {
                const active = selectedPet?.id === pet.id;
                return (
                  <button key={pet.id} onClick={() => setSelectedPet(pet)}
                    className={`shrink-0 w-40 flex flex-col items-center text-center p-4 rounded-2xl border transition-all duration-200
                      ${active ? 'bg-white border-teal-300 shadow-md shadow-teal-500/10 ring-2 ring-teal-200' : 'bg-white/70 border-slate-100 hover:border-teal-200 hover:shadow-sm'}`}>
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-2 ${SPECIES_TINT[pet.species] || SPECIES_TINT.Other}`}>
                      {SPECIES_EMOJI[pet.species] || '🐾'}
                    </div>
                    <p className={`font-display font-700 text-sm ${active ? 'text-teal-700' : 'text-slate-800'}`}>{pet.name}</p>
                    <p className="text-xs font-body text-slate-400 mt-0.5 truncate w-full">
                      {pet.species}{pet.age != null ? ` · ${pet.age}y` : ''}
                    </p>
                    {active && <span className="mt-2 text-[10px] font-body font-600 uppercase tracking-wider text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md">Selected</span>}
                  </button>
                );
              })}
              <button onClick={() => { setEditingPet(null); setShowModal(true); }}
                className="shrink-0 w-40 flex flex-col items-center justify-center text-center p-4 rounded-2xl border border-dashed border-slate-200 text-slate-400 hover:border-teal-300 hover:text-teal-500 transition-colors">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-2"><Plus className="w-5 h-5" /></div>
                <p className="text-xs font-body font-600">Add pet</p>
              </button>
            </div>
          </div>

          {loadingRec ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
            </div>
          ) : !record ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
              <AlertCircle className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="font-display text-slate-400 font-600 text-sm">Couldn't load this pet's record.</p>
            </div>
          ) : (
            <PetRecordView
              key={selectedPet.id}
              pet={selectedPet}
              record={record}
              onEdit={() => { setEditingPet(selectedPet); setShowModal(true); }}
              onOpenFile={openFile}
              onSharePassport={() => navigate(`/client/passport/pets/${selectedPet.id}`)}
            />
          )}
        </>
      )}

      {showModal && (
        <PetModal pet={editingPet} onSave={handlePetSaved} onClose={() => { setShowModal(false); setEditingPet(null); }} />
      )}

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}

/* ════════════════════════ PET RECORD (11 sections) ══════════════════════ */
function PetRecordView({ pet, record, onEdit, onOpenFile, onSharePassport }) {
  const { petProfile, healthOverview, vaccinations, medicalHistory, prescriptions,
          labResults, allergies, weightHistory, treatments, documents, timeline } = record;

  return (
    <div className="space-y-6 animate-[fadeIn_0.3s_ease]">
      {/* Sticky in-page nav */}
      <div className="flex flex-wrap gap-2 px-1 -mt-2">
        {Object.entries(SECTION_LABELS).map(([key, label]) => (
          <a key={key} href={`#sec-${key}`}
            className="text-xs font-body font-600 px-3 py-1.5 rounded-lg bg-white border border-slate-100 text-slate-500 hover:border-teal-200 hover:text-teal-700 transition-colors">
            {label}
          </a>
        ))}
      </div>

      {/* 1. PET PROFILE / IDENTITY */}
      <section id="sec-identity">
        <SectionCard icon={PawPrint} title={SECTION_LABELS.identity} subtitle="Identity & basic information"
          action={
            <div className="flex items-center gap-2">
              <button onClick={onSharePassport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-body font-600 text-teal-600 bg-teal-50 hover:bg-teal-100 transition-colors">
                <Shield className="w-3.5 h-3.5" /> Health Passport
              </button>
              <button onClick={onEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-body font-600 text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors">
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
            </div>
          }>
          <div className="flex flex-col sm:flex-row gap-5">
            <div className={`shrink-0 w-24 h-24 rounded-2xl border-4 border-white shadow-sm flex items-center justify-center text-5xl ${SPECIES_TINT[petProfile.species] || SPECIES_TINT.Other}`}>
              {SPECIES_EMOJI[petProfile.species] || '🐾'}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-slate-800 text-2xl font-700">{petProfile.name}</h2>
              <p className="text-slate-400 font-body text-sm mb-4">
                {petProfile.species}{petProfile.breed ? ` · ${petProfile.breed}` : ''}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <IdentityStat icon={Calendar} label="Age" value={petProfile.age != null ? `${petProfile.age} yr${petProfile.age !== 1 ? 's' : ''}` : '—'} />
                <IdentityStat icon={HeartPulse} label="Gender" value={petProfile.gender ? petProfile.gender[0].toUpperCase() + petProfile.gender.slice(1) : '—'} />
                <IdentityStat icon={PawPrint} label="Breed" value={petProfile.breed || '—'} />
                <IdentityStat icon={Weight} label="Weight" value={petProfile.weight_kg ? `${petProfile.weight_kg} kg` : '—'} />
              </div>
              {petProfile.notes && (
                <div className="mt-4">
                  <p className="text-[10px] font-body font-600 uppercase tracking-wider text-slate-400 mb-1.5">Notes</p>
                  <p className="text-sm font-body text-slate-600 leading-relaxed bg-slate-50 rounded-xl p-3">{petProfile.notes}</p>
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      </section>

      {/* 2. HEALTH OVERVIEW */}
      <section id="sec-overview">
        <SectionCard icon={Activity} title={SECTION_LABELS.overview} subtitle="At-a-glance summary">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <OverviewStat icon={Stethoscope} label="Total Visits" value={healthOverview.totalVisits} tint="teal" />
            <OverviewStat icon={Pill} label="Active Rx" value={healthOverview.activePrescriptions} tint="violet" />
            <OverviewStat icon={Syringe} label="Upcoming Vax" value={healthOverview.upcomingVaccinations} tint="blue" />
            <OverviewStat icon={AlertTriangle} label="Overdue Vax" value={healthOverview.overdueVaccinations} tint={healthOverview.overdueVaccinations ? 'red' : 'slate'} />
            <OverviewStat icon={Weight} label="Current Wt" value={healthOverview.currentWeight ? `${healthOverview.currentWeight} kg` : '—'} tint="amber" />
            <OverviewStat icon={Ruler} label="Current BCS" value={healthOverview.currentBCS ? `${healthOverview.currentBCS}/9` : '—'} tint="cyan" />
          </div>
        </SectionCard>
      </section>

      {/* 3. VACCINATION RECORDS */}
      <section id="sec-vaccinations">
        <SectionCard icon={Syringe} title={SECTION_LABELS.vaccinations} subtitle={`${vaccinations.length} record${vaccinations.length === 1 ? '' : 's'}`}>
          {vaccinations.length ? (
            <VaccinationTimeline items={vaccinations} />
          ) : <EmptyHint icon={Syringe} label="No vaccination records" hint="Vaccines will appear here once administered." />}
        </SectionCard>
      </section>

      {/* 4. MEDICAL HISTORY */}
      <section id="sec-history">
        <SectionCard icon={Stethoscope} title={SECTION_LABELS.history} subtitle={`${medicalHistory.length} visit${medicalHistory.length === 1 ? '' : 's'}`}>
          {medicalHistory.length ? (
            <div className="relative">
              <div className="absolute left-[15px] top-3 bottom-3 w-0.5 bg-gradient-to-b from-teal-300 via-teal-100 to-teal-50 rounded-full" />
              <div className="space-y-4">
                {medicalHistory.map(r => (
                  <div key={r.id} className="relative pl-10">
                    <span className="absolute left-[8px] top-5 w-3.5 h-3.5 rounded-full border-2 border-white ring-4 bg-teal-400 ring-teal-50" />
                    <div className="bg-white rounded-2xl border border-slate-100 p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="font-display text-slate-800 text-sm font-700">{todayFull(r.visit_date)}</p>
                          <p className="text-slate-500 text-xs font-body mt-0.5">
                            By {r.vet?.name || 'Vet'}
                            {(r.weight_kg || r.temperature_c) && (
                              <span className="ml-2">
                                {r.weight_kg && <span className="ml-1.5"><Weight className="w-3 h-3 inline" /> {r.weight_kg}kg</span>}
                                {r.temperature_c && <span className="ml-1.5"><Thermometer className="w-3 h-3 inline" /> {r.temperature_c}°C</span>}
                              </span>
                            )}
                          </p>
                        </div>
                        {r.follow_up_date && (
                          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-lg font-body font-600 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {today(r.follow_up_date)}
                          </span>
                        )}
                      </div>
                      <div className="mt-3 space-y-2">
                        <HistoryField icon={Stethoscope} color="text-teal-500" label="Diagnosis" value={r.diagnosis} />
                        {r.treatment && <HistoryField icon={Pill} color="text-violet-500" label="Treatment" value={r.treatment} />}
                        {r.notes && <HistoryField icon={FileText} color="text-slate-400" label="Notes" value={r.notes} />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : <EmptyHint icon={Stethoscope} label="No medical history yet" hint="Visits will appear here after a check-up." />}
        </SectionCard>
      </section>

      {/* 5. MEDICATIONS & PRESCRIPTIONS */}
      <section id="sec-medications">
        <SectionCard icon={Pill} title={SECTION_LABELS.medications} subtitle={`${prescriptions.length} prescription${prescriptions.length === 1 ? '' : 's'}`}>
          {prescriptions.length ? (
            <div className="space-y-2">
              {prescriptions.map(m => (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0"><Pill className="w-5 h-5 text-violet-600" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-slate-800 text-sm font-600 truncate">{m.medication_name}</p>
                    <p className="text-slate-400 text-xs font-body truncate">
                      {m.dosage}{m.frequency ? ` · ${m.frequency}` : ''}{m.route ? ` · ${m.route}` : ''}
                    </p>
                    <p className="text-slate-300 text-[11px] font-body mt-0.5">
                      {today(m.start_date)}{m.end_date ? ` – ${today(m.end_date)}` : ''}
                    </p>
                  </div>
                  <StatusBadge status={m.status} />
                </div>
              ))}
            </div>
          ) : <EmptyHint icon={Pill} label="No prescriptions" hint="Medications prescribed will appear here." />}
        </SectionCard>
      </section>

      {/* 6. LABORATORY & DIAGNOSTIC RESULTS */}
      <section id="sec-lab">
        <SectionCard icon={FlaskConical} title={SECTION_LABELS.lab} subtitle={`${labResults.length} result${labResults.length === 1 ? '' : 's'}`}>
          {labResults.length ? (
            <div className="space-y-2">
              {labResults.map(f => (
                <FileRow key={f.id} file={f} onClick={onOpenFile} />
              ))}
            </div>
          ) : <EmptyHint icon={FlaskConical} label="No lab results yet" hint="Uploaded lab & diagnostic files will appear here." />}
        </SectionCard>
      </section>

      {/* 7. ALLERGIES */}
      <section id="sec-allergies">
        <SectionCard icon={ShieldAlert} title={SECTION_LABELS.allergies}
          subtitle={allergies ? 'Known allergies on file' : 'No known allergies recorded'}>
          {allergies ? (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
              <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm font-body text-red-700 leading-relaxed whitespace-pre-line">{allergies}</p>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
              <Shield className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-sm font-body text-emerald-700">No known allergies recorded for this pet.</p>
            </div>
          )}
        </SectionCard>
      </section>

      {/* 8. WEIGHT & BCS HISTORY */}
      <section id="sec-weight">
        <SectionCard icon={Weight} title={SECTION_LABELS.weight} subtitle={`${weightHistory.length} measurement${weightHistory.length === 1 ? '' : 's'}`}>
          {weightHistory.length ? (
            <>
              <WeightChart petId={pet.id} weights={weightHistory} canWrite={false} onChange={() => {}} />
              <div className="mt-4 space-y-2">
                {weightHistory.slice().reverse().map(w => (
                  <div key={w.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <Weight className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-sm font-display font-600 text-slate-800 w-20">{w.weight_kg} kg</span>
                    <span className="text-xs font-body text-slate-400">BCS {w.body_condition_score ?? '—'}/9</span>
                    <span className="text-xs font-body text-slate-300 ml-auto">{today(w.recorded_at)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <EmptyHint icon={Weight} label="No weight records" hint="Weight & BCS measurements will appear here." />}
        </SectionCard>
      </section>

      {/* 9. PROCEDURES & SURGERIES */}
      <section id="sec-procedures">
        <SectionCard icon={Scissors} title={SECTION_LABELS.procedures} subtitle={`${treatments.length} procedure${treatments.length === 1 ? '' : 's'}`}>
          {treatments.length ? (
            <div className="space-y-2">
              {treatments.map(t => (
                <div key={t.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <Scissors className="w-4 h-4 text-teal-500 shrink-0" />
                      <p className="font-display text-slate-800 text-sm font-600 truncate">{t.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {t.performed_date && <span className="text-xs font-body text-slate-400">{today(t.performed_date)}</span>}
                      <StatusBadge status={t.status} />
                    </div>
                  </div>
                  {t.description && <p className="text-xs font-body text-slate-500 mt-1.5 ml-6">{t.description}</p>}
                  {t.outcome && <p className="text-xs font-body text-slate-400 mt-1 ml-6 italic">Outcome: {t.outcome}</p>}
                </div>
              ))}
            </div>
          ) : <EmptyHint icon={Scissors} label="No procedures recorded" hint="Surgeries & treatments will appear here." />}
        </SectionCard>
      </section>

      {/* 10. DOCUMENTS */}
      <section id="sec-documents">
        <SectionCard icon={FolderOpen} title={SECTION_LABELS.documents} subtitle={`${documents.length} file${documents.length === 1 ? '' : 's'}`}>
          {documents.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {documents.map(f => <FileRow key={f.id} file={f} onClick={onOpenFile} />)}
            </div>
          ) : <EmptyHint icon={FolderOpen} label="No documents" hint="X-rays, photos & paperwork will appear here." />}
        </SectionCard>
      </section>

      {/* 11. TIMELINE OF CARE */}
      <section id="sec-timeline">
        <SectionCard icon={Clock} title={SECTION_LABELS.timeline} subtitle={`${timeline.length} event${timeline.length === 1 ? '' : 's'}`}>
          {timeline.length ? (
            <div className="relative">
              <div className="absolute left-[15px] top-3 bottom-3 w-0.5 bg-gradient-to-b from-teal-300 via-teal-100 to-teal-50 rounded-full" />
              <div className="space-y-3">
                {timeline.map(ev => {
                  const meta = TIMELINE_META[ev.kind] || TIMELINE_META.visit;
                  const Icon = meta.icon;
                  return (
                    <div key={ev.event_id} className="relative pl-10">
                      <span className={`absolute left-[8px] top-3 w-3.5 h-3.5 rounded-full border-2 border-white ring-4 ${meta.ring}`} />
                      <div className="bg-white rounded-xl border border-slate-100 px-3 py-2 flex items-center gap-3">
                        <Icon className={`w-4 h-4 shrink-0 ${meta.text}`} />
                        <p className="text-sm font-body text-slate-700 flex-1 min-w-0 truncate">{ev.summary}</p>
                        <span className="text-xs font-body text-slate-300 shrink-0">{today(ev.occurred_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : <EmptyHint icon={Clock} label="No care events yet" hint="A unified timeline of visits, vaccines, meds & files." />}
        </SectionCard>
      </section>
    </div>
  );
}

const TIMELINE_META = {
  visit:       { icon: Stethoscope, ring: 'ring-teal-50 bg-teal-400',     text: 'text-teal-500' },
  vaccination: { icon: Syringe,     ring: 'ring-blue-50 bg-blue-400',     text: 'text-blue-500' },
  prescription:{ icon: Pill,        ring: 'ring-violet-50 bg-violet-400', text: 'text-violet-500' },
  treatment:   { icon: Scissors,    ring: 'ring-indigo-50 bg-indigo-400', text: 'text-indigo-500' },
  file:        { icon: FileText,    ring: 'ring-slate-100 bg-slate-400',  text: 'text-slate-500' },
};

/* ── small presentational helpers ── */
function IdentityStat({ icon: Icon, label, value }) {
  return (
    <div className="min-w-0 rounded-2xl bg-slate-50 border border-slate-100 p-4">
      <div className="flex items-center gap-2 text-slate-400 mb-1 min-w-0">
        <Icon className="w-4 h-4 shrink-0" />
        <span className="text-xs font-body font-600 uppercase tracking-wider truncate">{label}</span>
      </div>
      <p className="text-base font-display font-700 text-slate-800 truncate">{value}</p>
    </div>
  );
}

const OVERVIEW_TINT = {
  teal: 'text-teal-600 bg-teal-50', violet: 'text-violet-600 bg-violet-50', blue: 'text-blue-600 bg-blue-50',
  red: 'text-red-600 bg-red-50', amber: 'text-amber-600 bg-amber-50', cyan: 'text-cyan-600 bg-cyan-50',
  slate: 'text-slate-500 bg-slate-50',
};
function OverviewStat({ icon: Icon, label, value, tint }) {
  const t = OVERVIEW_TINT[tint] || OVERVIEW_TINT.slate;
  return (
    <div className="rounded-2xl border border-slate-100 p-4 text-center">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 ${t}`}><Icon className="w-5 h-5" /></div>
      <p className="font-display text-slate-800 text-lg font-700">{value}</p>
      <p className="text-[10px] font-body font-600 uppercase tracking-wider text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}

function HistoryField({ icon: Icon, color, label, value }) {
  return (
    <div>
      <p className={`text-xs font-body font-600 uppercase tracking-wide mb-1 flex items-center gap-1 ${color}`}>
        <Icon className="w-3 h-3" /> {label}
      </p>
      <p className="text-sm font-body text-slate-700 whitespace-pre-line leading-relaxed">{value}</p>
    </div>
  );
}

function FileRow({ file, onClick }) {
  const Icon = file.kind === 'xray' ? FlaskConical : FileText;
  return (
    <button onClick={() => onClick(file)}
      className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-teal-200 hover:bg-teal-50/40 transition-colors text-left">
      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-teal-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-display text-slate-800 text-sm font-600 truncate">{file.title}</p>
        <p className="text-slate-400 text-xs font-body truncate">
          {KIND_LABEL[file.kind] || 'File'}{fileSize(file.size_bytes) ? ` · ${fileSize(file.size_bytes)}` : ''} · {today(file.created_at)}
        </p>
      </div>
      <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
    </button>
  );
}
