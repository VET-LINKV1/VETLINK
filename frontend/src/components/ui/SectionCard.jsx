function SectionCard({ title, subtitle, children, action }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10 dark:border-white/10">
        <div>
          <h3 className="font-display text-slate-800 dark:text-white text-base font-600">{title}</h3>
          {subtitle && <p className="font-body text-slate-400 dark:text-slate-500 text-xs mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
export default SectionCard;
