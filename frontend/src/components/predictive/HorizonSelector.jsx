import { CalendarRange } from 'lucide-react';

/**
 * HorizonSelector — chip group to pick forecast horizon in months.
 * Values: 3 / 6 / 9 / 12 months.
 */
const OPTIONS = [
  { value: 3,  label: '3 mo' },
  { value: 6,  label: '6 mo' },
  { value: 9,  label: '9 mo' },
  { value: 12, label: '12 mo' },
];

function HorizonSelector({ value = 6, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <span className="inline-flex items-center gap-1.5 text-xs font-body font-600 text-slate-400 uppercase tracking-wider mr-1">
        <CalendarRange className="w-3.5 h-3.5" /> Horizon
      </span>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`text-xs font-body font-500 px-3 py-1.5 rounded-lg border transition-colors ${
            value === o.value
              ? 'bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-500/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-violet-300 hover:text-violet-600'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default HorizonSelector;
