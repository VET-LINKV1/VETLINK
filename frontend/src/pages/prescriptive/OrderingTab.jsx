/**
 * OrderingTab.jsx
 * Optimized ordering system — predicted demand → suggested purchase order.
 */
import {
  ShoppingCart, PackagePlus, BadgeDollarSign, Boxes, AlertCircle,
} from 'lucide-react';
import KpiTile  from '../../components/healthcheck/KpiTile';
import ChartCard from '../../components/healthcheck/ChartCard';
import { BarChart, HBarChart } from '../../components/healthcheck/charts';
import RecommendationCard from '../../components/prescriptive/RecommendationCard';

function fmtPHP(n) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(n || 0);
}

function priorityChip(p) {
  const cls =
    p === 'critical' ? 'bg-red-50 text-red-700 border-red-200' :
    p === 'high'     ? 'bg-orange-50 text-orange-700 border-orange-200' :
    p === 'medium'   ? 'bg-amber-50 text-amber-700 border-amber-200' :
                       'bg-emerald-50 text-emerald-700 border-emerald-200';
  return `text-[10px] font-body font-700 uppercase tracking-wider px-2 py-0.5 rounded-md border ${cls}`;
}

function OrderingTab({ data, loading }) {
  if (!data) {
    return (
      <div className="p-8 text-center text-slate-400 font-body text-sm border border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
        {loading ? 'Building purchase order…' : 'No ordering recommendations yet.'}
      </div>
    );
  }

  const k  = data.kpis || {};
  const po = data.purchaseOrder || [];
  const recs = data.recommendations || [];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile icon={ShoppingCart}    color="blue"
                 label="Line items" value={k.line_items}
                 sublabel={`covering ${data.horizon_days} days`} />
        <KpiTile icon={PackagePlus}     color="violet"
                 label="Total units" value={k.total_units}
                 sublabel={`${k.critical_items} critical · ${k.high_items} high`} />
        <KpiTile icon={BadgeDollarSign} color="amber"
                 label="Estimated cost" value={fmtPHP(k.estimated_cost_php)}
                 sublabel="At current unit prices" />
        <KpiTile icon={AlertCircle}     color="red"
                 label="Critical SKUs" value={k.critical_items}
                 sublabel="Out-of-stock right now" />
      </div>

      {/* Top-qty chart */}
      <ChartCard
        title="Suggested purchase quantities"
        subtitle="Top 10 line items by units"
        csvFilename="purchase-order-top-units"
        csvData={data.topQtyChart || []}
      >
        <BarChart data={data.topQtyChart || []} />
      </ChartCard>

      {/* Purchase order table */}
      <ChartCard
        title="Suggested purchase order"
        subtitle={`Cover next ${data.horizon_days} days of demand`}
        csvFilename="purchase-order"
        csvData={po.map((p) => ({
          sku: p.sku, name: p.name, category: p.category, unit: p.unit,
          stock_on_hand: p.stock_on_hand, reorder_level: p.reorder_level,
          daily_usage: p.daily_usage, days_of_cover: p.days_of_cover,
          projected_need: p.projected_need, suggested_qty: p.suggested_qty,
          estimated_cost_php: p.estimated_cost_php, priority: p.priority,
        }))}
        csvColumns={['sku','name','category','unit','stock_on_hand','reorder_level','daily_usage','days_of_cover','projected_need','suggested_qty','estimated_cost_php','priority']}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="text-left text-xs font-600 text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-white/10">
                <th className="py-2 pr-3">SKU</th>
                <th className="py-2 pr-3">Medication</th>
                <th className="py-2 pr-3">Priority</th>
                <th className="py-2 pr-3">On hand</th>
                <th className="py-2 pr-3">Days of cover</th>
                <th className="py-2 pr-3">Daily use</th>
                <th className="py-2 pr-3">Projected need</th>
                <th className="py-2 pr-3">Order qty</th>
                <th className="py-2 pr-3">Est. cost</th>
              </tr>
            </thead>
            <tbody>
              {po.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-400 text-xs">
                    No items need ordering right now — inventory looks healthy.
                  </td>
                </tr>
              )}
              {po.slice(0, 30).map((p) => (
                <tr key={p.medication_id} className="border-b border-slate-50 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="py-2 pr-3 text-slate-500 text-xs font-mono">{p.sku || '—'}</td>
                  <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">
                    {p.name}
                    {p.category && <span className="ml-2 text-[10px] text-slate-400 uppercase tracking-wider">{p.category}</span>}
                  </td>
                  <td className="py-2 pr-3"><span className={priorityChip(p.priority)}>{p.priority}</span></td>
                  <td className="py-2 pr-3 text-slate-500">{p.stock_on_hand}</td>
                  <td className="py-2 pr-3 text-slate-500">{p.days_of_cover ?? '—'}</td>
                  <td className="py-2 pr-3 text-slate-500">{p.daily_usage}</td>
                  <td className="py-2 pr-3 text-slate-500">{p.projected_need}</td>
                  <td className="py-2 pr-3 font-600 text-slate-700 dark:text-slate-200">{p.suggested_qty}</td>
                  <td className="py-2 pr-3 text-slate-500">{fmtPHP(p.estimated_cost_php)}</td>
                </tr>
              ))}
            </tbody>
            {po.length > 0 && (
              <tfoot>
                <tr className="border-t border-slate-200 dark:border-white/10">
                  <td colSpan={7} className="py-2 pr-3 text-right text-xs uppercase tracking-wider font-600 text-slate-400">Total</td>
                  <td className="py-2 pr-3 font-700 text-slate-700 dark:text-slate-100">{k.total_units}</td>
                  <td className="py-2 pr-3 font-700 text-slate-700 dark:text-slate-100">{fmtPHP(k.estimated_cost_php)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </ChartCard>

      {/* Recommendation cards */}
      {recs.length > 0 && (
        <section>
          <h2 className="font-display text-slate-800 dark:text-white text-base font-700 mb-3">
            Recommended actions
            <span className="ml-2 text-xs font-body text-slate-400">{recs.length} total</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recs.slice(0, 12).map((r) => <RecommendationCard key={r.id} rec={r} />)}
          </div>
        </section>
      )}

      <p className="text-xs font-body text-slate-400 italic">
        Engine: per-medication 90-day rolling daily-usage × horizon, plus per-category share of
        demand inferred from upcoming appointments. Suggested qty = max(reorder_level, projected_need) − stock_on_hand.
      </p>
    </div>
  );
}

export default OrderingTab;
