/**
 * PetSettings.jsx
 * Species, breeds, vaccine types, allergy categories, record categories,
 * identification fields, weight/temperature units, Body Condition Score.
 */
import { useState, useEffect } from 'react';
import { PawPrint, Syringe, AlertCircle, FileText, Fingerprint, Scale, Thermometer, Gauge } from 'lucide-react';
import { settingsService } from '../../services/settingsService';
import { SettingCard, Field, Select, ChipList, FormFooter, Note, ErrorCard } from './primitives';

const BCS_SCALES = [
  { key: '9-point', label: '9-point scale (1 = emaciated, 9 = obese)' },
  { key: '5-point', label: '5-point scale (1 = underweight, 5 = overweight)' },
];

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

export default function PetSettings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState('');

  useEffect(() => {
    settingsService.getSection('pets')
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { console.error(e); setError('Failed to load pet & medical settings. Is the backend running and the Phase 20 migration applied?'); setLoading(false); });
  }, []);

  const pet = data;

  const set = async (patch) => {
    await settingsService.updateSection('pets', { ...data, ...patch });
    setData(d => ({ ...d, ...patch }));
  };

  const handleSave = async () => {
    setSaving(true);
    await settingsService.updateSection('pets', pet, 'Updated pet & medical settings');
    setLastSaved(`Saved ${new Date().toLocaleTimeString()}`);
    setSaving(false);
  };

  const handleReset = async () => {
    await settingsService.resetSection('pets');
    const d = await settingsService.getSection('pets');
    setData(d);
  };

  if (loading) return <SettingsSkeleton />;
  if (error) return <ErrorCard message={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="space-y-5">
      <SettingCard title="Species & Breeds" subtitle="Reference lists for patient records." icon={PawPrint}>
        <Field label="Species" htmlFor="pspecies">
          <ChipList items={pet.species} onAdd={(v) => set({ species: [...pet.species, v] })} onRemove={(v) => set({ species: pet.species.filter(x => x !== v) })} placeholder="Add species" />
        </Field>
        <Field label="Breeds" htmlFor="pbreeds">
          <ChipList items={pet.breeds} onAdd={(v) => set({ breeds: [...pet.breeds, v] })} onRemove={(v) => set({ breeds: pet.breeds.filter(x => x !== v) })} placeholder="Add breed" />
        </Field>
      </SettingCard>

      <SettingCard title="Vaccines & Allergies" subtitle="Catalogs used in medical records and reminders." icon={Syringe}>
        <Field label="Vaccine types" htmlFor="pvacc">
          <ChipList items={pet.vaccineTypes} onAdd={(v) => set({ vaccineTypes: [...pet.vaccineTypes, v] })} onRemove={(v) => set({ vaccineTypes: pet.vaccineTypes.filter(x => x !== v) })} placeholder="Add vaccine type" />
        </Field>
        <Field label="Allergy categories" htmlFor="pall">
          <ChipList items={pet.allergyCategories} onAdd={(v) => set({ allergyCategories: [...pet.allergyCategories, v] })} onRemove={(v) => set({ allergyCategories: pet.allergyCategories.filter(x => x !== v) })} placeholder="Add allergy category" />
        </Field>
      </SettingCard>

      <SettingCard title="Medical Records" subtitle="Categorization and identification." icon={FileText}>
        <Field label="Record categories" htmlFor="prec">
          <ChipList items={pet.recordCategories} onAdd={(v) => set({ recordCategories: [...pet.recordCategories, v] })} onRemove={(v) => set({ recordCategories: pet.recordCategories.filter(x => x !== v) })} placeholder="Add record category" />
        </Field>
        <Field label="Identification fields" htmlFor="pidfield">
          <ChipList items={pet.idFields} onAdd={(v) => set({ idFields: [...pet.idFields, v] })} onRemove={(v) => set({ idFields: pet.idFields.filter(x => x !== v) })} placeholder="Add ID field" />
        </Field>
      </SettingCard>

      <SettingCard title="Units & Scoring" subtitle="Measurement conventions for patient vitals." icon={Gauge}>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Weight unit" htmlFor="pwu">
            <Select id="pwu" value={pet.weightUnit} onChange={e => set({ weightUnit: e.target.value })}>
              {['kg','g','lb','oz'].map(u => <option key={u} value={u}>{u}</option>)}
            </Select>
          </Field>
          <Field label="Temperature unit" htmlFor="ptu">
            <Select id="ptu" value={pet.tempUnit} onChange={e => set({ tempUnit: e.target.value })}>
              {['celsius','fahrenheit'].map(u => <option key={u} value={u}>{u === 'celsius' ? '°C' : '°F'}</option>)}
            </Select>
          </Field>
          <Field label="Body Condition Score" htmlFor="pbcs">
            <Select id="pbcs" value={pet.bcsScale} onChange={e => set({ bcsScale: e.target.value })}>
              {BCS_SCALES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
          </Field>
        </div>
        <Note tone="info">These units apply to new measurements. Existing records keep their originally captured values.</Note>
      </SettingCard>

      <div className="flex justify-end">
        <FormFooter onSave={handleSave} onReset={handleReset} saving={saving} lastSaved={lastSaved} />
      </div>
    </div>
  );
}
