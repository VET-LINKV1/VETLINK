/**
 * EMRPage.jsx
 * Top-level Electronic Medical Records workspace.
 *
 * Layout (lg+):
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ Header (search, role badge)                             │
 *   ├──────────────┬──────────────────────────────────────────┤
 *   │ Clients/Pets │ Pet header  +  vital stats               │
 *   │ navigator    │ Tabs: Timeline · SOAP · Vax · Rx · Tx · Files │
 *   │ (sticky)     │ Active tab content                       │
 *   └──────────────┴──────────────────────────────────────────┘
 *
 * Roles:
 *   admin / vet     full read + write
 *   staff           full read + file upload
 *   client          (won't normally hit this route — sees client chart instead)
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Search, Stethoscope, Syringe, Pill, Activity, FileText, BarChart3,
  Loader2, X, Plus, Filter, PawPrint, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { emrService } from '../../services/emrService';
import { medicalRecordService } from '../../services/medicalRecordService';

import ClientPetSelector  from '../../components/emr/ClientPetSelector';
import EMRTimeline        from '../../components/emr/EMRTimeline';
import SOAPNoteList       from '../../components/emr/SOAPNoteList';
import SOAPEditor         from '../../components/emr/SOAPEditor';
import VaccinationTracker from '../../components/emr/VaccinationTracker';
import PrescriptionManager from '../../components/emr/PrescriptionManager';
import TreatmentTracker   from '../../components/emr/TreatmentTracker';
import EMRFileGallery     from '../../components/emr/EMRFileGallery';

const TABS = [
  { key: 'timeline',      label: 'Timeline',      icon: BarChart3    },
  { key: 'soap',          label: 'SOAP Notes',    icon: Stethoscope },
  { key: 'vaccinations',  label: 'Vaccinations',  icon: Syringe     },
  { key: 'prescriptions', label: 'Prescriptions', icon: Pill        },
  { key: 'treatments',    label: 'Treatments',    icon: Activity    },
  { key: 'files',         label: 'Files',         icon: FileText    },
];

const TIMELINE_FILTERS = [
  { key: 'visit',        label: 'Visits'        },
  { key: 'vaccination',  label: 'Vaccinations'  },
  { key: 'prescription', label: 'Prescriptions' },
  { key: 'treatment',    label: 'Treatments'    },
  { key: 'file',         label: 'Files'         },
];

export default function EMRPage() {
  const { user } = useAuth();
  const role = user?.role;
  const canWrite = role === 'admin' || role === 'veterinarian';

  const [clients, setClients]           = useState([]);
  const [selectedPet, setSelectedPet]   = useState(null);
  const [chart, setChart]               = useState(null);
  const [timeline, setTimeline]         = useState([]);
  const [tab, setTab]                   = useState('timeline');
  const [activeFilters, setActiveFilters] = useState(new Set());

  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingChart, setLoadingChart]     = useState(false);
  const [err, setErr] = useState('');

  // Global search
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);

  // SOAP editor state
  const [soapForRecord, setSoapForRecord] = useState(null);  // medical_record id awaiting new SOAP
  const [editingSoap, setEditingSoap]     = useState(null);

  /* ── data loaders ───────────────────────────────────────── */
  const loadClients = useCallback(async () => {
    setLoadingClients(true); setErr('');
    try {
      const data = await emrService.listClientsWithPets();
      setClients(data || []);
      if (!selectedPet && data?.[0]?.pets?.[0]) {
        setSelectedPet({ ...data[0].pets[0], _owner: data[0] });
      }
    } catch (e) {
      setErr(e?.response?.data?.error || 'Failed to load clients.');
    } finally { setLoadingClients(false); }
  }, [selectedPet]);

  const loadChart = useCallback(async (petId) => {
    if (!petId) return;
    setLoadingChart(true); setErr('');
    try {
      const [c, tl] = await Promise.all([
        emrService.getPetChart(petId),
        emrService.getPetTimeline(petId, { limit: 200 }),
      ]);
      setChart(c);
      setTimeline(tl);
    } catch (e) {
      setErr(e?.response?.data?.error || 'Failed to load pet chart.');
    } finally { setLoadingChart(false); }
  }, []);

  const refreshTimeline = useCallback(async () => {
    if (!selectedPet) return;
    try {
      const tl = await emrService.getPetTimeline(selectedPet.id, { limit: 200 });
      setTimeline(tl);
    } catch (_) {}
  }, [selectedPet]);

  useEffect(() => { loadClients(); }, []); // eslint-disable-line
  useEffect(() => { if (selectedPet) loadChart(selectedPet.id); }, [selectedPet?.id, loadChart]);

  /* ── search ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!query || query.trim().length < 2) { setSearchResults(null); return; }
    const id = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await emrService.search({ q: query.trim(), limit: 10 });
        setSearchResults(data);
      } catch (_) { setSearchResults(null); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  /* ── filters ────────────────────────────────────────────── */
  const visibleTimeline = useMemo(() => {
    if (!activeFilters.size) return timeline;
    return timeline.filter((e) => activeFilters.has(e.kind));
  }, [timeline, activeFilters]);

  const toggleFilter = (k) => {
    setActiveFilters((s) => {
      const next = new Set(s);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  };

  /* ── SOAP helpers ───────────────────────────────────────── */
  const handleCreateSoap = async (payload) => {
    await emrService.createSoap(payload);
    setSoapForRecord(null);
    loadChart(selectedPet.id);
  };
  const handleUpdateSoap = async (payload) => {
    await emrService.updateSoap(editingSoap.id, payload);
    setEditingSoap(null);
    loadChart(selectedPet.id);
  };
  const handleDeleteSoap = async (note) => {
    if (!confirm('Delete this SOAP note?')) return;
    try { await emrService.deleteSoap(note.id); loadChart(selectedPet.id); } catch (_) {}
  };

  /* ── quick "Create medical record" so SOAP has a parent ─── */
  const [creatingRec, setCreatingRec] = useState(false);
  const [recForm, setRecForm] = useState({ diagnosis: '', treatment: '', notes: '' });
  const createRecord = async (e) => {
    e.preventDefault();
    if (!selectedPet) return;
    setCreatingRec(true);
    try {
      const rec = await medicalRecordService.create({
        petId:     selectedPet.id,
        visitDate: new Date().toISOString().slice(0, 10),
        diagnosis: recForm.diagnosis || 'Routine visit',
        treatment: recForm.treatment,
        notes:     recForm.notes,
      });
      setRecForm({ diagnosis: '', treatment: '', notes: '' });
      await loadChart(selectedPet.id);
      // Auto-open SOAP editor on the new record
      setSoapForRecord(rec.id);
      setTab('soap');
    } catch (e2) {
      alert(e2?.response?.data?.error || 'Failed to create medical record.');
    } finally { setCreatingRec(false); }
  };

  /* ── render ─────────────────────────────────────────────── */
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-slate-800 dark:text-white text-2xl font-700">
            EMR Workspace
          </h1>
          <p className="text-slate-400 dark:text-slate-500 font-body text-sm mt-0.5">
            Advanced electronic medical records — SOAP notes, timeline, vaccinations, prescriptions, files.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-body font-600 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
            <ShieldCheck className="w-3.5 h-3.5" />
            {role === 'admin' ? 'Admin'
              : role === 'veterinarian' ? 'Veterinarian'
              : role === 'staff' ? 'Staff'
              : 'User'}
          </span>
        </div>
      </div>

      {/* Global search */}
      <div className="relative">
        <label className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-white/10 px-3 py-2 shadow-sm">
          <Search className="w-4 h-4 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search diagnoses, SOAP notes, prescriptions, treatments, files…"
            className="flex-1 bg-transparent outline-none text-sm font-body text-slate-700 dark:text-slate-200" />
          {searching && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
          {!!query && (
            <button onClick={() => setQuery('')} className="p-1 rounded-md text-slate-400 hover:bg-slate-100">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </label>
        {searchResults && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-xl shadow-xl max-h-96 overflow-y-auto scrollbar-thin">
            <SearchResults results={searchResults} onClose={() => setQuery('')} />
          </div>
        )}
      </div>

      {err && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 text-sm font-body px-3 py-2 rounded-lg">
          {err}
        </div>
      )}

      {/* Workspace grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-5">
        {/* Sidebar */}
        <div className="lg:sticky lg:top-4 lg:self-start h-[70vh] lg:h-[80vh]">
          {loadingClients ? (
            <div className="h-full flex items-center justify-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10">
              <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
            </div>
          ) : (
            <ClientPetSelector
              clients={clients}
              selectedPetId={selectedPet?.id}
              onSelectPet={(pet, client) => setSelectedPet({ ...pet, _owner: client })}
            />
          )}
        </div>

        {/* Main pane */}
        <div className="min-w-0 space-y-4">
          {!selectedPet ? (
            <EmptyPane />
          ) : (
            <>
              <PetHeader pet={selectedPet} chart={chart} canWrite={canWrite}
                onQuickRecord={createRecord}
                recForm={recForm} setRecForm={setRecForm}
                creating={creatingRec} />

              {/* Tabs */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 p-1 flex flex-wrap gap-1 overflow-x-auto scrollbar-thin">
                {TABS.map(({ key, label, icon: Icon }) => (
                  <button key={key} onClick={() => setTab(key)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-body font-600 whitespace-nowrap transition-colors
                      ${tab === key
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                    <Icon className="w-4 h-4" /> {label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl p-5">
                {loadingChart ? (
                  <div className="h-40 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
                  </div>
                ) : (
                  <>
                    {tab === 'timeline' && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Filter className="w-4 h-4 text-slate-400" />
                          {TIMELINE_FILTERS.map(({ key, label }) => {
                            const active = activeFilters.has(key);
                            return (
                              <button key={key} onClick={() => toggleFilter(key)}
                                className={`text-xs font-body font-600 px-2.5 py-1 rounded-lg border transition-colors
                                  ${active
                                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                {label}
                              </button>
                            );
                          })}
                          {!!activeFilters.size && (
                            <button onClick={() => setActiveFilters(new Set())}
                              className="text-xs font-body text-slate-400 hover:text-slate-600">
                              Clear filters
                            </button>
                          )}
                        </div>
                        <EMRTimeline events={visibleTimeline} />
                      </div>
                    )}

                    {tab === 'soap' && (
                      <div className="space-y-4">
                        {canWrite && chart?.recentRecords?.length > 0 && (
                          <details className="bg-slate-50 dark:bg-white/5 rounded-xl p-4">
                            <summary className="cursor-pointer text-sm font-body font-600 text-slate-700 dark:text-slate-200">
                              + New SOAP note for a recent visit
                            </summary>
                            <div className="mt-3 space-y-2">
                              {chart.recentRecords.slice(0, 5).map((r) => {
                                const hasNote = chart.recentSoapNotes.some(n => n.medical_record_id === r.id);
                                return (
                                  <button key={r.id} disabled={hasNote}
                                    onClick={() => setSoapForRecord(r.id)}
                                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-white dark:hover:bg-slate-900 disabled:opacity-50 text-left">
                                    <span className="text-sm font-body text-slate-700 dark:text-slate-200 truncate">
                                      {new Date(r.visit_date).toLocaleDateString()} — {r.diagnosis}
                                    </span>
                                    <span className="text-xs text-slate-400">
                                      {hasNote ? 'has SOAP' : 'add SOAP →'}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </details>
                        )}

                        {soapForRecord && (
                          <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4">
                            <p className="text-xs font-body font-600 text-slate-500 uppercase tracking-wide mb-3">
                              New SOAP note
                            </p>
                            <SOAPEditor
                              medicalRecordId={soapForRecord}
                              onSave={handleCreateSoap}
                              onCancel={() => setSoapForRecord(null)} />
                          </div>
                        )}
                        {editingSoap && (
                          <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4">
                            <p className="text-xs font-body font-600 text-slate-500 uppercase tracking-wide mb-3">
                              Edit SOAP note
                            </p>
                            <SOAPEditor isEdit initial={editingSoap}
                              onSave={handleUpdateSoap}
                              onCancel={() => setEditingSoap(null)} />
                          </div>
                        )}

                        <SOAPNoteList
                          notes={chart?.recentSoapNotes || []}
                          canWrite={canWrite}
                          onEdit={setEditingSoap}
                          onDelete={handleDeleteSoap} />
                      </div>
                    )}

                    {tab === 'vaccinations' && (
                      <VaccinationTracker
                        petId={selectedPet.id}
                        vaccinations={chart?.vaccinations || []}
                        canWrite={canWrite}
                        onChange={() => { loadChart(selectedPet.id); refreshTimeline(); }} />
                    )}

                    {tab === 'prescriptions' && (
                      <PrescriptionManager
                        petId={selectedPet.id}
                        prescriptions={chart?.prescriptions || []}
                        canWrite={canWrite}
                        onChange={() => { loadChart(selectedPet.id); refreshTimeline(); }} />
                    )}

                    {tab === 'treatments' && (
                      <TreatmentTracker
                        petId={selectedPet.id}
                        treatments={chart?.treatments || []}
                        canWrite={canWrite}
                        onChange={() => { loadChart(selectedPet.id); refreshTimeline(); }} />
                    )}

                    {tab === 'files' && (
                      <EMRFileGallery
                        petId={selectedPet.id}
                        files={chart?.files || []}
                        canWrite={role === 'admin' || role === 'veterinarian' || role === 'staff'}
                        onChange={() => { loadChart(selectedPet.id); refreshTimeline(); }} />
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


/* ─────────────────────────── sub-components ─────────────────────────── */

function PetHeader({ pet, chart, canWrite, onQuickRecord, recForm, setRecForm, creating }) {
  if (!pet) return null;
  const activeRx = (chart?.prescriptions || []).filter(p => p.status === 'active').length;
  const dueVax   = (chart?.vaccinations  || []).filter(v => v.status === 'scheduled' || v.status === 'overdue').length;
  const openTx   = (chart?.treatments    || []).filter(t => t.status !== 'completed' && t.status !== 'cancelled').length;
  const files    = (chart?.files || []).length;

  return (
    <div className="bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 text-white rounded-2xl p-5 shadow-lg shadow-blue-500/20">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center">
            <PawPrint className="w-7 h-7" />
          </div>
          <div>
            <p className="font-display text-2xl font-700">{pet.name}</p>
            <p className="font-body text-sm text-blue-100 opacity-90">
              {pet.species}{pet.breed ? ` · ${pet.breed}` : ''}
              {pet.age != null ? ` · ${pet.age}y` : ''}
              {pet.gender ? ` · ${pet.gender}` : ''}
              {pet.weight_kg ? ` · ${pet.weight_kg} kg` : ''}
            </p>
            {pet._owner && (
              <p className="font-body text-xs text-blue-100/80 mt-1">
                Owner: {pet._owner.name} {pet._owner.email ? `· ${pet._owner.email}` : ''}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <Stat label="Active Rx"  value={activeRx} />
          <Stat label="Due / Overdue Vax" value={dueVax} />
          <Stat label="Open Tx"    value={openTx} />
          <Stat label="Files"      value={files} />
        </div>
      </div>

      {canWrite && (
        <form onSubmit={onQuickRecord} className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2">
          <input required placeholder="Diagnosis"
            value={recForm.diagnosis} onChange={(e) => setRecForm({ ...recForm, diagnosis: e.target.value })}
            className="rounded-lg bg-white/10 border border-white/20 placeholder:text-blue-100/70 text-white px-3 py-2 text-sm font-body focus:outline-none focus:bg-white/15" />
          <input placeholder="Treatment"
            value={recForm.treatment} onChange={(e) => setRecForm({ ...recForm, treatment: e.target.value })}
            className="rounded-lg bg-white/10 border border-white/20 placeholder:text-blue-100/70 text-white px-3 py-2 text-sm font-body focus:outline-none focus:bg-white/15" />
          <input placeholder="Notes"
            value={recForm.notes} onChange={(e) => setRecForm({ ...recForm, notes: e.target.value })}
            className="rounded-lg bg-white/10 border border-white/20 placeholder:text-blue-100/70 text-white px-3 py-2 text-sm font-body focus:outline-none focus:bg-white/15" />
          <button type="submit" disabled={creating}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-white text-blue-700 px-4 py-2 text-sm font-body font-600 disabled:opacity-60">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add visit
          </button>
        </form>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-white/10 rounded-xl px-3 py-2 min-w-[64px]">
      <p className="font-display text-2xl font-700 leading-tight">{value}</p>
      <p className="font-body text-[10px] uppercase tracking-wide text-blue-100/80">{label}</p>
    </div>
  );
}

function EmptyPane() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl p-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/5 mx-auto flex items-center justify-center mb-4">
        <PawPrint className="w-7 h-7 text-slate-300" />
      </div>
      <p className="font-display text-slate-600 dark:text-slate-300 font-600">
        Select a pet to open their chart
      </p>
      <p className="text-sm text-slate-400 font-body mt-1">
        Choose from the client list on the left.
      </p>
    </div>
  );
}

function SearchResults({ results, onClose }) {
  const { records, soap, prescriptions, treatments, files } = results || {};
  const empty = !records?.length && !soap?.length && !prescriptions?.length && !treatments?.length && !files?.length;
  if (empty) return <p className="p-4 text-sm text-slate-400 font-body">No matches.</p>;

  const Section = ({ title, items, render }) => items?.length ? (
    <div className="border-b border-slate-100 dark:border-white/5 last:border-b-0">
      <p className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider font-body font-600 text-slate-400">{title}</p>
      <ul>
        {items.map((it, i) => (
          <li key={(it.id || i) + title} className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-white/5">
            {render(it)}
          </li>
        ))}
      </ul>
    </div>
  ) : null;

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-white/5">
        <p className="text-xs font-body font-600 text-slate-500">Search results</p>
        <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:bg-slate-100">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <Section title="Medical Records" items={records} render={(r) => (
        <p className="text-sm font-body text-slate-700 dark:text-slate-200">{r.diagnosis}
          <span className="text-xs text-slate-400 ml-2">{new Date(r.visit_date).toLocaleDateString()}</span></p>
      )} />
      <Section title="SOAP Notes" items={soap} render={(s) => (
        <p className="text-sm font-body text-slate-700 dark:text-slate-200 line-clamp-2">
          {s.assessment || s.subjective || s.objective || s.plan}
        </p>
      )} />
      <Section title="Prescriptions" items={prescriptions} render={(r) => (
        <p className="text-sm font-body text-slate-700 dark:text-slate-200">
          {r.medication_name} · {r.dosage} · {r.frequency}
        </p>
      )} />
      <Section title="Treatments" items={treatments} render={(t) => (
        <p className="text-sm font-body text-slate-700 dark:text-slate-200">{t.name} ({t.status})</p>
      )} />
      <Section title="Files" items={files} render={(f) => (
        <p className="text-sm font-body text-slate-700 dark:text-slate-200">{f.title}
          <span className="text-xs text-slate-400 ml-2">{f.kind}</span></p>
      )} />
    </div>
  );
}
