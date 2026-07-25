/**
 * RoleFields.jsx
 * Dynamic form fields rendered based on selected role.
 * - veterinarian → License Number + Specialization
 * - staff        → Position (Assistant / Technician)
 * - admin        → No extra fields
 */

const SPECIALIZATIONS = [
  'General Practice',
  'Surgery',
  'Dentistry',
  'Dermatology',
  'Cardiology',
  'Ophthalmology',
  'Orthopedics',
  'Oncology',
  'Emergency & Critical Care',
  'Other',
];

function RoleFields({ role, values, errors, onChange }) {
  const inputClass = (key) => `
    w-full px-4 py-2.5 rounded-xl border text-sm font-body
    focus:outline-none focus:ring-2 focus:border-transparent transition-all
    ${errors[key]
      ? 'border-red-300 bg-red-50 focus:ring-red-400'
      : 'border-slate-200 bg-white focus:ring-blue-500'}
  `;

  if (role === 'veterinarian') {
    return (
      <div className="space-y-4 p-4 rounded-xl bg-blue-50 border border-blue-100">
        <p className="text-xs font-body font-600 text-blue-600 uppercase tracking-wide">
          Veterinarian Details
        </p>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5 font-body">
            License Number *
          </label>
          <input
            value={values.licenseNumber || ''}
            onChange={e => onChange('licenseNumber', e.target.value)}
            placeholder="e.g. PRC-VET-12345"
            className={inputClass('licenseNumber')}
          />
          {errors.licenseNumber && (
            <p className="mt-1 text-xs text-red-500 font-body">{errors.licenseNumber}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5 font-body">
            Specialization *
          </label>
          <select
            value={values.specialization || ''}
            onChange={e => onChange('specialization', e.target.value)}
            className={inputClass('specialization')}
          >
            <option value="">Select specialization...</option>
            {SPECIALIZATIONS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {errors.specialization && (
            <p className="mt-1 text-xs text-red-500 font-body">{errors.specialization}</p>
          )}
        </div>
      </div>
    );
  }

  if (role === 'staff') {
    return (
      <div className="space-y-4 p-4 rounded-xl bg-blue-50 border border-blue-100">
        <p className="text-xs font-body font-600 text-blue-600 uppercase tracking-wide">
          Staff Details
        </p>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5 font-body">
            Position *
          </label>
          <div className="flex gap-3">
            {['assistant', 'technician'].map(pos => (
              <button
                key={pos}
                type="button"
                onClick={() => onChange('position', pos)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-body font-500 capitalize border transition-all
                  ${values.position === pos
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                  }`}
              >
                {pos}
              </button>
            ))}
          </div>
          {errors.position && (
            <p className="mt-1 text-xs text-red-500 font-body">{errors.position}</p>
          )}
        </div>
      </div>
    );
  }

  // Admin — no extra fields
  return null;
}

export default RoleFields;
