function StatCard({ icon: Icon, label, value, color = 'blue', sublabel, trend }) {
  const colors = {
    blue:  { bg:'bg-blue-50',   icon:'text-blue-600',   border:'border-blue-100' },
    violet:{ bg:'bg-violet-50', icon:'text-violet-600', border:'border-violet-100' },
    amber: { bg:'bg-amber-50',  icon:'text-amber-600',  border:'border-amber-100' },
    sky:   { bg:'bg-sky-50',    icon:'text-sky-600',    border:'border-sky-100' },
    teal:  { bg:'bg-teal-50',   icon:'text-teal-600',   border:'border-teal-100' },
    brand: { bg:'bg-blue-50',   icon:'text-blue-600',   border:'border-blue-100' },
  };
  const c = colors[color] || colors.blue;
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-white/10 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-body font-600 px-2 py-1 rounded-lg ${trend >= 0 ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-500'}`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <p className="font-display text-slate-800 dark:text-white text-2xl font-700">{value}</p>
      <p className="font-body text-slate-500 dark:text-slate-400 dark:text-slate-500 text-sm mt-0.5">{label}</p>
      {sublabel && <p className="font-body text-slate-400 dark:text-slate-500 text-xs mt-1">{sublabel}</p>}
    </div>
  );
}
export default StatCard;
