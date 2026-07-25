/**
 * VaccinationTracker.jsx
 * Lists vaccinations for a pet, color-coded by status. Staff/vets
 * can add new entries and mark scheduled doses as administered.
 *
 * Props:
 *   petId
 *   vaccinations  Array<vaccination>
 *   canWrite      boolean
 *   onChange()    refresh callback after mutations
 */
import { useState } from 'react';
import { Syringe, Plus, Check, Loader2, AlertTriangle, Calendar, Trash2 } from 'lucide-react';
import { emrService } from '../../services/emrService';

const STATUS_STYLE = {
  scheduled:    'bg-blue-50 text-blue-600 border-blue-200',
  administered: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  overdue:      'bg-red-50 text-red-600 border-red-200',
  cancelled:    'bg-slate-100 text-slate-500 border-slate-200',
};

function fmt(d) { return d ? new Date(d).toLocaleDateString() : '—'; }

export default function VaccinationTracker({ petId, vaccinations = [], canWrite, onChange }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    vaccineName: '', manufacturer: '', batchNumber: '', dose: '',
    administeredDate: '', dueDate: '', notes: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await emrService.createVaccination({
        petId,
        ...form,
        administeredDate: form.administeredDate || null,
        dueDate: form.dueDate || null,
      });
      setShowForm(false);
      setForm({ vaccineName: '', manufacturer: '', batchNumber: '', dose: '', administeredDate: '', dueDate: '', notes: '' });
      onChange && onChange();
    } catch (e2) {
      setErr(e2?.response?.data?.error || 'Failed to save vaccination.');
    } finally { setBusy(false); }
  };

  const markAdministered = async (v) => {
    try {
      await emrService.updateVaccination(v.id, {
        administeredDate: new Date().toISOString().slice(0, 10),
        status: 'administered',
      });
      onChange && onChange();
    } catch (_) {}
  };

  const remove = async (v) => {
    if (!confirm(`Delete vaccination "${v.vaccine_name}"?`)) return;
    try { await emrService.deleteVaccination(v.id); onChange && onChange(); } catch (_) {}
  };

  return (
    <div className="space-y-3">
      {canWrite && (
        <div className="flex items-center justify-between">
          <p className="text-xs font-body text-slate-400 dark:text-slate-500">
            {vaccinations.length} vaccination{vaccinations.length === 1 ? '' : 's'} on file
          </p>
          <button onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-body font-600 bg-emerald-50 hover:bg-emerald-100 text-emerald-700">
            <Plus className="w-3.5 h-3.5" /> {showForm ? 'Close' : 'Add vaccination'}
          </button>
        </div>
      )}

      {showForm && canWrite && (
        <form onSubmit={submit} className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input required placeholder="Vaccine name *" value={form.vaccineName}
            onChange={(e) => setForm({ ...form, vaccineName: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white" />
          <input placeholder="Manufacturer" value={form.manufacturer}
            onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white" />
          <input placeholder="Batch number" value={form.batchNumber}
            onChange={(e) => setForm({ ...form, batchNumber: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white" />
          <input placeholder="Dose (e.g. 1 ml)" value={form.dose}
            onChange={(e) => setForm({ ...form, dose: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white" />
          <label className="text-xs font-body text-slate-500 col-span-1">
            Administered date
            <input type="date" value={form.administeredDate}
              onChange={(e) => setForm({ ...form, administeredDate: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white" />
          </label>
          <label className="text-xs font-body text-slate-500 col-span-1">
            Next due date
            <input type="date" value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white" />
          </label>
          <textarea rows={2} placeholder="Notes" value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="sm:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white" />
          {err && <p className="sm:col-span-2 text-xs text-red-500">{err}</p>}
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" disabled={busy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-body font-600 disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save
            </button>
          </div>
        </form>
      )}

      {!vaccinations.length ? (
        <p className="text-sm text-slate-400 font-body text-center py-6">No vaccinations recorded.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-white/5">
          {vaccinations.map((v) => (
            <li key={v.id} className="py-3 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <Syringe className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-body font-600 text-slate-700 dark:text-slate-200 truncate">
                    {v.vaccine_name}
                  </p>
                  <span className={`text-[10px] font-body font-600 px-2 py-0.5 rounded-md border ${STATUS_STYLE[v.status] || STATUS_STYLE.scheduled}`}>
                    {v.status}
                  </span>
                  {v.status === 'overdue' && (
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" title="Overdue" />
                  )}
                </div>
                <p className="text-xs text-slate-400 font-body mt-0.5">
                  Administered: {fmt(v.administered_date)} · Next due: {fmt(v.due_date)}
                  {v.dose ? ` · ${v.dose}` : ''}
                </p>
                {v.notes && <p className="text-xs text-slate-500 dark:text-slate-400 font-body mt-1 italic">"{v.notes}"</p>}
              </div>
              {canWrite && (
                <div className="flex items-center gap-1 shrink-0">
                  {v.status !== 'administered' && (
                    <button onClick={() => markAdministered(v)}
                      title="Mark administered"
                      className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50">
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => remove(v)} title="Delete"
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
