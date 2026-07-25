/**
 * PetPassportCard.jsx
 * Pet card used in the multi-pet dashboard grid. Color-coded
 * by overall vaccination status, with a quick stats row.
 *
 * Props:
 *   row   — row from passport_summary_v
 *   onOpen(petId)
 */
import { PawPrint, Shield, ShieldAlert, AlertTriangle, ChevronRight } from 'lucide-react';

const META = {
  protected:     { ring: 'ring-emerald-200', dot: 'bg-emerald-500', label: 'Protected',     tint: 'text-emerald-700 bg-emerald-50' },
  expiring_soon: { ring: 'ring-amber-200',   dot: 'bg-amber-500',   label: 'Expiring soon', tint: 'text-amber-700 bg-amber-50'   },
  overdue:       { ring: 'ring-red-200',     dot: 'bg-red-500',     label: 'Overdue',       tint: 'text-red-700 bg-red-50'       },
  scheduled:     { ring: 'ring-blue-200',    dot: 'bg-blue-500',    label: 'Scheduled',     tint: 'text-blue-700 bg-blue-50'     },
  none:          { ring: 'ring-slate-200',   dot: 'bg-slate-400',   label: 'No records',    tint: 'text-slate-600 bg-slate-100'  },
};

export default function PetPassportCard({ row, onOpen }) {
  const m = META[row.overall_vax_status] || META.none;

  return (
    <button onClick={() => onOpen && onOpen(row.pet_id)}
      className={`group text-left w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 hover:border-blue-300 transition-all hover:shadow-md ring-2 ${m.ring} overflow-hidden`}>
      <div className="px-5 py-4 flex items-center gap-3">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${m.tint}`}>
          <PawPrint className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display text-slate-800 dark:text-white font-700 truncate">{row.name}</p>
          <p className="text-xs text-slate-500 font-body">
            {row.species}{row.breed ? ` · ${row.breed}` : ''}{row.age != null ? ` · ${row.age}y` : ''}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
      </div>

      <div className={`px-5 py-2 ${m.tint} flex items-center gap-2`}>
        <span className={`w-2 h-2 rounded-full ${m.dot}`} />
        <span className="text-xs font-body font-600">{m.label}</span>
        <span className="text-xs ml-auto opacity-70">
          {row.vax_protected} ✓ · {row.vax_expiring} ⏳ · {row.vax_overdue} !
        </span>
      </div>

      <div className="px-5 py-3 grid grid-cols-3 gap-1 text-center bg-slate-50 dark:bg-white/5">
        <Stat label="Weight" value={row.current_weight_kg ? `${Number(row.current_weight_kg).toFixed(1)} kg` : '—'} />
        <Stat label="Visits" value={row.visits_total ?? 0} />
        <Stat label="Files"  value={row.files_total ?? 0} />
      </div>
    </button>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-sm font-body font-700 text-slate-700 dark:text-slate-200">{value}</p>
      <p className="text-[10px] font-body uppercase tracking-wider text-slate-400">{label}</p>
    </div>
  );
}
