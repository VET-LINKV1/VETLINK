/**
 * PetFormDialog.jsx — Admin pet registration / edit workflow.
 * Fields: name, species, breed, DOB, sex, color, weight, spay/neuter,
 * microchip, owner assignment, emergency contact, allergies, notes.
 * Includes client-side validation and a confirmation step on submit.
 */
import { useEffect, useState } from 'react';
import { X, Loader2, Save, PawPrint, AlertCircle } from 'lucide-react';
import { adminPetService } from '../../../services/adminPetService';
import { MOCK_OWNERS } from '../../../pages/admin/adminPetMock';

const SPECIES = ['Dog', 'Cat', 'Bird', 'Rabbit', 'Hamster', 'Fish', 'Reptile', 'Other'];

function emptyForm() {
  return {
    name: '', species: 'Dog', breed: '', date_of_birth: '', gender: 'unknown',
    color: '', weight_kg: '', spay_neuter: 'unknown', microchip_no: '',
    owner_id: '', emergency_contact: '', emergency_name: '', allergies: '', notes: '',
  };
}

export default function PetFormDialog({ mode = 'create', initial = null, onClose, onSaved }) {
  const [form, setForm]         = useState(initial ? { ...emptyForm(), ...initial } : emptyForm());
  const [owners, setOwners]     = useState([]);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [confirmOpen, setConfirm] = useState(false);

  const set = (k, v) => setForm(s => ({ ...s, [k]: v }));

  useEffect(() => {
    const onEsc = (e) => { if (e.key === 'Escape' && !confirmOpen) onClose(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose, confirmOpen]);

  useEffect(() => {
    // Load owners for the dropdown (real endpoint, with mock fallback).
    adminPetService.listOwners()
      .then(setOwners)
      .catch(() => setOwners(MOCK_OWNERS));
  }, []);

  const validate = () => {
    if (!form.name.trim()) return 'Pet name is required.';
    if (!form.species) return 'Species is required.';
    if (mode === 'create' && !form.owner_id) return 'Owner assignment is required.';
    if (form.weight_kg && (isNaN(Number(form.weight_kg)) || Number(form.weight_kg) <= 0)) return 'Weight must be a positive number.';
    if (form.microchip_no && !/^[0-9]{9,15}$/.test(form.microchip_no.replace(/\s/g, ''))) return 'Microchip number must be 9–15 digits.';
    return '';
  };

  const submit = (e) => {
    e?.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setConfirm(true);
  };

  const confirmSave = async () => {
    setSaving(true); setError('');
    const payload = {
      name: form.name.trim(),
      species: form.species,
      breed: form.breed.trim() || null,
      gender: form.gender,
      weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      color: form.color.trim() || null,
      microchip_no: form.microchip_no.trim() || null,
      notes: [form.allergies && `Allergies: ${form.allergies}`, form.notes && form.notes.trim()]
        .filter(Boolean).join('\n') || null,
      owner_id: form.owner_id || undefined,
    };
    try {
      const saved = mode === 'create'
        ? await adminPetService.create(payload)
        : await adminPetService.update(initial.id, payload);
      setConfirm(false);
      onSaved && onSaved(saved);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to save pet.');
      setConfirm(false);
    } finally { setSaving(false); }
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm font-body focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
          <h2 className="font-display font-700 text-base text-slate-800 dark:text-white flex items-center gap-2">
            <PawPrint className="w-4 h-4 text-blue-600" />
            {mode === 'create' ? 'Register New Pet' : `Edit ${initial?.name || 'Pet'}`}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 border border-red-100">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-red-500 text-xs font-body">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Pet Name *">
              <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Bella" />
            </Field>
            <Field label="Species *">
              <select className={inputCls} value={form.species} onChange={e => set('species', e.target.value)}>
                {SPECIES.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Breed">
              <input className={inputCls} value={form.breed} onChange={e => set('breed', e.target.value)} placeholder="Golden Retriever" />
            </Field>
            <Field label="Date of Birth">
              <input type="date" className={inputCls} value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} />
            </Field>
            <Field label="Sex">
              <select className={inputCls} value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="unknown">Unknown</option>
              </select>
            </Field>
            <Field label="Color">
              <input className={inputCls} value={form.color} onChange={e => set('color', e.target.value)} placeholder="Golden" />
            </Field>
            <Field label="Weight (kg)">
              <input type="number" step="0.1" min="0" className={inputCls} value={form.weight_kg} onChange={e => set('weight_kg', e.target.value)} placeholder="12.5" />
            </Field>
            <Field label="Spay / Neuter">
              <select className={inputCls} value={form.spay_neuter} onChange={e => set('spay_neuter', e.target.value)}>
                <option value="unknown">Unknown</option>
                <option value="intact">Intact</option>
                <option value="neutered">Neutered</option>
                <option value="spayed">Spayed</option>
              </select>
            </Field>
            <Field label="Microchip Number">
              <input className={inputCls} value={form.microchip_no} onChange={e => set('microchip_no', e.target.value)} placeholder="900123456789012" />
            </Field>
            <Field label="Owner *">
              <select className={inputCls} value={form.owner_id} onChange={e => set('owner_id', e.target.value)}>
                <option value="">Select owner…</option>
                {owners.map(o => <option key={o.id} value={o.id}>{o.name}{o.phone_number ? ` (${o.phone_number})` : ''}</option>)}
              </select>
            </Field>
            <Field label="Emergency Contact Name">
              <input className={inputCls} value={form.emergency_name} onChange={e => set('emergency_name', e.target.value)} placeholder="Juan Dela Cruz" />
            </Field>
            <Field label="Emergency Contact Number">
              <input className={inputCls} value={form.emergency_contact} onChange={e => set('emergency_contact', e.target.value)} placeholder="+63 9xx xxx xxxx" />
            </Field>
          </div>

          <Field label="Allergies">
            <textarea className={`${inputCls} resize-none`} rows={2} value={form.allergies} onChange={e => set('allergies', e.target.value)} placeholder="Food, drug, environmental…" />
          </Field>
          <Field label="Additional Notes">
            <textarea className={`${inputCls} resize-none`} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Behavior, special conditions…" />
          </Field>
        </div>

        <div className="px-5 py-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 text-sm font-body hover:bg-slate-100 dark:hover:bg-white/5">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-body font-600 flex items-center gap-1.5 shadow shadow-blue-500/20 disabled:opacity-60">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {mode === 'create' ? 'Register Pet' : 'Save Changes'}
          </button>
        </div>
      </form>

      {confirmOpen && (
        <ConfirmDialog
          title={mode === 'create' ? 'Confirm Pet Registration' : 'Confirm Changes'}
          message={mode === 'create'
            ? `Register "${form.name}" under ${owners.find(o => o.id === form.owner_id)?.name || 'this owner'}?`
            : `Save changes to "${initial?.name}"?`}
          saving={saving}
          onCancel={() => setConfirm(false)}
          onConfirm={confirmSave}
        />
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-600 text-slate-600 dark:text-slate-400 mb-1 font-body">{label}</label>
      {children}
    </div>
  );
}

function ConfirmDialog({ title, message, saving, onCancel, onConfirm }) {
  return (
    <div className="absolute inset-0 z-60 flex items-center justify-center bg-black/30" onClick={onCancel}>
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-5" onClick={e => e.stopPropagation()}>
        <h3 className="font-display font-700 text-slate-800 dark:text-white text-base mb-1">{title}</h3>
        <p className="text-sm font-body text-slate-500 dark:text-slate-400 mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} disabled={saving}
            className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 text-sm font-body hover:bg-slate-100 dark:hover:bg-white/5">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={saving}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-body font-600 flex items-center gap-1.5 disabled:opacity-60">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
