/**
 * ConsultationNotesEditor.jsx
 * SOAP-shaped notes editor for vets to fill after a telehealth call.
 *
 * Props:
 *   consultationId
 *   initial           optional initial { subjective, objective, assessment, plan, follow_up, private_notes }
 *   onSaved(note)
 */
import { useState } from 'react';
import { Save, Loader2, CheckCircle2 } from 'lucide-react';
import { commsService } from '../../services/commsService';

const FIELDS = [
  { key: 'subjective',     label: 'Subjective',     placeholder: 'Client-reported symptoms, history, concerns…' },
  { key: 'objective',      label: 'Objective',      placeholder: 'Observed on video — posture, gait, visible signs, vitals if measured…' },
  { key: 'assessment',     label: 'Assessment',     placeholder: 'Differential / working diagnosis…' },
  { key: 'plan',           label: 'Plan',           placeholder: 'Treatment plan, medications, follow-up steps…' },
  { key: 'follow_up',      label: 'Follow-up',      placeholder: 'Next visit window or recheck instructions…' },
  { key: 'private_notes',  label: 'Private notes',  placeholder: 'Internal notes — not shared with client.' },
];

export default function ConsultationNotesEditor({ consultationId, initial = {}, onSaved }) {
  const [form, setForm] = useState({
    subjective:     initial.subjective     || '',
    objective:      initial.objective      || '',
    assessment:     initial.assessment     || '',
    plan:           initial.plan           || '',
    follow_up:      initial.follow_up      || '',
    private_notes:  initial.private_notes  || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState('');

  const set = (k, v) => { setForm(s => ({ ...s, [k]: v })); setSaved(false); };

  const save = async () => {
    if (!consultationId) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      const note = await commsService.upsertNote(consultationId, form);
      setSaved(true);
      onSaved && onSaved(note);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to save notes.');
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-display font-700 text-slate-800 dark:text-white text-base">Consultation notes</h3>
          <p className="text-xs font-body text-slate-400">SOAP-formatted — saved to the patient record.</p>
        </div>
        <button onClick={save} disabled={saving}
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-body font-600 flex items-center gap-1.5 disabled:opacity-40">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? 'Saving…' : 'Save notes'}
        </button>
      </div>

      {saved && (
        <p className="mb-3 text-xs font-body text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" /> Saved.
        </p>
      )}
      {error && (
        <p className="mb-3 text-xs font-body text-red-600">{error}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {FIELDS.map(({ key, label, placeholder }) => (
          <label key={key} className="block">
            <span className="text-xs font-body font-600 text-slate-500 dark:text-slate-400 mb-1 block">{label}</span>
            <textarea
              value={form[key]}
              onChange={(e) => set(key, e.target.value)}
              placeholder={placeholder}
              rows={key === 'private_notes' ? 2 : 3}
              className="w-full resize-y rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-body text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
