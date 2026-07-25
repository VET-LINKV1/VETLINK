import { useState } from 'react';
import { PawPrint, Loader2, AlertCircle } from 'lucide-react';

const SPECIES = ['Dog', 'Cat', 'Bird', 'Rabbit', 'Hamster', 'Fish', 'Reptile', 'Other'];

function PetForm({ initialData, onSubmit, onCancel }) {
  const isEdit = !!initialData;

  const [form, setForm] = useState({
    name:      '',
    species:   'Dog',
    breed:     '',
    age:       '',
    gender:    'unknown',
    weight_kg: '',
    notes:     '',
    ...initialData,
  });
  const [errors, setErrors]           = useState({});
  const [loading, setLoading]         = useState(false);
  const [serverError, setServerError] = useState('');

  const set = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name    = 'Pet name is required';
    if (!form.species)     e.species = 'Species is required';
    if (form.age !== '' && (isNaN(form.age) || form.age < 0 || form.age > 50)) {
      e.age = 'Enter a valid age (0–50)';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setServerError('');
    try {
      await onSubmit({
        ...form,
        age:       form.age !== '' ? parseInt(form.age) : null,
        weight_kg: form.weight_kg !== '' ? parseFloat(form.weight_kg) : null,
      });
    } catch (err) {
      setServerError(err?.response?.data?.error || 'Failed to save pet. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (key) => `
    w-full px-4 py-2.5 rounded-xl border text-sm font-body
    focus:outline-none focus:ring-2 focus:border-transparent transition-all
    ${errors[key]
      ? 'border-red-300 bg-red-50 focus:ring-red-400'
      : 'border-slate-200 bg-white focus:ring-blue-500'}
  `;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {serverError && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-500 font-body">{serverError}</p>
        </div>
      )}

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5 font-body">Pet Name *</label>
        <input value={form.name} onChange={e => set('name', e.target.value)}
          placeholder="Buddy" className={inputClass('name')} />
        {errors.name && <p className="mt-1 text-xs text-red-500 font-body">{errors.name}</p>}
      </div>

      {/* Species + Breed */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5 font-body">Species *</label>
          <select value={form.species} onChange={e => set('species', e.target.value)}
            className={inputClass('species')}>
            {SPECIES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5 font-body">Breed</label>
          <input value={form.breed} onChange={e => set('breed', e.target.value)}
            placeholder="Golden Retriever" className={inputClass('breed')} />
        </div>
      </div>

      {/* Age + Weight */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5 font-body">Age (years)</label>
          <input type="number" min="0" max="50" value={form.age}
            onChange={e => set('age', e.target.value)}
            placeholder="3" className={inputClass('age')} />
          {errors.age && <p className="mt-1 text-xs text-red-500 font-body">{errors.age}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5 font-body">Weight (kg)</label>
          <input type="number" min="0" step="0.1" value={form.weight_kg}
            onChange={e => set('weight_kg', e.target.value)}
            placeholder="5.5" className={inputClass('weight_kg')} />
        </div>
      </div>

      {/* Gender */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5 font-body">Gender</label>
        <div className="flex gap-2">
          {['male', 'female', 'unknown'].map(g => (
            <button key={g} type="button" onClick={() => set('gender', g)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-body font-500 capitalize border transition-all
                ${form.gender === g
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}>
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5 font-body">Notes</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
          rows={3} placeholder="Any special conditions, allergies, or notes..."
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-body focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-body font-500 text-sm hover:bg-slate-50 transition-all">
          Cancel
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-display font-600 text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 disabled:opacity-60 transition-all">
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
            : isEdit ? 'Save Changes' : 'Add Pet'}
        </button>
      </div>
    </form>
  );
}

export default PetForm;
