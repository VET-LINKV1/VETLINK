/**
 * VaccinationTimeline.jsx
 * Color-coded horizontal timeline of every vaccine on file for a pet.
 *
 *   Green  → protected      (administered, expiry far away)
 *   Yellow → expiring_soon   (administered, expiring within window)
 *   Red    → overdue         (past due date)
 *   Blue   → scheduled       (planned, due in future)
 *   Slate  → cancelled       (rescinded)
 *
 * Each vaccine renders as a card with the status pill, vaccine name,
 * administered date, due date, and days-until-due / days-overdue.
 *
 * Props:
 *   items   — rows from the passport_vaccination_status_v view
 */
import { Syringe, Shield, ShieldAlert, AlertTriangle, Clock, CircleSlash } from 'lucide-react';

const STATUS = {
  protected:     { color: 'emerald', label: 'Protected',     Icon: Shield,        bar: 'bg-emerald-500' },
  expiring_soon: { color: 'amber',   label: 'Expiring soon', Icon: ShieldAlert,   bar: 'bg-amber-500'   },
  overdue:       { color: 'red',     label: 'Overdue',       Icon: AlertTriangle, bar: 'bg-red-500'     },
  scheduled:     { color: 'blue',    label: 'Scheduled',     Icon: Clock,         bar: 'bg-blue-500'    },
  cancelled:     { color: 'slate',   label: 'Cancelled',     Icon: CircleSlash,   bar: 'bg-slate-400'   },
};

const TINT = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber:   'bg-amber-50   text-amber-700   border-amber-200',
  red:     'bg-red-50     text-red-700     border-red-200',
  blue:    'bg-blue-50    text-blue-700    border-blue-200',
  slate:   'bg-slate-100  text-slate-600   border-slate-200',
};

function fmt(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' }); }
  catch { return d; }
}

function daysLabel(n) {
  if (n == null) return null;
  if (n === 0)   return 'due today';
  if (n  >  0)   return `due in ${n} day${n === 1 ? '' : 's'}`;
  return `${-n} day${n === -1 ? '' : 's'} overdue`;
}

export default function VaccinationTimeline({ items = [] }) {
  if (!items.length) {
    return (
      <p className="text-sm text-slate-400 font-body text-center py-8">
        No vaccinations on file.
      </p>
    );
  }

  // Group by status priority so the most urgent appear first
  const order = ['overdue', 'expiring_soon', 'scheduled', 'protected', 'cancelled'];
  const sorted = [...items].sort((a, b) =>
    order.indexOf(a.passport_status) - order.indexOf(b.passport_status)
  );

  // Legend
  const counts = items.reduce((acc, it) => {
    acc[it.passport_status] = (acc[it.passport_status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(STATUS).map(([k, s]) => (
          <span key={k} className={`inline-flex items-center gap-1.5 text-xs font-body font-600 px-2.5 py-1 rounded-lg border ${TINT[s.color]}`}>
            <span className={`w-2 h-2 rounded-full ${s.bar}`} />
            {s.label}
            {counts[k] != null && <span className="opacity-70">· {counts[k]}</span>}
          </span>
        ))}
      </div>

      <ul className="space-y-3">
        {sorted.map((v) => {
          const s = STATUS[v.passport_status] || STATUS.scheduled;
          const Icon = s.Icon;
          return (
            <li key={v.id} className="flex items-stretch gap-0 overflow-hidden rounded-xl border border-slate-100 dark:border-white/10 bg-white dark:bg-slate-900">
              <div className={`${s.bar} w-1.5 shrink-0`} />
              <div className="flex-1 p-3 sm:p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${TINT[s.color]}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-body font-600 text-slate-700 dark:text-slate-200 truncate">
                        {v.vaccine_name}
                      </p>
                      <p className="text-xs text-slate-400 font-body">
                        {v.manufacturer ? `${v.manufacturer} · ` : ''}{v.dose || ''}
                      </p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-body font-600 uppercase tracking-wider px-2 py-1 rounded-md border ${TINT[s.color]}`}>
                    {s.label}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-body text-slate-500">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">Administered</p>
                    <p className="font-600 text-slate-700 dark:text-slate-200">{fmt(v.administered_date)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">Next due</p>
                    <p className="font-600 text-slate-700 dark:text-slate-200">{fmt(v.due_date)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">Status</p>
                    <p className="font-600 text-slate-700 dark:text-slate-200">{daysLabel(v.days_until_due) || '—'}</p>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
