/**
 * LaboratorySettings.jsx
 * Lab test types, categories, reference ranges, units, result statuses,
 * approval workflows.
 */
import { useState, useEffect } from 'react';
import { Microscope, FlaskConical, ListOrdered, CheckCircle2, Trash2 } from 'lucide-react';
import { settingsService } from '../../services/settingsService';
import { SettingCard, Field, TextInput, Select, Toggle, ChipList, FormFooter, Note, ErrorCard } from './primitives';

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

export default function LaboratorySettings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    settingsService.getSection('laboratory')
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { console.error(e); setError('Failed to load laboratory settings. Is the backend running and the Phase 20 migration applied?'); setLoading(false); });
  }, []);

  const lab = data;

  const set = async (patch) => {
    await settingsService.updateSection('laboratory', { ...data, ...patch });
    setData(d => ({ ...d, ...patch }));
  };

  const addRefRange = () => {
    const newRange = { test: '', measure: '', low: 0, high: 0, unit: lab.units[0] };
    set({ referenceRanges: [...lab.referenceRanges, newRange] });
  };
  const removeRefRange = (idx) => set({ referenceRanges: lab.referenceRanges.filter((_, i) => i !== idx) });
  const updateRefRange = (idx, patch) => set({ referenceRanges: lab.referenceRanges.map((r, i) => i === idx ? { ...r, ...patch } : r) });

  const handleSave = async () => {
    setSaving(true);
    await settingsService.updateSection('laboratory', data, 'Updated laboratory settings');
    setLastSaved(`Saved ${new Date().toLocaleTimeString()}`);
    setSaving(false);
  };

  const handleReset = async () => {
    await settingsService.resetSection('laboratory');
    const d = await settingsService.getSection('laboratory');
    setData(d);
  };

  if (loading) return <SettingsSkeleton />;
  if (error) return <ErrorCard message={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="space-y-5">
      <SettingCard title="Test Catalog" subtitle="Test types and their categories." icon={Microscope}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Test types" htmlFor="ltest">
            <ChipList items={lab.testTypes} onAdd={(v) => set({ testTypes: [...lab.testTypes, v] })} onRemove={(v) => set({ testTypes: lab.testTypes.filter(x => x !== v) })} placeholder="Add test type" />
          </Field>
          <Field label="Categories" htmlFor="lcat">
            <ChipList items={lab.categories} onAdd={(v) => set({ categories: [...lab.categories, v] })} onRemove={(v) => set({ categories: lab.categories.filter(x => x !== v) })} placeholder="Add category" />
          </Field>
        </div>
      </SettingCard>

      <SettingCard title="Units & Reference Ranges" subtitle="Measurement units and normal values per test." icon={FlaskConical}>
        <Field label="Available units" htmlFor="lunit">
          <ChipList items={lab.units} onAdd={(v) => set({ units: [...lab.units, v] })} onRemove={(v) => set({ units: lab.units.filter(x => x !== v) })} placeholder="Add unit" />
        </Field>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-body text-sm font-600 text-slate-700 dark:text-slate-200">Reference ranges</p>
            <button onClick={addRefRange} className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 text-xs font-body font-600 hover:bg-slate-200 dark:hover:bg-white/10">+ Add range</button>
          </div>
          {lab.referenceRanges.map((r, idx) => (
            <div key={idx} className="grid gap-2 md:grid-cols-6 p-3 rounded-lg bg-slate-50 dark:bg-white/5">
              <Field label="Test">
                <Select value={r.test} onChange={e => updateRefRange(idx, { test: e.target.value })}>
                  {lab.testTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
              </Field>
              <Field label="Measure">
                <TextInput value={r.measure} onChange={e => updateRefRange(idx, { measure: e.target.value })} placeholder="e.g. WBC, ALT" />
              </Field>
              <Field label="Low">
                <TextInput type="number" step="0.01" value={r.low} onChange={e => updateRefRange(idx, { low: Number(e.target.value) })} />
              </Field>
              <Field label="High">
                <TextInput type="number" step="0.01" value={r.high} onChange={e => updateRefRange(idx, { high: Number(e.target.value) })} />
              </Field>
              <Field label="Unit">
                <Select value={r.unit} onChange={e => updateRefRange(idx, { unit: e.target.value })}>
                  {lab.units.map(u => <option key={u} value={u}>{u}</option>)}
                </Select>
              </Field>
              <Field label="">
                <button onClick={() => removeRefRange(idx)} className="w-full p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 text-sm font-body font-600">Remove</button>
              </Field>
            </div>
          ))}
        </div>
      </SettingCard>

      <SettingCard title="Result Statuses" subtitle="Workflow states for lab results." icon={ListOrdered}>
        <Field label="Statuses" htmlFor="lstat">
          <ChipList items={lab.resultStatuses} onAdd={(v) => set({ resultStatuses: [...lab.resultStatuses, v] })} onRemove={(v) => set({ resultStatuses: lab.resultStatuses.filter(x => x !== v) })} placeholder="Add status" />
        </Field>
      </SettingCard>

      <SettingCard title="Approval Workflow" subtitle="Quality control before results are released." icon={CheckCircle2}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-body text-slate-700 dark:text-slate-200">Require result approval</p>
            <p className="text-xs font-body text-slate-400">A senior tech or vet must verify results before release.</p>
          </div>
          <Toggle checked={lab.requireApproval} onChange={v => set({ requireApproval: v })} label="Require approval" />
        </div>
        {lab.requireApproval && (
          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="font-body text-slate-700 dark:text-slate-200">Auto-verify normal results</p>
              <p className="text-xs font-body text-slate-400">Results within reference range bypass manual review.</p>
            </div>
            <Toggle checked={lab.autoVerifyBelow} onChange={v => set({ autoVerifyBelow: v })} label="Auto-verify" />
          </div>
        )}
      </SettingCard>

      <div className="flex justify-end">
        <FormFooter onSave={handleSave} onReset={handleReset} saving={saving} lastSaved={lastSaved} />
      </div>
    </div>
  );
}