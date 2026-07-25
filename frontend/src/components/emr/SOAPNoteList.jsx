/**
 * SOAPNoteList.jsx
 * Renders SOAP notes already attached to a pet's medical records.
 * Read-only display; editing happens via SOAPEditor in the parent.
 *
 * Props:
 *   notes   Array<{ id, medical_record_id, subjective, objective, assessment, plan, created_at }>
 *   onEdit(note)
 *   onDelete(note)
 *   canWrite
 */
import { Pencil, Trash2, Stethoscope } from 'lucide-react';

function fmt(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return d; }
}

const FIELDS = [
  { key: 'subjective', label: 'S', name: 'Subjective' },
  { key: 'objective',  label: 'O', name: 'Objective'  },
  { key: 'assessment', label: 'A', name: 'Assessment' },
  { key: 'plan',       label: 'P', name: 'Plan'       },
];

export default function SOAPNoteList({ notes = [], onEdit, onDelete, canWrite }) {
  if (!notes.length) {
    return <p className="text-sm text-slate-400 font-body text-center py-6">No SOAP notes yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {notes.map((n) => (
        <li key={n.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                <Stethoscope className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-xs font-body text-slate-400">{fmt(n.created_at)}</p>
            </div>
            {canWrite && (
              <div className="flex items-center gap-1">
                <button onClick={() => onEdit && onEdit(n)} title="Edit"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete && onDelete(n)} title="Delete"
                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FIELDS.map(({ key, label, name }) => (
              <div key={key} className="bg-slate-50 dark:bg-white/5 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-5 h-5 rounded-md bg-blue-600 text-white text-[10px] font-body font-700 flex items-center justify-center">
                    {label}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-slate-500 font-body font-600">
                    {name}
                  </span>
                </div>
                <p className="text-xs font-body text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                  {n[key] || <span className="text-slate-400 italic">—</span>}
                </p>
              </div>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
