/**
 * SOAPEditor.jsx
 * Inline form for creating or editing a SOAP note.
 *
 * Props:
 *   initial         — { subjective, objective, assessment, plan } (optional)
 *   medicalRecordId — required for create; ignored when editing
 *   onSave(payload) — async; payload already in API-friendly camelCase
 *   onCancel()
 */
import { useState } from 'react';
import { Save, X, Loader2 } from 'lucide-react';

const FIELDS = [
  { key: 'subjective', label: 'Subjective',  hint: 'Owner-reported history, chief complaint' },
  { key: 'objective',  label: 'Objective',   hint: 'Vital signs, physical exam findings' },
  { key: 'assessment', label: 'Assessment',  hint: 'Diagnosis / differential diagnosis'   },
  { key: 'plan',       label: 'Plan',        hint: 'Treatment, follow-up, owner instructions' },
];

export default function SOAPEditor({ initial, medicalRecordId, onSave, onCancel, isEdit = false }) {
  const [form, setForm] = useState({
    subjective: initial?.subjective || '',
    objective:  initial?.objective  || '',
    assessment: initial?.assessment || '',
    plan:       initial?.plan       || '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const payload = isEdit ? { ...form } : { medicalRecordId, ...form };
      await onSave(payload);
    } catch (e2) {
      setErr(e2?.response?.data?.error || e2.message || 'Failed to save SOAP note.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {FIELDS.map(({ key, label, hint }) => (
        <div key={key}>
          <label className="block text-xs font-body font-600 text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
            {label}
          </label>
          <textarea
            rows={3}
            value={form[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            placeholder={hint}
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-body text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
        </div>
      ))}

      {err && (
        <p className="text-xs text-red-500 font-body bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-lg">
          {err}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 text-sm font-body">
          <X className="w-4 h-4" /> Cancel
        </button>
        <button type="submit" disabled={busy}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-body font-600 shadow-md shadow-blue-500/20">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isEdit ? 'Save changes' : 'Save SOAP note'}
        </button>
      </div>
    </form>
  );
}
