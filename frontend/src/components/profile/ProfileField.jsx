/**
 * ProfileField.jsx
 * Reusable display/edit field for the profile page.
 * Shows label + value in read mode, input in edit mode.
 */
function ProfileField({ label, value, editValue, onChange, type = 'text', editing, error, placeholder, options, disabled }) {
  if (!editing) {
    return (
      <div className="py-3 border-b border-slate-100 last:border-0">
        <p className="text-xs font-body font-600 text-slate-400 uppercase tracking-wide mb-1">{label}</p>
        <p className="text-slate-700 font-body text-sm font-500">
          {value || <span className="text-slate-300 italic">Not set</span>}
        </p>
      </div>
    );
  }

  const inputClass = `
    w-full px-4 py-2.5 rounded-xl border text-sm font-body
    focus:outline-none focus:ring-2 focus:border-transparent transition-all
    ${error ? 'border-red-300 bg-red-50 focus:ring-red-400' : 'border-slate-200 bg-white focus:ring-blue-500'}
    ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}
  `;

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5 font-body">{label}</label>
      {options ? (
        <select value={editValue || ''} onChange={e => onChange(e.target.value)} disabled={disabled} className={inputClass}>
          <option value="">Select...</option>
          {options.map(opt => (
            <option key={opt.value || opt} value={opt.value || opt}>{opt.label || opt}</option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={editValue || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={inputClass}
        />
      )}
      {error && <p className="mt-1 text-xs text-red-500 font-body">{error}</p>}
    </div>
  );
}

export default ProfileField;
