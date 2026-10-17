/**
 * ReasonPicker.jsx
 * Tile grid for selecting the appointment reason. Each tile shows
 * an icon, label, and an urgency badge so clients know what to
 * expect (e.g. "Emergency → bypasses normal queueing").
 *
 * Props:
 *   reasons    Array from /api/booking/reasons
 *   selected   reason.code
 *   onSelect(reason)
 */
import { useState, useMemo } from 'react';
import { Stethoscope, Syringe, Scissors, ActivitySquare, Siren, HelpCircle, Search, X } from 'lucide-react';

const ICON = {
  annual_checkup: Stethoscope,
  vaccination:    Syringe,
  grooming:       Scissors,
  injury:         ActivitySquare,
  emergency:      Siren,
  other:          HelpCircle,
};

const TINT = {
  blue:    { ring: 'ring-blue-200',    icon: 'bg-blue-50    text-blue-600',    badge: 'bg-blue-50 text-blue-600 border-blue-200' },
  emerald: { ring: 'ring-emerald-200', icon: 'bg-emerald-50 text-emerald-600', badge: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  violet:  { ring: 'ring-violet-200',  icon: 'bg-violet-50  text-violet-600',  badge: 'bg-violet-50 text-violet-600 border-violet-200' },
  amber:   { ring: 'ring-amber-200',   icon: 'bg-amber-50   text-amber-600',   badge: 'bg-amber-50 text-amber-600 border-amber-200' },
  red:     { ring: 'ring-red-300',     icon: 'bg-red-50     text-red-600',     badge: 'bg-red-50 text-red-600 border-red-200' },
  slate:   { ring: 'ring-slate-200',   icon: 'bg-slate-100  text-slate-600',   badge: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const URGENCY_LABEL = {
  routine:   'Routine',
  standard:  'Standard',
  urgent:    'Urgent',
  emergency: 'Emergency — bypasses queue',
};

export default function ReasonPicker({ reasons = [], selected, onSelect }) {
  const [query, setQuery] = useState('');

  // Every word typed must appear somewhere in the service's name/specialty/urgency.
  const visible = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return reasons;
    return reasons.filter((r) => {
      const hay = `${r.label} ${r.code} ${r.suggestedSpecialty || ''} ${r.urgency || ''}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [reasons, query]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a service, e.g. vaccine, check-up, wound…"
          aria-label="Search services"
          className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm font-body text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {visible.length === 0 && (
        <div className="text-center py-8 rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
          <p className="text-sm font-body text-slate-500">No service matches “{query}”.</p>
          <button type="button" onClick={() => setQuery('')}
            className="mt-1 text-xs font-body font-600 text-blue-600 hover:text-blue-700">Show all services</button>
        </div>
      )}

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {visible.map((r) => {
        const Icon = ICON[r.code] || HelpCircle;
        const t    = TINT[r.color] || TINT.slate;
        const active = selected === r.code;
        return (
          <button key={r.code} type="button"
            onClick={() => onSelect && onSelect(r)}
            className={`text-left bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 p-4 transition-all
              ${active
                ? `ring-2 ${t.ring} shadow-md`
                : 'hover:border-blue-300 hover:shadow-sm'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${t.icon}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-700 text-slate-800 dark:text-white">{r.label}</p>
                <p className="text-xs text-slate-400 font-body mt-0.5">
                  ~{r.durationMins} min
                  {r.suggestedSpecialty ? ` · ${r.suggestedSpecialty}` : ''}
                </p>
                <span className={`inline-block mt-2 text-[10px] font-body font-600 uppercase tracking-wider px-2 py-0.5 rounded-md border ${t.badge}`}>
                  {URGENCY_LABEL[r.urgency] || r.urgency}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
    </div>
  );
}
