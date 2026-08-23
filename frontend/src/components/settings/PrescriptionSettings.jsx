/**
 * PrescriptionSettings.jsx
 * Medication catalog, dosage/frequency units, refill rules, validity,
 * veterinarian approval workflow.
 */
import { useState, useEffect } from 'react';
import { Pill, FlaskConical, Repeat, Clock, ShieldCheck, CheckCircle2, Trash2 } from 'lucide-react';
import { settingsService } from '../../services/settingsService';
import { SettingCard, Field, TextInput, Select, Toggle, FormFooter, Note, ConfirmDialog, ChipList, ErrorCard } from './primitives';

function SettingsSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
              <div className="h-3 w-56 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PrescriptionSettings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState('');
  const [error, setError] = useState(null);
  const [showAddMed, setShowAddMed] = useState(false);
  const [medDraft, setMedDraft] = useState({ name: '', form: 'Tablet', unit: 'mg' });

  useEffect(() => {
    settingsService.getSection('prescriptions')
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { console.error(e); setError('Failed to load prescription settings. Is the backend running and the Phase 20 migration applied?'); setLoading(false); });
  }, []);

  const rx = data;

  const set = async (patch) => {
    await settingsService.updateSection('prescriptions', { ...data, ...patch });
    setData(d => ({ ...d, ...patch }));
  };

  const addMed = () => {
    if (!medDraft.name.trim()) return;
    set({ catalog: [...rx.catalog, { ...medDraft, name: medDraft.name.trim() }] });
    setMedDraft({ name: '', form: 'Tablet', unit: 'mg' });
    setShowAddMed(false);
  };
  const removeMed = (name) => set({ catalog: rx.catalog.filter(m => m.name !== name) });

  const handleSave = async () => {
    setSaving(true);
    await settingsService.updateSection('prescriptions', data, 'Updated prescription settings');
    setLastSaved(`Saved ${new Date().toLocaleTimeString()}`);
    setSaving(false);
  };

  const handleReset = async () => {
    await settingsService.resetSection('prescriptions');
    const d = await settingsService.getSection('prescriptions');
    setData(d);
  };

  if (loading) return <SettingsSkeleton />;
  if (error) return <ErrorCard message={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="space-y-5">
      <SettingCard title="Medication Catalog" subtitle="Medications available when writing prescriptions." icon={Pill}>
        <div className="space-y-2">
          {rx.catalog.map((m) => (
            <div key={m.name} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-white/5">
              <div className="flex items-center gap-3">
                <FlaskConical className="w-4 h-4 text-blue-500" />
                <div>
                  <p className="font-body text-sm font-600 text-slate-700 dark:text-slate-200">{m.name}</p>
                  <p className="text-xs font-body text-slate-400">{m.form} · {m.unit}</p>
                </div>
              </div>
              <button onClick={() => removeMed(m.name)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        {showAddMed ? (
          <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-slate-200 dark:border-white/10">
            <TextInput placeholder="Medication name" value={medDraft.name} onChange={e => setMedDraft(d => ({ ...d, name: e.target.value }))} className="flex-1 min-w-[10rem]" />
            <Select value={medDraft.form} onChange={e => setMedDraft(d => ({ ...d, form: e.target.value }))} className="w-44">
              {['Tablet','Capsule','Oral Suspension','Injectable','Topical','Drop'].map(f => <option key={f} value={f}>{f}</option>)}
            </Select>
            <Select value={medDraft.unit} onChange={e => setMedDraft(d => ({ ...d, unit: e.target.value }))} className="w-28">
              {rx.dosageUnits.map(u => <option key={u} value={u}>{u}</option>)}
            </Select>
            <button onClick={addMed} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-body font-600">Add</button>
          </div>
        ) : (
          <button onClick={() => setShowAddMed(true)} className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 text-sm font-body font-600 hover:bg-slate-200 dark:hover:bg-white/10">
            + Add medication
          </button>
        )}
      </SettingCard>

      <SettingCard title="Dosage & Frequency" subtitle="Standard units and schedule options." icon={FlaskConical}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Dosage units" htmlFor="rxdose">
            <ChipList items={rx.dosageUnits} onAdd={(v) => set({ dosageUnits: [...rx.dosageUnits, v] })} onRemove={(v) => set({ dosageUnits: rx.dosageUnits.filter(x => x !== v) })} placeholder="Add unit" />
          </Field>
          <Field label="Frequency options" htmlFor="rxfreq">
            <ChipList items={rx.frequencyOptions} onAdd={(v) => set({ frequencyOptions: [...rx.frequencyOptions, v] })} onRemove={(v) => set({ frequencyOptions: rx.frequencyOptions.filter(x => x !== v) })} placeholder="Add frequency" />
          </Field>
        </div>
      </SettingCard>

      <SettingCard title="Refills & Validity" subtitle="Refill limits and prescription lifetime." icon={Repeat}>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Max refills" htmlFor="rxmaxr">
            <TextInput id="rxmaxr" type="number" min="0" value={rx.maxRefills} onChange={e => set({ maxRefills: Number(e.target.value) })} />
          </Field>
          <Field label="Refill lead time (days)" htmlFor="rxlead">
            <TextInput id="rxlead" type="number" min="0" value={rx.refillLeadDays} onChange={e => set({ refillLeadDays: Number(e.target.value) })} />
          </Field>
          <Field label="Validity (days)" htmlFor="rxval">
            <TextInput id="rxval" type="number" min="1" value={rx.validityDays} onChange={e => set({ validityDays: Number(e.target.value) })} />
          </Field>
        </div>
      </SettingCard>

      <SettingCard title="Veterinarian Approval" subtitle="Workflow gate before a prescription is issued." icon={ShieldCheck}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-body text-slate-700 dark:text-slate-200">Require veterinarian approval</p>
            <p className="text-xs font-body text-slate-400">A licensed vet must sign off on every prescription.</p>
          </div>
          <Toggle checked={rx.requireVetApproval} onChange={v => set({ requireVetApproval: v })} label="Require approval" />
        </div>
        {rx.requireVetApproval && (
          <Field label="Approval threshold (max daily dose before senior review)" htmlFor="rxthr">
            <TextInput id="rxthr" type="number" min="0" value={rx.approvalThreshold} onChange={e => set({ approvalThreshold: Number(e.target.value) })} />
          </Field>
        )}
        <Note tone="info">Approved prescriptions are recorded in the audit log (prescription_change) for traceability.</Note>
      </SettingCard>

      <div className="flex justify-end">
        <FormFooter onSave={handleSave} onReset={handleReset} saving={saving} lastSaved={lastSaved} />
      </div>
    </div>
  );
}
