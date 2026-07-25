/**
 * IntakeForm.jsx
 * Multi-section pre-visit intake form.
 * Sections collapse on mobile for less scrolling.
 *
 * Props:
 *   appointmentId
 *   initial       optional, the saved intake (pre-fills for edit)
 *   onSubmit(payload)
 *   submitting    boolean
 */
import { useState } from 'react';
import { ChevronDown, ChevronUp, Stethoscope, Pizza, Pill, Brain, Lightbulb, Shield, Send, Loader2 } from 'lucide-react';

const SEVERITY = ['1','2','3','4','5','6','7','8','9','10'];

export default function IntakeForm({ appointmentId, initial, onSubmit, submitting }) {
  const [open, setOpen] = useState({ symptoms: true, diet: true, meds: true, behavior: false, fasting: false });
  const [form, setForm] = useState({
    symptoms:           initial?.symptoms          || '',
    symptomOnset:       initial?.symptom_onset     || '',
    symptomSeverity:    initial?.symptom_severity  || '',
    dietInfo:           initial?.diet_info         || '',
    currentMedications: initial?.current_medications || '',
    allergies:          initial?.allergies         || '',
    behavioralNotes:    initial?.behavioral_notes  || '',
    recentChanges:      initial?.recent_changes    || '',
    fastingStatus:      initial?.fasting_status    || '',
    consentGiven:       !!initial?.consent_given,
  });

  const submit = (e) => {
    e.preventDefault();
    if (!form.consentGiven) return;
    onSubmit && onSubmit({
      appointmentId,
      ...form,
      symptomSeverity: form.symptomSeverity ? Number(form.symptomSeverity) : null,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Section icon={Stethoscope} title="Symptoms" k="symptoms" open={open} setOpen={setOpen}>
        <Field label="What's going on?">
          <textarea rows={3} value={form.symptoms} onChange={(e) => setForm({ ...form, symptoms: e.target.value })}
            placeholder="Describe symptoms (lethargy, vomiting, limping, coughing, etc.)" className={TXTAREA} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Onset">
            <input value={form.symptomOnset} onChange={(e) => setForm({ ...form, symptomOnset: e.target.value })}
              placeholder='e.g. "2 days ago", "this morning"' className={INPUT} />
          </Field>
          <Field label="Severity (1–10)">
            <select value={form.symptomSeverity}
              onChange={(e) => setForm({ ...form, symptomSeverity: e.target.value })} className={INPUT}>
              <option value="">—</option>
              {SEVERITY.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      <Section icon={Pizza} title="Diet" k="diet" open={open} setOpen={setOpen}>
        <Field label="What does your pet currently eat?">
          <textarea rows={2} value={form.dietInfo} onChange={(e) => setForm({ ...form, dietInfo: e.target.value })}
            placeholder="Brand, type, frequency, treats…" className={TXTAREA} />
        </Field>
      </Section>

      <Section icon={Pill} title="Medications & allergies" k="meds" open={open} setOpen={setOpen}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Current medications">
            <textarea rows={2} value={form.currentMedications}
              onChange={(e) => setForm({ ...form, currentMedications: e.target.value })}
              placeholder="Name, dose, frequency" className={TXTAREA} />
          </Field>
          <Field label="Known allergies">
            <textarea rows={2} value={form.allergies}
              onChange={(e) => setForm({ ...form, allergies: e.target.value })}
              placeholder="Food, environmental, drugs…" className={TXTAREA} />
          </Field>
        </div>
      </Section>

      <Section icon={Brain} title="Behavior & recent changes" k="behavior" open={open} setOpen={setOpen}>
        <Field label="Behavioral notes">
          <textarea rows={2} value={form.behavioralNotes}
            onChange={(e) => setForm({ ...form, behavioralNotes: e.target.value })}
            placeholder="Anxiety, aggression, mobility, energy…" className={TXTAREA} />
        </Field>
        <Field label="Recent changes (food, travel, environment, exposure)">
          <textarea rows={2} value={form.recentChanges}
            onChange={(e) => setForm({ ...form, recentChanges: e.target.value })}
            placeholder="Anything new in the last 30 days" className={TXTAREA} />
        </Field>
      </Section>

      <Section icon={Lightbulb} title="Fasting status (for procedures)" k="fasting" open={open} setOpen={setOpen}>
        <Field label="Has the pet been fasting? Since when?">
          <input value={form.fastingStatus} onChange={(e) => setForm({ ...form, fastingStatus: e.target.value })}
            placeholder='e.g. "fasted since 8pm yesterday"' className={INPUT} />
        </Field>
      </Section>

      <label className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-xl">
        <input type="checkbox" checked={form.consentGiven}
          onChange={(e) => setForm({ ...form, consentGiven: e.target.checked })}
          className="mt-0.5" />
        <span className="text-xs font-body text-slate-600 dark:text-slate-300">
          <Shield className="inline w-3.5 h-3.5 text-blue-600 mr-1" />
          I confirm the information above is accurate and consent to it being attached to my pet's medical record.
        </span>
      </label>

      <div className="flex justify-end">
        <button type="submit" disabled={submitting || !form.consentGiven}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-body font-600 shadow-md shadow-blue-500/20 disabled:opacity-50">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Submit intake
        </button>
      </div>
    </form>
  );
}

/* ── inputs styles ───────────────────────────────────────── */
const INPUT   = 'w-full rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-sm font-body bg-white dark:bg-slate-800';
const TXTAREA = INPUT;

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider font-body font-600 text-slate-400 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Section({ icon: Icon, title, k, open, setOpen, children }) {
  const isOpen = !!open[k];
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl overflow-hidden">
      <button type="button" onClick={() => setOpen({ ...open, [k]: !isOpen })}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5">
        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
          <Icon className="w-4 h-4 text-blue-600" />
        </div>
        <p className="font-body font-600 text-slate-700 dark:text-slate-200 flex-1 text-left">{title}</p>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {isOpen && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}
