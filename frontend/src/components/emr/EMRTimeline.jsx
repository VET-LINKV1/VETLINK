/**
 * EMRTimeline.jsx
 * Vertical, chronological timeline of every EMR event for a pet.
 * Each event has a colored dot keyed by `kind`, a date, and a summary.
 *
 * Props:
 *   events  — Array<{ event_id, kind, occurred_at, summary, source_id }>
 *   onEventClick(event)
 */
import { Stethoscope, Syringe, Pill, Activity, FileText } from 'lucide-react';

const KIND_META = {
  visit:        { icon: Stethoscope, color: 'bg-blue-500',  text: 'text-blue-600',  label: 'Visit' },
  vaccination:  { icon: Syringe,     color: 'bg-emerald-500', text: 'text-emerald-600', label: 'Vaccination' },
  prescription: { icon: Pill,        color: 'bg-violet-500', text: 'text-violet-600', label: 'Prescription' },
  treatment:    { icon: Activity,    color: 'bg-amber-500',  text: 'text-amber-600',  label: 'Treatment' },
  file:         { icon: FileText,    color: 'bg-slate-500',  text: 'text-slate-600',  label: 'File' },
};

function fmt(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' }); }
  catch { return d; }
}

export default function EMRTimeline({ events = [], onEventClick }) {
  if (!events.length) {
    return (
      <p className="text-sm text-slate-400 dark:text-slate-500 font-body py-8 text-center">
        No timeline events yet.
      </p>
    );
  }

  return (
    <ol className="relative border-l-2 border-slate-200 dark:border-white/10 ml-3 space-y-6">
      {events.map((e) => {
        const meta = KIND_META[e.kind] || KIND_META.file;
        const Icon = meta.icon;
        return (
          <li key={`${e.kind}-${e.event_id}`} className="ml-6">
            <span className={`absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full ring-4 ring-white dark:ring-slate-900 ${meta.color}`}>
              <Icon className="w-3 h-3 text-white" />
            </span>
            <button
              type="button"
              onClick={() => onEventClick && onEventClick(e)}
              className="block w-full text-left bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-xl px-4 py-3 hover:border-blue-300 dark:hover:border-blue-500/40 transition-colors"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-body font-600 uppercase tracking-wide ${meta.text}`}>
                  {meta.label}
                </span>
                <span className="text-xs text-slate-400 font-body">{fmt(e.occurred_at)}</span>
              </div>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-200 font-body">
                {e.summary || '(no summary)'}
              </p>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
