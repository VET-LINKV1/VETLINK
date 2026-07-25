/**
 * PrescriptionManager.jsx
 * Lists prescriptions for a pet. Vets / admin can create new rx,
 * discontinue active ones, and request a refill.
 */
import { useState } from 'react';
import { Pill, Plus, RefreshCw, Loader2, Trash2, CircleSlash } from 'lucide-react';
import { emrService } from '../../services/emrService';

const STATUS_STYLE = {
  active:        'bg-emerald-50 text-emerald-600 border-emerald-200',
  completed:     'bg-slate-100 text-slate-500 border-slate-200',
  discontinued:  'bg-amber-50 text-amber-600 border-amber-200',
  expired:       'bg-red-50 text-red-500 border-red-200',
};

function fmt(d) { return d ? new Date(d).toLocaleDateString() : '—'; }

export default function PrescriptionManager({ petId, prescriptions = [], canWrite, onChange }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    medicationName: '', dosage: '', frequency: '', route: '',
    durationDays: '', refillsAllowed: 0, instructions: '', startDate: '', endDate: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await emrService.createPrescription({
        petId,
        medicationName:  form.medicationName,
        dosage:          form.dosage,
        frequency:       form.frequency,
        route:           form.route || undefined,
        durationDays:    form.durationDays ? Number(form.durationDays) : undefined,
        refillsAllowed:  Number(form.refillsAllowed) || 0,
        instructions:    form.instructions || undefined,
        startDate:       form.startDate || undefined,
        endDate:         form.endDate || undefined,
      });
      setShowForm(false);
      setForm({ medicationName: '', dosage: '', frequency: '', route: '', durationDays: '', refillsAllowed: 0, instructions: '', startDate: '', endDate: '' });
      onChange && onChange();
    } catch (e2) {
      setErr(e2?.response?.data?.error || 'Failed to save prescription.');
    } finally { setBusy(false); }
  };

  const refill = async (rx) => {
    try { await emrService.refillPrescription(rx.id); onChange && onChange(); }
    catch (e2) { alert(e2?.response?.data?.error || 'Refill failed'); }
  };
  const discontinue = async (rx) => {
    if (!confirm('Discontinue this prescription?')) return;
    try { await emrService.updatePrescription(rx.id, { status: 'discontinued' }); onChange && onChange(); }
    catch (_) {}
  };
  const remove = async (rx) => {
    if (!confirm('Delete prescription permanently?')) return;
    try { await emrService.deletePrescription(rx.id); onChange && onChange(); } catch (_) {}
  };

  return (
    <div className="space-y-3">
      {canWrite && (
        <div className="flex items-center justify-between">
          <p className="text-xs font-body text-slate-400">
            {prescriptions.length} prescription{prescriptions.length === 1 ? '' : 's'}
          </p>
          <button onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-body font-600 bg-violet-50 hover:bg-violet-100 text-violet-700">
            <Plus className="w-3.5 h-3.5" /> {showForm ? 'Close' : 'Prescribe'}
          </button>
        </div>
      )}

      {showForm && canWrite && (
        <form onSubmit={submit} className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input required placeholder="Medication name *" value={form.medicationName}
            onChange={(e) => setForm({ ...form, medicationName: e.target.value })}
            className="sm:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white" />
          <input required placeholder="Dosage (e.g. 5 mg/kg) *" value={form.dosage}
            onChange={(e) => setForm({ ...form, dosage: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white" />
          <input required placeholder="Frequency (e.g. BID) *" value={form.frequency}
            onChange={(e) => setForm({ ...form, frequency: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white" />
          <input placeholder="Route (oral, IV, …)" value={form.route}
            onChange={(e) => setForm({ ...form, route: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white" />
          <input type="number" min={0} placeholder="Duration (days)" value={form.durationDays}
            onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white" />
          <label className="text-xs font-body text-slate-500">
            Start date
            <input type="date" value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white" />
          </label>
          <label className="text-xs font-body text-slate-500">
            End date
            <input type="date" value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white" />
          </label>
          <label className="text-xs font-body text-slate-500">
            Refills allowed
            <input type="number" min={0} max={50} value={form.refillsAllowed}
              onChange={(e) => setForm({ ...form, refillsAllowed: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white" />
          </label>
          <textarea rows={2} placeholder="Instructions" value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
            className="sm:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white" />
          {err && <p className="sm:col-span-2 text-xs text-red-500">{err}</p>}
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" disabled={busy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-body font-600 disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add prescription
            </button>
          </div>
        </form>
      )}

      {!prescriptions.length ? (
        <p className="text-sm text-slate-400 font-body text-center py-6">No prescriptions on file.</p>
      ) : (
        <ul className="space-y-2">
          {prescriptions.map((rx) => (
            <li key={rx.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-xl p-3 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                <Pill className="w-4 h-4 text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-body font-600 text-slate-700 dark:text-slate-200 truncate">
                    {rx.medication_name}
                  </p>
                  <span className={`text-[10px] font-body font-600 px-2 py-0.5 rounded-md border ${STATUS_STYLE[rx.status] || STATUS_STYLE.active}`}>
                    {rx.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-body mt-0.5">
                  {rx.dosage} · {rx.frequency}{rx.route ? ` · ${rx.route}` : ''}
                </p>
                <p className="text-xs text-slate-400 font-body mt-0.5">
                  {fmt(rx.start_date)} → {fmt(rx.end_date)} · refills {rx.refills_used}/{rx.refills_allowed}
                </p>
                {rx.instructions && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-body mt-1 italic">"{rx.instructions}"</p>
                )}
              </div>
              {canWrite && (
                <div className="flex items-center gap-1 shrink-0">
                  {rx.status === 'active' && rx.refills_used < rx.refills_allowed && (
                    <button onClick={() => refill(rx)} title="Refill"
                      className="p-1.5 rounded-lg text-violet-600 hover:bg-violet-50">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                  {rx.status === 'active' && (
                    <button onClick={() => discontinue(rx)} title="Discontinue"
                      className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50">
                      <CircleSlash className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => remove(rx)} title="Delete"
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
