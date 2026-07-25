import { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';

/**
 * DateRangeFilter — preset chips + custom range picker.
 * Calls onChange({ startDate, endDate }) (ISO YYYY-MM-DD).
 */
const PRESETS = [
  { id: '7d',   label: 'Last 7 days',  days: 7 },
  { id: '30d',  label: 'Last 30 days', days: 30 },
  { id: '90d',  label: 'Last 90 days', days: 90 },
  { id: '365d', label: 'Last year',    days: 365 },
];

function isoDay(d) { return d.toISOString().slice(0, 10); }

function presetRange(days) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  return { startDate: isoDay(start), endDate: isoDay(end) };
}

function DateRangeFilter({ value, onChange }) {
  const [active, setActive] = useState('90d');
  const [custom, setCustom] = useState({ startDate: value?.startDate || '', endDate: value?.endDate || '' });
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    // initialise to default 90d on mount
    if (!value || (!value.startDate && !value.endDate)) {
      onChange(presetRange(90));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickPreset = (p) => {
    setActive(p.id);
    setShowCustom(false);
    onChange(presetRange(p.days));
  };

  const applyCustom = () => {
    if (custom.startDate && custom.endDate) {
      setActive('custom');
      onChange({ startDate: custom.startDate, endDate: custom.endDate });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <span className="inline-flex items-center gap-1.5 text-xs font-body font-600 text-slate-400 uppercase tracking-wider mr-1">
        <Calendar className="w-3.5 h-3.5" /> Range
      </span>
      {PRESETS.map((p) => (
        <button
          key={p.id}
          onClick={() => pickPreset(p)}
          className={`text-xs font-body font-500 px-3 py-1.5 rounded-lg border transition-colors ${
            active === p.id
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-blue-300 hover:text-blue-600'
          }`}
        >
          {p.label}
        </button>
      ))}
      <button
        onClick={() => setShowCustom((s) => !s)}
        className={`text-xs font-body font-500 px-3 py-1.5 rounded-lg border transition-colors ${
          active === 'custom'
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-blue-300 hover:text-blue-600'
        }`}
      >
        Custom
      </button>

      {showCustom && (
        <div className="w-full sm:w-auto flex items-center gap-2 mt-2 sm:mt-0">
          <input
            type="date"
            value={custom.startDate}
            onChange={(e) => setCustom({ ...custom, startDate: e.target.value })}
            className="text-xs font-body px-2 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
          />
          <span className="text-slate-400 text-xs">to</span>
          <input
            type="date"
            value={custom.endDate}
            onChange={(e) => setCustom({ ...custom, endDate: e.target.value })}
            className="text-xs font-body px-2 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
          />
          <button
            onClick={applyCustom}
            disabled={!custom.startDate || !custom.endDate}
            className="text-xs font-body font-600 px-3 py-1.5 rounded-lg bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

export default DateRangeFilter;
