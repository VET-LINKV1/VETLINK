/**
 * KpiTile — variant of StatCard tuned for the Health Check dashboard.
 * Supports an optional sparkline below the value.
 */
function KpiTile({ icon: Icon, label, value, sublabel, color = 'blue', sparkline, trend }) {
  const colors = {
    blue:   { bg: 'bg-blue-50',    icon: 'text-blue-600',    border: 'border-blue-100' },
    sky:    { bg: 'bg-sky-50',     icon: 'text-sky-600',     border: 'border-sky-100' },
    teal:   { bg: 'bg-teal-50',    icon: 'text-teal-600',    border: 'border-teal-100' },
    violet: { bg: 'bg-violet-50',  icon: 'text-violet-600',  border: 'border-violet-100' },
    amber:  { bg: 'bg-amber-50',   icon: 'text-amber-600',   border: 'border-amber-100' },
    emerald:{ bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-100' },
    red:    { bg: 'bg-red-50',     icon: 'text-red-500',     border: 'border-red-100' },
    slate:  { bg: 'bg-slate-50',   icon: 'text-slate-600',   border: 'border-slate-200' },
  };
  const c = colors[color] || colors.blue;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-white/10 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center`}>
          {Icon ? <Icon className={`w-5 h-5 ${c.icon}`} /> : null}
        </div>
        {trend !== undefined && trend !== null && (
          <span className={`text-xs font-body font-600 px-2 py-1 rounded-lg ${trend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div>
        <p className="font-display text-slate-800 dark:text-white text-2xl font-700 leading-tight">{value}</p>
        <p className="font-body text-slate-500 dark:text-slate-400 text-sm mt-0.5">{label}</p>
        {sublabel && (
          <p className="font-body text-slate-400 dark:text-slate-500 text-xs mt-1">{sublabel}</p>
        )}
      </div>
      {sparkline}
    </div>
  );
}

export default KpiTile;
