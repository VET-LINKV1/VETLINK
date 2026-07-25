import { AlertOctagon, Activity, Info, CheckCircle2 } from 'lucide-react';

/**
 * RecommendationCard — uniform card for a single action recommendation.
 * Used across all three prescriptive tabs.
 */
const PRIORITY_STYLES = {
  critical: { ring: 'ring-red-200 dark:ring-red-500/30',    chip: 'bg-red-50 text-red-700 border-red-200',         icon: AlertOctagon,  iconCls: 'text-red-500' },
  high:     { ring: 'ring-orange-200 dark:ring-orange-500/30', chip: 'bg-orange-50 text-orange-700 border-orange-200', icon: Activity,      iconCls: 'text-orange-500' },
  medium:   { ring: 'ring-amber-200 dark:ring-amber-500/30',  chip: 'bg-amber-50 text-amber-700 border-amber-200',   icon: Info,          iconCls: 'text-amber-500' },
  low:      { ring: 'ring-emerald-200 dark:ring-emerald-500/30', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2, iconCls: 'text-emerald-500' },
};

function RecommendationCard({ rec, onDismiss, onAccept }) {
  if (!rec) return null;
  const style = PRIORITY_STYLES[rec.priority] || PRIORITY_STYLES.medium;
  const Icon  = style.icon;

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm hover:shadow-md transition-shadow p-4 ring-1 ${style.ring}`}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
          <Icon className={`w-4 h-4 ${style.iconCls}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2 flex-wrap">
            <h3 className="font-display text-slate-800 dark:text-white text-sm font-700 leading-snug">
              {rec.title}
            </h3>
            <span className={`text-[10px] font-body font-700 uppercase tracking-wider px-2 py-0.5 rounded-md border ${style.chip}`}>
              {rec.priority}
            </span>
          </div>
          {rec.body && (
            <p className="font-body text-slate-500 dark:text-slate-400 text-xs mt-1 leading-relaxed">
              {rec.body}
            </p>
          )}
          {rec.suggested_action && (
            <div className="mt-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-white/5">
              <p className="font-body text-slate-700 dark:text-slate-200 text-xs">
                <span className="font-600 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] mr-2">Action</span>
                {rec.suggested_action}
              </p>
            </div>
          )}
        </div>
      </div>
      {(onAccept || onDismiss) && (
        <div className="mt-3 flex items-center gap-2 justify-end print:hidden">
          {onDismiss && (
            <button onClick={() => onDismiss(rec)}
              className="text-[11px] font-body font-500 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-1 rounded-md hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
              Dismiss
            </button>
          )}
          {onAccept && (
            <button onClick={() => onAccept(rec)}
              className="text-[11px] font-body font-600 text-white px-3 py-1 rounded-md bg-violet-600 hover:bg-violet-700 transition-colors shadow-sm shadow-violet-500/20">
              Accept
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default RecommendationCard;
