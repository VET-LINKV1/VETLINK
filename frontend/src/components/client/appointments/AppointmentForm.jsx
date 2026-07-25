import { useState } from 'react';
import { Calendar, Clock, FileText, PawPrint, Loader2, AlertCircle } from 'lucide-react';

const SERVICE_TYPES = [
  'General Checkup',
  'Vaccination',
  'Dental Cleaning',
  'Surgery Prep',
  'Follow-up Visit',
  'Grooming',
  'Deworming',
  'Emergency',
  'Other',
];

function AppointmentForm({ pets, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    petId: '',
    type: 'General Checkup',
    date: '',
    time: '',
    notes: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const set = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.petId)  e.petId = 'Please select a pet';
    if (!form.type)   e.type  = 'Please select a service';
    if (!form.date)   e.date  = 'Please select a date';
    if (!form.time)   e.time  = 'Please select a time';
    // Date must not be in the past
    if (form.date) {
      const selected = new Date(`${form.date}T${form.time || '00:00'}`);
      if (selected < new Date()) e.date = 'Appointment must be in the future';
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
      const appointmentAt = new Date(`${form.date}T${form.time}`).toISOString();
      await onSubmit({
        petId: form.petId,
        type: form.type,
        appointmentAt,
        notes: form.notes,
      });
    } catch (err) {
      setServerError(err?.response?.data?.error || 'Failed to book appointment. Please try again.');
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

  // Get today's date in YYYY-MM-DD for min date
  const today = new Date().toISOString().split('T')[0];

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {serverError && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-500 font-body">{serverError}</p>
        </div>
      )}

      {/* Pet selection */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5 font-body">
          <span className="flex items-center gap-1.5"><PawPrint className="w-3.5 h-3.5" /> Select Pet *</span>
        </label>
        <select value={form.petId} onChange={e => set('petId', e.target.value)}
          className={inputClass('petId')}>
          <option value="">Choose a pet...</option>
          {pets.map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.species})</option>
          ))}
        </select>
        {errors.petId && <p className="mt-1 text-xs text-red-500 font-body">{errors.petId}</p>}
        {pets.length === 0 && (
          <p className="mt-1 text-xs text-amber-500 font-body">
            No pets registered yet. Please add a pet first.
          </p>
        )}
      </div>

      {/* Service type */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5 font-body">
          <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Service Type *</span>
        </label>
        <select value={form.type} onChange={e => set('type', e.target.value)}
          className={inputClass('type')}>
          {SERVICE_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        {errors.type && <p className="mt-1 text-xs text-red-500 font-body">{errors.type}</p>}
      </div>

      {/* Date & Time */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5 font-body">
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Date *</span>
          </label>
          <input type="date" value={form.date} min={today}
            onChange={e => set('date', e.target.value)}
            className={inputClass('date')} />
          {errors.date && <p className="mt-1 text-xs text-red-500 font-body">{errors.date}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5 font-body">
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Time *</span>
          </label>
          <input type="time" value={form.time}
            onChange={e => set('time', e.target.value)}
            className={inputClass('time')} />
          {errors.time && <p className="mt-1 text-xs text-red-500 font-body">{errors.time}</p>}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5 font-body">
          Notes / Reason for Visit
        </label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
          rows={3} placeholder="Describe symptoms or reason for the visit..."
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-body focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-body font-500 text-sm hover:bg-slate-50 transition-all">
          Cancel
        </button>
        <button type="submit" disabled={loading || pets.length === 0}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-display font-600 text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 disabled:opacity-60 disabled:cursor-not-allowed transition-all">
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Booking...</>
            : 'Book Appointment'}
        </button>
      </div>
    </form>
  );
}

export default AppointmentForm;
