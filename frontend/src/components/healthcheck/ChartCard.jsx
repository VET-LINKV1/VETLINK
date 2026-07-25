import { Download } from 'lucide-react';
import { downloadChartCsv } from '../../utils/exportHelpers';

/**
 * ChartCard — uniform wrapper around any chart panel.
 * Provides title, subtitle, optional CSV download button.
 */
function ChartCard({ title, subtitle, csvFilename, csvData, csvColumns, children, action }) {
  const canExport = csvFilename && Array.isArray(csvData) && csvData.length > 0;

  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm p-5">
      <header className="flex items-start justify-between mb-4 gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-slate-800 dark:text-white text-base font-700 truncate">{title}</h3>
          {subtitle && (
            <p className="font-body text-slate-400 dark:text-slate-500 text-xs mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 print:hidden">
          {action}
          {canExport && (
            <button
              onClick={() => downloadChartCsv(csvFilename, csvData, csvColumns)}
              className="inline-flex items-center gap-1.5 text-xs font-body font-500 text-slate-500 hover:text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
              title="Download CSV"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          )}
        </div>
      </header>
      <div>{children}</div>
    </section>
  );
}

export default ChartCard;
