/**
 * TreatmentTracker.jsx
 * Lightweight list + add UI for non-medication treatments
 * (surgery, dental cleaning, grooming, etc.)
 */
import { useState } from 'react';
import { Activity, Plus, Loader2, Trash2 } from 'lucide-react';
import { emrService } from '../../services/emrService';

const STATUS_STYLE = {
  planned:     'bg-blue-50 text-blue-600 border-blue-200',
  in_progress: 'bg-amber-50 text-amber-600 border-amber-200',
  completed:   'bg-emerald-50 text-emerald-600 border-emerald-200',
  cancelled:   'bg-slate-100 text-slate-500 border-slate-200',
};

function fmt(d) { return d ? new Date(d).toLocaleDateString() : '—'; }

export default function TreatmentTracker({ petId, treatments = [], canWrite, onChange }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', scheduledDate: '', performedDate: '', status: 'planned',
    outcome: '', costEstimate: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await emrService.createTreatment({
        petId,
        name: form.name,
        description: form.description || undefined,
        scheduledDate: form.scheduledDate || undefined,
        performedDate: form.performedDate || undefined,
        status: form.status,
        outcome: form.outcome || undefined,
        costEstimate: form.costEstimate ? Number(form.costEstimate) : undefined,
      });
      setShowForm(false);
      setForm({ name: '', description: '', scheduledDate: '', performedDate: '', status: 'planned', outcome: '', costEstimate: '' });
      onChange && onChange();
    } catch (e2) {
      setErr(e2?.response?.data?.error || 'Failed to save treatment.');
    } finally { setBusy(false); }
  };

  const advance = async (t) => {
    const next = t.status === 'planned' ? 'in_progress'
              : t.status === 'in_progress' ? 'completed' : null;
    if (!next) return;
    try {
      await emrService.updateTreatment(t.id, {
        status: next,
        performedDate: next === 'completed' ? new Date().toISOString().slice(0, 10) : undefined,
      });
      onChange && onChange();
    } catch (_) {}
  };

  const remove = async (t) => {
    if (!confirm('Delete treatment?')) return;
    try { await emrService.deleteTreatment(t.id); onChange && onChange(); } catch (_) {}
  };

  return (
    <div className="space-y-3">
      {canWrite && (
        <div className="flex items-center justify-between">
          <p className="text-xs font-body text-slate-400">
            {treatments.length} treatment{treatments.length === 1 ? '' : 's'}
          </p>
          <button onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-body font-600 bg-amber-50 hover:bg-amber-100 text-amber-700">
            <Plus className="w-3.5 h-3.5" /> {showForm ? 'Close' : 'Add treatment'}
          </button>
        </div>
      )}

      {showForm && canWrite && (
        <form onSubmit={submit} className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input required placeholder="Treatment name *" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="sm:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white" />
          <textarea rows={2} placeholder="Description" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="sm:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white" />
          <label className="text-xs font-body text-slate-500">
            Scheduled date
            <input type="date" value={form.scheduledDate}
              onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white" />
          </label>
          <label className="text-xs font-body text-slate-500">
            Performed date
            <input type="date" value={form.performedDate}
              onChange={(e) => setForm({ ...form, performedDate: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white" />
          </label>
          <select value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white">
            <option value="planned">Planned</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <input type="number" min={0} step="0.01" placeholder="Cost estimate" value={form.costEstimate}
            onChange={(e) => setForm({ ...form, costEstimate: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white" />
          {err && <p className="sm:col-span-2 text-xs text-red-500">{err}</p>}
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" disabled={busy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-body font-600 disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Save
            </button>
          </div>
        </form>
      )}

      {!treatments.length ? (
        <p className="text-sm text-slate-400 font-body text-center py-6">No treatments recorded.</p>
      ) : (
        <ul className="space-y-2">
          {treatments.map((t) => (
            <li key={t.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-xl p-3 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-body font-600 text-slate-700 dark:text-slate-200 truncate">
                    {t.name}
                  </p>
                  <span className={`text-[10px] font-body font-600 px-2 py-0.5 rounded-md border ${STATUS_STYLE[t.status] || STATUS_STYLE.planned}`}>
                    {t.status.replace('_', ' ')}
                  </span>
                </div>
                {t.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-body mt-0.5 line-clamp-2">{t.description}</p>
                )}
                <p className="text-xs text-slate-400 font-body mt-0.5">
                  Scheduled: {fmt(t.scheduled_date)} · Performed: {fmt(t.performed_date)}
                  {t.cost_estimate != null ? ` · ₱${Number(t.cost_estimate).toFixed(2)}` : ''}
                </p>
              </div>
              {canWrite && (
                <div className="flex items-center gap-1 shrink-0">
                  {(t.status === 'planned' || t.status === 'in_progress') && (
                    <button onClick={() => advance(t)}
                      title={t.status === 'planned' ? 'Start' : 'Complete'}
                      className="px-2 py-1 rounded-lg text-xs font-body font-600 text-amber-700 hover:bg-amber-50">
                      {t.status === 'planned' ? 'Start' : 'Complete'}
                    </button>
                  )}
                  <button onClick={() => remove(t)} title="Delete"
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
