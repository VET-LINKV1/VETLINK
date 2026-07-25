/**
 * VisitChart — simple bar chart for visits over the last 6 months.
 * Uses pure CSS bars (no external chart library needed).
 */
function VisitChart({ data, petName }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
      <div className="mb-5">
        <h4 className="font-display text-slate-800 font-600 text-sm">
          Visit Frequency — {petName}
        </h4>
        <p className="text-slate-400 text-xs font-body mt-0.5">Last 6 months</p>
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-2 h-32">
        {data.map((month, i) => {
          const heightPct = maxCount > 0 ? (month.count / maxCount) * 100 : 0;
          const hasVisit = month.count > 0;

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              {/* Count label */}
              <span className="text-xs font-display font-600 text-slate-500">
                {month.count > 0 ? month.count : ''}
              </span>

              {/* Bar */}
              <div className="w-full flex items-end" style={{ height: '80px' }}>
                <div
                  className={`w-full rounded-t-lg transition-all duration-500 ${
                    hasVisit ? 'bg-blue-500' : 'bg-slate-100'
                  }`}
                  style={{ height: `${Math.max(heightPct, hasVisit ? 15 : 8)}%` }}
                />
              </div>

              {/* Month label */}
              <span className="text-xs font-body text-slate-400 whitespace-nowrap">{month.label}</span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-blue-500" />
          <span className="text-xs font-body text-slate-400">Completed visit</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-slate-100" />
          <span className="text-xs font-body text-slate-400">No visit</span>
        </div>
      </div>
    </div>
  );
}

export default VisitChart;
