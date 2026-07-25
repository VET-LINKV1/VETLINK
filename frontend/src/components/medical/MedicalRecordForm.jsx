/**
 * MedicalRecordForm.jsx
 * Vet creates or edits a medical record.
 * Can be linked to a completed appointment.
 */
import { useState } from 'react';
import { medicalRecordService } from '../../services/medicalRecordService';
import {
  Stethoscope, Pill, FileText, Thermometer, Weight,
  Calendar, X, Loader2, CheckCircle, AlertCircle,
} from 'lucide-react';

function MedicalRecordForm({ pet, appointment, existingRecord, onSuccess, onClose }) {
  const isEdit = !!existingRecord;

  const [form, setForm] = useState({
    diagnosis:    existingRecord?.diagnosis    || '',
    treatment:    existingRecord?.treatment    || '',
    prescription: existingRecord?.prescription || '',
    notes:        existingRecord?.notes        || '',
    visitDate:    existingRecord?.visit_date   || new Date().toISOString().split('T')[0],
    weightKg:     existingRecord?.weight_kg    || '',
    temperatureC: existingRecord?.temperature_c || '',
    followUpDate: existingRecord?.follow_up_date || '',
  });

  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);

  const set = (key, val) => { setForm(p => ({ ...p, [key]: val })); setErrors(p => ({ ...p, [key]: '' })); };

  const validate = () => {
    const e = {};
    if (!form.diagnosis.trim()) e.diagnosis = 'Diagnosis is required';
    if (!form.visitDate)        e.visitDate  = 'Visit date is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setError('');
    try {
      const payload = {
        petId:         pet?.id,
        appointmentId: appointment?.id || undefined,
        visitDate:     form.visitDate,
        diagnosis:     form.diagnosis,
        treatment:     form.treatment     || undefined,
        prescription:  form.prescription  || undefined,
        notes:         form.notes         || undefined,
        weightKg:      form.weightKg      ? parseFloat(form.weightKg)      : undefined,
        temperatureC:  form.temperatureC  ? parseFloat(form.temperatureC)  : undefined,
        followUpDate:  form.followUpDate  || undefined,
      };

      const result = isEdit
        ? await medicalRecordService.update(existingRecord.id, payload)
        : await medicalRecordService.create(payload);

      setSuccess(true);
      setTimeout(() => onSuccess(result), 1200);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save record.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (key) => `
    w-full px-4 py-2.5 rounded-xl border text-sm font-body bg-white
    focus:outline-none focus:ring-2 focus:border-transparent transition-all
    ${errors[key] ? 'border-red-300 focus:ring-red-400' : 'border-slate-200 focus:ring-blue-500'}
  `;

  if (success) return (
    <div className="p-12 text-center">
      <div className="w-16 h-16 rounded-full bg-teal-50 border-4 border-teal-100 flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="w-8 h-8 text-teal-600" />
      </div>
      <h3 className="font-display text-slate-800 text-xl font-700 mb-1">
        {isEdit ? 'Record Updated!' : 'Record Created!'}
      </h3>
      <p className="text-slate-400 font-body text-sm">The client will be notified.</p>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
        <div>
          <h2 className="font-display text-slate-800 text-lg font-700">
            {isEdit ? 'Edit Medical Record' : 'New Medical Record'}
          </h2>
          {pet && (
            <p className="text-slate-400 text-xs font-body mt-0.5">
              {pet.name} · {pet.species}{pet.breed ? ` · ${pet.breed}` : ''}
              {appointment && ` · ${appointment.type}`}
            </p>
          )}
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-5">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-red-500 text-sm font-body">{error}</p>
          </div>
        )}

        {/* Visit info row */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-body font-600 text-slate-600 mb-1.5 uppercase tracking-wide">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Visit Date *</span>
            </label>
            <input type="date" value={form.visitDate} onChange={e => set('visitDate', e.target.value)}
              className={inputClass('visitDate')} />
            {errors.visitDate && <p className="mt-1 text-xs text-red-500">{errors.visitDate}</p>}
          </div>
          <div>
            <label className="block text-xs font-body font-600 text-slate-600 mb-1.5 uppercase tracking-wide">
              <span className="flex items-center gap-1"><Weight className="w-3 h-3" /> Weight (kg)</span>
            </label>
            <input type="number" step="0.01" min="0" max="999" value={form.weightKg}
              onChange={e => set('weightKg', e.target.value)}
              placeholder="e.g. 12.5" className={inputClass('weightKg')} />
          </div>
          <div>
            <label className="block text-xs font-body font-600 text-slate-600 mb-1.5 uppercase tracking-wide">
              <span className="flex items-center gap-1"><Thermometer className="w-3 h-3" /> Temp (°C)</span>
            </label>
            <input type="number" step="0.1" min="30" max="45" value={form.temperatureC}
              onChange={e => set('temperatureC', e.target.value)}
              placeholder="e.g. 38.5" className={inputClass('temperatureC')} />
          </div>
        </div>

        {/* Diagnosis */}
        <div>
          <label className="block text-xs font-body font-600 text-slate-600 mb-1.5 uppercase tracking-wide">
            <span className="flex items-center gap-1"><Stethoscope className="w-3 h-3" /> Diagnosis *</span>
          </label>
          <textarea rows={3} value={form.diagnosis} onChange={e => set('diagnosis', e.target.value)}
            placeholder="Clinical findings and diagnosis..."
            className={`${inputClass('diagnosis')} resize-none`} />
          {errors.diagnosis && <p className="mt-1 text-xs text-red-500">{errors.diagnosis}</p>}
        </div>

        {/* Treatment */}
        <div>
          <label className="block text-xs font-body font-600 text-slate-600 mb-1.5 uppercase tracking-wide">
            <span className="flex items-center gap-1"><Stethoscope className="w-3 h-3" /> Treatment Plan</span>
          </label>
          <textarea rows={3} value={form.treatment} onChange={e => set('treatment', e.target.value)}
            placeholder="Procedures performed, treatments applied..."
            className={`${inputClass('treatment')} resize-none`} />
        </div>

        {/* Prescription */}
        <div>
          <label className="block text-xs font-body font-600 text-slate-600 mb-1.5 uppercase tracking-wide">
            <span className="flex items-center gap-1"><Pill className="w-3 h-3" /> Prescription</span>
          </label>
          <textarea rows={2} value={form.prescription} onChange={e => set('prescription', e.target.value)}
            placeholder="Medications, dosage, duration..."
            className={`${inputClass('prescription')} resize-none`} />
        </div>

        {/* Notes + Follow-up row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-body font-600 text-slate-600 mb-1.5 uppercase tracking-wide">
              <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> Additional Notes</span>
            </label>
            <textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Observations, recommendations..."
              className={`${inputClass('notes')} resize-none`} />
          </div>
          <div>
            <label className="block text-xs font-body font-600 text-slate-600 mb-1.5 uppercase tracking-wide">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Follow-up Date</span>
            </label>
            <input type="date" value={form.followUpDate} onChange={e => set('followUpDate', e.target.value)}
              className={inputClass('followUpDate')} />
            <p className="mt-1 text-xs text-slate-400 font-body">Leave blank if not needed</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-body font-500 text-sm hover:bg-slate-50 transition-all">
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-display font-600 text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-500/25 disabled:opacity-60 transition-all">
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
              : isEdit ? 'Update Record' : 'Save Record'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default MedicalRecordForm;
