/**
 * ConfinementPage.jsx
 * Pet Confinement / Boarding & Hospitalization hub for admin/vet/staff.
 *
 * Tracks pets staying at the clinic rather than going home the same
 * day -- boarding, post-op recovery, observation, IV therapy, etc.
 * Staff/vet admit a pet, add monitoring log entries while it's
 * confined, and discharge it when ready.
 */
import { useEffect, useMemo, useState } from 'react';
import { confinementService } from '../services/confinementService';
import { adminPetService } from '../services/adminPetService';
import { scheduleService } from '../services/scheduleService';
import {
  BedDouble, Plus, X, Loader2, AlertCircle, PawPrint, User, Stethoscope,
  MapPin, Clock, Check, Search, LogOut, Thermometer, HeartPulse, Wind, Scale,
} from 'lucide-react';

const TABS = [
  { key: 'active',     label: 'Active' },
  { key: 'discharged', label: 'Discharged' },
  { key: 'cancelled',  label: 'Cancelled' },
  { key: '',           label: 'All' },
];

function daysSince(iso) {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function statusPill(status) {
  const map = {
    active:     'bg-emerald-100 text-emerald-700',
    discharged: 'bg-blue-100 text-blue-700',
    cancelled:  'bg-slate-100 text-slate-500',
  };
  return map[status] || 'bg-slate-100 text-slate-500';
}

export default function ConfinementPage() {
  const [tab, setTab]         = useState('active');
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [showAdmit, setShowAdmit] = useState(false);
  const [activeId, setActiveId]   = useState(null);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const data = await confinementService.list({ status: tab || undefined });
      setItems(data || []);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load confinement records.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tab]);

  const activeConf = useMemo(() => items.find(i => i.id === activeId) || null, [items, activeId]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center shadow shadow-blue-500/30">
            <BedDouble className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display font-700 text-xl text-slate-800 dark:text-white">Confinement</h1>
            <p className="text-xs font-body text-slate-400">Pets boarding, recovering, or hospitalized at the clinic.</p>
          </div>
        </div>
        <button onClick={() => setShowAdmit(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-body font-600 text-sm shadow-lg shadow-blue-500/25 transition-all">
          <Plus className="w-4 h-4" /> Admit a pet
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-xs font-body font-600 transition-all ${
              tab === t.key ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-red-500 text-sm font-body">{error}</p>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
        </div>
      ) : !items.length ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10">
          <BedDouble className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="font-display text-slate-500 dark:text-slate-400 font-600 mb-2">No confinement records</p>
          <p className="text-slate-400 text-sm font-body mb-5">Admit a pet to start tracking their stay.</p>
          <button onClick={() => setShowAdmit(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-body font-600 hover:bg-blue-700 transition-all">
            <Plus className="w-4 h-4" /> Admit a pet
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((c) => (
            <button key={c.id} onClick={() => setActiveId(c.id)} type="button"
              className="text-left bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm p-4 hover:border-blue-300 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <PawPrint className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-display font-700 text-slate-800 dark:text-white truncate">{c.pet_name}</p>
                    <p className="text-xs text-slate-400 font-body truncate">{c.pet_species}{c.pet_breed ? ` · ${c.pet_breed}` : ''}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-700 uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${statusPill(c.status)}`}>
                  {c.status}
                </span>
              </div>
              <p className="text-sm font-body text-slate-600 dark:text-slate-300 line-clamp-2 mb-2">{c.reason}</p>
              <div className="flex items-center gap-3 text-xs font-body text-slate-400 flex-wrap">
                <span className="flex items-center gap-1"><User className="w-3 h-3" /> {c.client_name}</span>
                {c.vet_name && <span className="flex items-center gap-1"><Stethoscope className="w-3 h-3" /> {c.vet_name}</span>}
                {c.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {c.location}</span>}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-50 dark:border-white/5 flex items-center gap-1.5 text-xs font-body text-slate-500">
                <Clock className="w-3 h-3" />
                {c.status === 'active'
                  ? `Admitted ${daysSince(c.admitted_at)}d ago`
                  : `${c.status === 'discharged' ? 'Discharged' : 'Cancelled'} ${new Date(c.discharged_at || c.updated_at).toLocaleDateString()}`}
              </div>
            </button>
          ))}
        </div>
      )}

      {showAdmit && (
        <AdmitModal
          onClose={() => setShowAdmit(false)}
          onAdmitted={() => { setShowAdmit(false); setTab('active'); load(); }}
        />
      )}

      {activeConf && (
        <DetailModal
          confinement={activeConf}
          onClose={() => setActiveId(null)}
          onChanged={() => { load(); }}
        />
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   ADMIT MODAL
   ═══════════════════════════════════════════════════════════════ */

function AdmitModal({ onClose, onAdmitted }) {
  const [q, setQ]               = useState('');
  const [results, setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [pet, setPet]           = useState(null);
  const [vets, setVets]         = useState([]);
  const [vetId, setVetId]       = useState('');
  const [location, setLocation] = useState('');
  const [reason, setReason]     = useState('');
  const [expected, setExpected] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr]           = useState('');

  useEffect(() => {
    scheduleService.getAllVets().then(setVets).catch(() => setVets([]));
  }, []);

  useEffect(() => {
    if (pet || !q.trim()) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(() => {
      adminPetService.list({ q: q.trim(), limit: 8 })
        .then((r) => { if (!cancelled) setResults(r?.items || []); })
        .catch(() => { if (!cancelled) setResults([]); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, pet]);

  const submit = async (e) => {
    e.preventDefault();
    if (!pet) { setErr('Pick a pet first.'); return; }
    if (!reason.trim()) { setErr('Reason is required.'); return; }
    setSubmitting(true); setErr('');
    try {
      await confinementService.admit({
        petId:               pet.id,
        vetId:                vetId || null,
        location:             location.trim() || null,
        reason:               reason.trim(),
        expectedDischargeAt:  expected ? new Date(expected).toISOString() : null,
      });
      onAdmitted();
    } catch (e2) {
      setErr(e2?.response?.data?.error || 'Failed to admit pet.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/10 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h2 className="font-display text-slate-800 dark:text-white text-lg font-700">Admit a pet</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {err && (
            <p className="bg-red-50 border border-red-100 text-red-600 text-sm font-body px-3 py-2 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {err}
            </p>
          )}

          <div>
            <label className="block text-[10px] uppercase tracking-wider font-body font-600 text-slate-400 mb-1.5">Pet</label>
            {pet ? (
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-blue-200 bg-blue-50">
                <div className="flex items-center gap-2.5">
                  <PawPrint className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="text-sm font-body font-600 text-slate-700 dark:text-slate-200">{pet.name}</p>
                    <p className="text-xs text-slate-400 font-body">{pet.species}{pet.breed ? ` · ${pet.breed}` : ''} · Owner: {pet.owner?.name}</p>
                  </div>
                </div>
                <button type="button" onClick={() => { setPet(null); setQ(''); }}
                  className="text-xs text-blue-600 font-body font-600 hover:underline">Change</button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-white/5 rounded-lg px-2.5 py-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input value={q} onChange={(e) => setQ(e.target.value)}
                    placeholder="Search by pet name, breed, or owner…"
                    className="flex-1 bg-transparent outline-none text-sm font-body text-slate-700 dark:text-slate-200 placeholder:text-slate-400" />
                  {searching && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                </div>
                {results.length > 0 && (
                  <ul className="mt-1.5 border border-slate-100 dark:border-white/10 rounded-xl overflow-hidden divide-y divide-slate-50 dark:divide-white/5 max-h-48 overflow-y-auto">
                    {results.map((r) => (
                      <li key={r.id}>
                        <button type="button" onClick={() => { setPet(r); setResults([]); }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/5 text-sm font-body">
                          <span className="font-600 text-slate-700 dark:text-slate-200">{r.name}</span>
                          <span className="text-slate-400"> · {r.species}{r.breed ? ` · ${r.breed}` : ''} · Owner: {r.owner?.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[10px] uppercase tracking-wider font-body font-600 text-slate-400 mb-1">Attending vet (optional)</span>
              <select value={vetId} onChange={(e) => setVetId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-sm font-body bg-white dark:bg-slate-800">
                <option value="">No preference</option>
                {vets.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-[10px] uppercase tracking-wider font-body font-600 text-slate-400 mb-1">Location (optional)</span>
              <input value={location} onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Kennel 3"
                className="w-full rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-sm font-body bg-white dark:bg-slate-800" />
            </label>
          </div>

          <label className="block">
            <span className="block text-[10px] uppercase tracking-wider font-body font-600 text-slate-400 mb-1">Reason for confinement</span>
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Post-op recovery after spay surgery"
              className="w-full rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-sm font-body bg-white dark:bg-slate-800" />
          </label>

          <label className="block">
            <span className="block text-[10px] uppercase tracking-wider font-body font-600 text-slate-400 mb-1">Expected discharge (optional)</span>
            <input type="datetime-local" value={expected} onChange={(e) => setExpected(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-sm font-body bg-white dark:bg-slate-800" />
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 text-sm font-body">Cancel</button>
            <button type="submit" disabled={submitting}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-body font-600 shadow-md shadow-blue-500/20 disabled:opacity-50">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Admit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   DETAIL MODAL — log timeline, add log, discharge
   ═══════════════════════════════════════════════════════════════ */

function DetailModal({ confinement, onClose, onChanged }) {
  const [logs, setLogs]         = useState([]);
  const [loadingLogs, setLL]    = useState(true);
  const [note, setNote]         = useState('');
  const [temp, setTemp]         = useState('');
  const [hr, setHr]             = useState('');
  const [rr, setRr]             = useState('');
  const [wt, setWt]             = useState('');
  const [addingLog, setAddingLog] = useState(false);
  const [logErr, setLogErr]     = useState('');
  const [showDischarge, setShowDischarge] = useState(false);
  const [dischargeNotes, setDischargeNotes] = useState('');
  const [discharging, setDischarging] = useState(false);

  const loadLogs = () => {
    setLL(true);
    confinementService.listLogs(confinement.id)
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLL(false));
  };

  useEffect(() => { loadLogs(); }, [confinement.id]);

  const addLog = async (e) => {
    e.preventDefault();
    if (!note.trim() && !temp && !hr && !rr && !wt) { setLogErr('Add a note or at least one vital sign.'); return; }
    setAddingLog(true); setLogErr('');
    try {
      await confinementService.addLog(confinement.id, {
        note:            note.trim() || undefined,
        temperatureC:    temp ? Number(temp) : undefined,
        heartRateBpm:    hr   ? Number(hr)   : undefined,
        respirationRate: rr   ? Number(rr)   : undefined,
        weightKg:        wt   ? Number(wt)   : undefined,
      });
      setNote(''); setTemp(''); setHr(''); setRr(''); setWt('');
      loadLogs();
    } catch (e2) {
      setLogErr(e2?.response?.data?.error || 'Failed to add log entry.');
    } finally { setAddingLog(false); }
  };

  const submitDischarge = async () => {
    setDischarging(true);
    try {
      await confinementService.discharge(confinement.id, dischargeNotes.trim() || undefined);
      onChanged();
      onClose();
    } catch (e2) {
      alert(e2?.response?.data?.error || 'Failed to discharge.');
      setDischarging(false);
    }
  };

  const isActive = confinement.status === 'active';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/10 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div>
            <h2 className="font-display text-slate-800 dark:text-white text-lg font-700">{confinement.pet_name}</h2>
            <p className="text-xs text-slate-400 font-body">{confinement.pet_species}{confinement.pet_breed ? ` · ${confinement.pet_breed}` : ''} · Owner: {confinement.client_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className={`rounded-xl p-3 ${statusPill(confinement.status)}`}>
            <p className="text-sm font-body font-600">{confinement.reason}</p>
            <div className="flex items-center gap-3 text-xs font-body mt-1 opacity-80 flex-wrap">
              {confinement.vet_name && <span className="flex items-center gap-1"><Stethoscope className="w-3 h-3" /> {confinement.vet_name}</span>}
              {confinement.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {confinement.location}</span>}
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Admitted {new Date(confinement.admitted_at).toLocaleString()}</span>
            </div>
            {confinement.status === 'discharged' && (
              <p className="text-xs font-body mt-1.5 opacity-80">
                Discharged {new Date(confinement.discharged_at).toLocaleString()}
                {confinement.discharge_notes ? ` — ${confinement.discharge_notes}` : ''}
              </p>
            )}
          </div>

          {isActive && (
            <div className="rounded-xl border border-slate-100 dark:border-white/10 p-3">
              <p className="text-xs font-body font-600 uppercase tracking-wider text-slate-400 mb-2">Add a monitoring note</p>
              {logErr && <p className="text-xs font-body text-red-500 mb-2">{logErr}</p>}
              <form onSubmit={addLog} className="space-y-2.5">
                <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="Fed, medicated, resting comfortably, etc."
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-sm font-body bg-white dark:bg-slate-800" />
                <div className="grid grid-cols-4 gap-2">
                  <VitalInput icon={Thermometer} value={temp} onChange={setTemp} placeholder="Temp °C" step="0.1" />
                  <VitalInput icon={HeartPulse}  value={hr}   onChange={setHr}   placeholder="HR bpm" />
                  <VitalInput icon={Wind}        value={rr}   onChange={setRr}   placeholder="Resp/min" />
                  <VitalInput icon={Scale}       value={wt}   onChange={setWt}   placeholder="Weight kg" step="0.1" />
                </div>
                <div className="flex justify-end">
                  <button type="submit" disabled={addingLog}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-body font-600 disabled:opacity-50">
                    {addingLog ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add note
                  </button>
                </div>
              </form>
            </div>
          )}

          <div>
            <p className="text-xs font-body font-600 uppercase tracking-wider text-slate-400 mb-2">Monitoring log</p>
            {loadingLogs ? (
              <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-slate-300" /></div>
            ) : !logs.length ? (
              <p className="text-sm text-slate-400 font-body text-center py-6 bg-slate-50 dark:bg-white/5 rounded-xl">No entries yet.</p>
            ) : (
              <ul className="space-y-2">
                {logs.map((l) => (
                  <li key={l.id} className="p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-body font-600 text-slate-600 dark:text-slate-300">{l.logger?.name || 'Staff'}</span>
                      <span className="text-[10px] text-slate-400 font-body">{new Date(l.created_at).toLocaleString()}</span>
                    </div>
                    {l.note && <p className="text-sm font-body text-slate-700 dark:text-slate-200">{l.note}</p>}
                    {(l.temperature_c != null || l.heart_rate_bpm != null || l.respiration_rate != null || l.weight_kg != null) && (
                      <div className="flex items-center gap-3 text-xs font-body text-slate-500 mt-1 flex-wrap">
                        {l.temperature_c != null && <span>🌡 {l.temperature_c}°C</span>}
                        {l.heart_rate_bpm != null && <span>♥ {l.heart_rate_bpm} bpm</span>}
                        {l.respiration_rate != null && <span>💨 {l.respiration_rate}/min</span>}
                        {l.weight_kg != null && <span>⚖ {l.weight_kg} kg</span>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {isActive && (
            <div className="pt-2 border-t border-slate-100 dark:border-white/10">
              {!showDischarge ? (
                <button onClick={() => setShowDischarge(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-body font-600">
                  <LogOut className="w-4 h-4" /> Discharge
                </button>
              ) : (
                <div className="space-y-2">
                  <textarea rows={2} value={dischargeNotes} onChange={(e) => setDischargeNotes(e.target.value)}
                    placeholder="Discharge notes for the owner (optional)"
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-sm font-body bg-white dark:bg-slate-800" />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowDischarge(false)}
                      className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 text-sm font-body">Cancel</button>
                    <button onClick={submitDischarge} disabled={discharging}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-body font-600 disabled:opacity-50">
                      {discharging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Confirm discharge
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VitalInput({ icon: Icon, value, onChange, placeholder, step }) {
  return (
    <label className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/10 px-2 py-1.5 bg-white dark:bg-slate-800">
      <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <input type="number" step={step || '1'} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full min-w-0 bg-transparent outline-none text-xs font-body text-slate-700 dark:text-slate-200 placeholder:text-slate-400" />
    </label>
  );
}
