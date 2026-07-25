/**
 * RiskBadge — coloured pill for risk bands.
 */
const COLORS = {
  low:      'bg-emerald-50 text-emerald-700 border-emerald-100',
  medium:   'bg-amber-50  text-amber-700  border-amber-100',
  high:     'bg-orange-50 text-orange-700 border-orange-100',
  critical: 'bg-red-50    text-red-700    border-red-100',
  ok:           'bg-emerald-50 text-emerald-700 border-emerald-100',
  low_:         'bg-amber-50   text-amber-700   border-amber-100',
  stockout_soon:'bg-orange-50  text-orange-700  border-orange-100',
  below_reorder:'bg-red-50     text-red-700     border-red-100',
  out_of_stock: 'bg-red-100    text-red-800     border-red-200',
};

const LABELS = {
  low:           'Low',
  medium:        'Medium',
  high:          'High',
  critical:      'Critical',
  ok:            'OK',
  low_:          'Low cover',
  stockout_soon: 'Stockout soon',
  below_reorder: 'Below reorder',
  out_of_stock:  'Out of stock',
};

function RiskBadge({ band }) {
  const key = band === 'low' && false ? 'low_' : band; // keep input shape consistent
  const klass = COLORS[band] || 'bg-slate-50 text-slate-600 border-slate-200';
  const label = LABELS[band] || band;
  return (
    <span className={`inline-flex items-center text-[10px] font-body font-700 uppercase tracking-wider px-2 py-0.5 rounded-md border ${klass}`}>
      {label}
    </span>
  );
}

export default RiskBadge;
