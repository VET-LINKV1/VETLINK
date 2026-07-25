/**
 * IntakeSummary.jsx
 * Read-only display of a submitted intake form. Used by the
 * Veterinarian pre-visit dashboard.
 *
 * Props:
 *   intake   row from appointment_intakes
 */
import { Stethoscope, Pizza, Pill, Brain, Lightbulb, AlertCircle } from 'lucide-react';

const SEVERITY_TINT = (n) =>
  n == null      ? 'bg-slate-100 text-slate-500'
: n >= 8         ? 'bg-red-100 text-red-700'
: n >= 5         ? 'bg-amber-100 text-amber-700'
:                  'bg-emerald-100 text-emerald-700';

export default function IntakeSummary({ intake }) {
  if (!intake) {
    return (
      <p className="text-sm text-slate-400 font-body italic flex items-center gap-1">
        <AlertCircle className="w-3.5 h-3.5" /> No intake submitted yet.
      </p>
    );
  }
  return (
    <div className="space-y-3 text-sm font-body">
      <Block icon={Stethoscope} title="Symptoms" empty={!intake.symptoms}>
        <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{intake.symptoms || '—'}</p>
        <div className="mt-1.5 flex items-center gap-2 flex-wrap text-xs text-slate-500">
          {intake.symptom_onset && <span>Onset: <b className="text-slate-700 dark:text-slate-200">{intake.symptom_onset}</b></span>}
          {intake.symptom_severity != null && (
            <span className={`px-2 py-0.5 rounded-md font-600 ${SEVERITY_TINT(intake.symptom_severity)}`}>
              Severity {intake.symptom_severity}/10
            </span>
          )}
        </div>
      </Block>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Block icon={Pizza} title="Diet" empty={!intake.diet_info}>
          <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{intake.diet_info || '—'}</p>
        </Block>
        <Block icon={Pill} title="Medications" empty={!intake.current_medications && !intake.allergies}>
          {intake.current_medications && (
            <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-0.5">Current</span>
              {intake.current_medications}
            </p>
          )}
          {intake.allergies && (
            <p className="text-red-700 mt-2 whitespace-pre-wrap">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-0.5">Allergies</span>
              {intake.allergies}
            </p>
          )}
          {!intake.current_medications && !intake.allergies && <p className="text-slate-400">—</p>}
        </Block>
      </div>

      <Block icon={Brain} title="Behavior & recent changes" empty={!intake.behavioral_notes && !intake.recent_changes}>
        {intake.behavioral_notes && (
          <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-0.5">Behavior</span>
            {intake.behavioral_notes}
          </p>
        )}
        {intake.recent_changes && (
          <p className="text-slate-700 dark:text-slate-200 mt-2 whitespace-pre-wrap">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-0.5">Recent changes</span>
            {intake.recent_changes}
          </p>
        )}
        {!intake.behavioral_notes && !intake.recent_changes && <p className="text-slate-400">—</p>}
      </Block>

      {intake.fasting_status && (
        <Block icon={Lightbulb} title="Fasting status">
          <p className="text-slate-700 dark:text-slate-200">{intake.fasting_status}</p>
        </Block>
      )}

      <p className="text-[10px] text-slate-400 font-body">
        Submitted {new Date(intake.submitted_at).toLocaleString()}
        {intake.consent_given ? ' · consent given' : ' · consent NOT given'}
      </p>
    </div>
  );
}

function Block({ icon: Icon, title, children, empty }) {
  return (
    <div className={`rounded-xl border p-3 ${empty ? 'border-slate-100 bg-slate-50' : 'border-slate-200 bg-white dark:bg-slate-900 dark:border-white/10'}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-blue-600" />
        <p className="text-[10px] uppercase tracking-wider font-600 text-slate-500">{title}</p>
      </div>
      {children}
    </div>
  );
}
