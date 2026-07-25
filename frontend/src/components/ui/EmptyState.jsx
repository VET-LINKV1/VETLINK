function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
        <Icon className="w-8 h-8 text-slate-300" />
      </div>
      <h3 className="font-display text-slate-600 font-600 mb-1">{title}</h3>
      {description && <p className="text-slate-400 font-body text-sm mb-5">{description}</p>}
      {action}
    </div>
  );
}
export default EmptyState;
