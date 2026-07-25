/**
 * ShrinkageTab.jsx
 * Inventory shrinkage — used vs billed, expired, low stock.
 */
import {
  Boxes, AlertTriangle, CalendarX, TrendingDown, PackageMinus, PackageX,
} from 'lucide-react';
import KpiTile  from '../../components/healthcheck/KpiTile';
import ChartCard from '../../components/healthcheck/ChartCard';
import { HBarChart, BarChart } from '../../components/healthcheck/charts';

function fmtPHP(n) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(n || 0);
}

function ShrinkageTab({ data, loading }) {
  if (!data) {
    return (
      <div className="p-8 text-center text-slate-400 font-body text-sm border border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
        {loading ? 'Loading inventory shrinkage…' : 'No inventory data yet. Stock medications and start logging transactions.'}
      </div>
    );
  }
  const k = data.kpis || {};
  const c = data.charts || {};
  const rows = data.table || [];
  const expiring = data.expiringBatches || [];

  // Build a paired bar dataset for usage vs billed
  const usedVsBilledData = (c.usageVsBilled || []).flatMap((r) => ([
    { key: r.key + ' · used',   count: r.used },
    { key: r.key + ' · billed', count: r.billed },
  ]));

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile icon={PackageMinus}  color="red"
                 label="Shrinkage (units)" value={k.totalDiscrepancy}
                 sublabel={`${k.shrinkagePct}% of used quantity`} />
        <KpiTile icon={TrendingDown}  color="amber"
                 label="Shrink value" value={fmtPHP(k.totalShrinkPHP)}
                 sublabel="lost value (used − billed)" />
        <KpiTile icon={Boxes}         color="blue"
                 label="Used (window)" value={k.totalUsed}
                 sublabel={`vs ${k.totalBilled} billed`} />
        <KpiTile icon={Boxes}         color="slate"
                 label="Tracked SKUs" value={k.totalMedications} />

        <KpiTile icon={CalendarX}     color="red"
                 label="Expired batches" value={k.expiredBatches}
                 sublabel={fmtPHP(k.expiringValuePHP) + ' at-risk value'} />
        <KpiTile icon={CalendarX}     color="amber"
                 label="Expiring soon" value={k.expiringSoonBatches}
                 sublabel="next 60 days" />
        <KpiTile icon={AlertTriangle} color="violet"
                 label="Low-stock SKUs" value={k.lowStockCount}
                 sublabel="≤ reorder level" />
        <KpiTile icon={PackageX}      color="teal"
                 label="Expired qty (window)" value={k.totalExpiredQty}
                 sublabel="logged write-offs" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Top discrepancies (used − billed)"
          subtitle="Medications where consumption exceeds invoicing"
          csvFilename="top-discrepancies"
          csvData={c.topDiscrepancies}
        >
          <HBarChart data={c.topDiscrepancies} />
        </ChartCard>
        <ChartCard
          title="Expired by medication"
          subtitle="Total expired quantity in this window"
          csvFilename="expired-by-medication"
          csvData={c.expiredByMedication}
        >
          <HBarChart data={c.expiredByMedication} />
        </ChartCard>
      </div>

      <ChartCard
        title="Usage vs billed (top 10 by total volume)"
        subtitle="Side-by-side comparison of consumption and invoicing"
        csvFilename="usage-vs-billed"
        csvData={c.usageVsBilled}
        csvColumns={['key','used','billed']}
      >
        <BarChart data={usedVsBilledData} />
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Low-stock SKUs"
          subtitle="Stock on hand at or below reorder level"
          csvFilename="low-stock"
          csvData={c.lowStockList}
        >
          <HBarChart data={c.lowStockList} />
        </ChartCard>

        <ChartCard
          title="Expiring batches (≤ 60 days)"
          subtitle="Already expired or expiring soon"
          csvFilename="expiring-batches"
          csvData={expiring}
          csvColumns={['medicationName','batchNo','qty','expiresAt','daysToExpiry','status']}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/10 text-left text-slate-500">
                  <th className="py-2 font-body font-600">Medication</th>
                  <th className="py-2 font-body font-600">Batch</th>
                  <th className="py-2 font-body font-600 text-right">Qty</th>
                  <th className="py-2 font-body font-600">Expires</th>
                  <th className="py-2 font-body font-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {expiring.map((b, i) => (
                  <tr key={i} className="border-b border-slate-50 dark:border-white/5">
                    <td className="py-2 font-body text-slate-700 dark:text-slate-200">{b.medicationName}</td>
                    <td className="py-2 font-mono text-slate-500">{b.batchNo || '—'}</td>
                    <td className="py-2 font-mono text-right text-slate-500">{b.qty}</td>
                    <td className="py-2 font-mono text-slate-500">{b.expiresAt}</td>
                    <td className="py-2 font-body">
                      {b.status === 'expired'
                        ? <span className="text-red-500">Expired</span>
                        : <span className="text-amber-600">In {b.daysToExpiry}d</span>}
                    </td>
                  </tr>
                ))}
                {expiring.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-slate-400 font-body">No expiring batches.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      {/* Full table */}
      <ChartCard
        title={`Per-medication shrinkage table (${rows.length})`}
        subtitle="All tracked medications, sorted by discrepancy"
        csvFilename="shrinkage-table"
        csvData={rows}
        csvColumns={['sku','name','category','unit','stockOnHand','reorderLevel','usedWindow','billedWindow','expiredWindow','discrepancy','shrinkValuePHP','lowStock']}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/10 text-left text-slate-500">
                <th className="py-2 font-body font-600">SKU</th>
                <th className="py-2 font-body font-600">Name</th>
                <th className="py-2 font-body font-600">Cat.</th>
                <th className="py-2 font-body font-600 text-right">On hand</th>
                <th className="py-2 font-body font-600 text-right">Used</th>
                <th className="py-2 font-body font-600 text-right">Billed</th>
                <th className="py-2 font-body font-600 text-right">Expired</th>
                <th className="py-2 font-body font-600 text-right">Δ</th>
                <th className="py-2 font-body font-600 text-right">Shrink ₱</th>
                <th className="py-2 font-body font-600 text-center">Low?</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-50 dark:border-white/5">
                  <td className="py-2 font-mono text-slate-500">{r.sku}</td>
                  <td className="py-2 font-body text-slate-700 dark:text-slate-200">{r.name}</td>
                  <td className="py-2 font-body text-slate-400 capitalize">{r.category || '—'}</td>
                  <td className="py-2 font-mono text-right text-slate-500">{r.stockOnHand}</td>
                  <td className="py-2 font-mono text-right text-slate-500">{r.usedWindow}</td>
                  <td className="py-2 font-mono text-right text-slate-500">{r.billedWindow}</td>
                  <td className="py-2 font-mono text-right text-slate-500">{r.expiredWindow}</td>
                  <td className={`py-2 font-mono text-right ${r.discrepancy > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                    {r.discrepancy}
                  </td>
                  <td className="py-2 font-mono text-right text-slate-500">{fmtPHP(r.shrinkValuePHP)}</td>
                  <td className="py-2 text-center">
                    {r.lowStock
                      ? <span className="inline-block px-1.5 py-0.5 rounded bg-red-50 text-red-500 text-[10px] font-600">LOW</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={10} className="py-6 text-center text-slate-400 font-body">No medications tracked yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}

export default ShrinkageTab;
