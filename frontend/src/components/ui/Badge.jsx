const VARIANTS = {
  pending:   'bg-amber-50 text-amber-600 border-amber-200',
  confirmed: 'bg-blue-50 text-blue-600 border-blue-200',
  completed: 'bg-slate-100 text-slate-500 border-slate-200',
  cancelled: 'bg-red-50 text-red-400 border-red-200',
  no_show:   'bg-red-50 text-red-600 border-red-200',
  declined:  'bg-red-50 text-red-600 border-red-200',
};
function Badge({ label, variant = 'pending' }) {
  return (
    <span className={`inline-flex items-center text-xs font-body font-600 px-2.5 py-1 rounded-lg border capitalize ${VARIANTS[variant] || VARIANTS.pending}`}>
      {label}
    </span>
  );
}
export default Badge;
