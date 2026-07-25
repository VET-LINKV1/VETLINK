/**
 * WeightChart.jsx
 * Interactive line chart of pet weight (and BCS) over time, built on
 * Recharts. Includes a quick-add form for staff to log a new weight.
 *
 * Props:
 *   petId
 *   weights    Array<{ id, weight_kg, body_condition_score, recorded_at, notes }>
 *   canWrite   boolean
 *   onChange() reload callback
 */
import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ReferenceLine, Legend,
} from 'recharts';
import { Plus, Loader2, TrendingUp, TrendingDown, Minus, Trash2 } from 'lucide-react';
import { passportService } from '../../services/passportService';

function fmtDate(d) {
  if (!d) return '';
  try {
    const t = new Date(d);
    return t.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: '2-digit' });
  } catch { return d; }
}

function trend(series) {
  if (series.length < 2) return { dir: 'flat', delta: 0 };
  const first = Number(series[0].weight_kg);
  const last  = Number(series[series.length - 1].weight_kg);
  const delta = last - first;
  return {
    dir: delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : 'flat',
    delta,
  };
}

export default function WeightChart({ petId, weights = [], canWrite, onChange }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ weightKg: '', bodyConditionScore: '', recordedAt: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Normalize for Recharts
  const data = useMemo(() => weights.map(w => ({
    date:      w.recorded_at,
    label:     fmtDate(w.recorded_at),
    weight:    Number(w.weight_kg),
    bcs:       w.body_condition_score ?? null,
    notes:     w.notes || '',
    id:        w.id,
  })), [weights]);

  const t = trend(weights);
  const TrendIcon = t.dir === 'up' ? TrendingUp : t.dir === 'down' ? TrendingDown : Minus;
  const trendColor =
    t.dir === 'up'   ? 'text-amber-600 bg-amber-50' :
    t.dir === 'down' ? 'text-blue-600 bg-blue-50' :
                       'text-slate-500 bg-slate-100';

  const minW = data.length ? Math.min(...data.map(d => d.weight)) : 0;
  const maxW = data.length ? Math.max(...data.map(d => d.weight)) : 1;
  const yPad = Math.max(0.5, (maxW - minW) * 0.15);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await passportService.addWeight({
        petId,
        weightKg:           Number(form.weightKg),
        bodyConditionScore: form.bodyConditionScore ? Number(form.bodyConditionScore) : undefined,
        recordedAt:         form.recordedAt || undefined,
        notes:              form.notes || undefined,
      });
      setForm({ weightKg: '', bodyConditionScore: '', recordedAt: '', notes: '' });
      setShowForm(false);
      onChange && onChange();
    } catch (e2) {
      setErr(e2?.response?.data?.error || 'Failed to add weight.');
    } finally { setBusy(false); }
  };

  const removePoint = async (id) => {
    if (!confirm('Delete this weight measurement?')) return;
    try { await passportService.deleteWeight(id); onChange && onChange(); } catch (_) {}
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 text-xs font-body font-600 px-2 py-1 rounded-md ${trendColor}`}>
            <TrendIcon className="w-3.5 h-3.5" />
            {t.dir === 'flat' ? 'Stable' : `${t.delta > 0 ? '+' : ''}${t.delta.toFixed(2)} kg`}
          </span>
          <span className="text-xs font-body text-slate-400">
            {data.length} measurement{data.length === 1 ? '' : 's'}
          </span>
        </div>
        {canWrite && (
          <button onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-body font-600 bg-blue-50 hover:bg-blue-100 text-blue-700">
            <Plus className="w-3.5 h-3.5" /> {showForm ? 'Close' : 'Log weight'}
          </button>
        )}
      </div>

      {showForm && canWrite && (
        <form onSubmit={submit} className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input type="number" step="0.01" min="0.1" max="500" required
            placeholder="Weight (kg) *" value={form.weightKg}
            onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white" />
          <input type="number" min="1" max="9" placeholder="BCS (1-9)" value={form.bodyConditionScore}
            onChange={(e) => setForm({ ...form, bodyConditionScore: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white" />
          <label className="text-xs font-body text-slate-500">
            Recorded date
            <input type="datetime-local" value={form.recordedAt}
              onChange={(e) => setForm({ ...form, recordedAt: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white" />
          </label>
          <input placeholder="Notes" value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white" />
          {err && <p className="sm:col-span-2 text-xs text-red-500">{err}</p>}
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" disabled={busy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-body font-600 disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Save
            </button>
          </div>
        </form>
      )}

      {data.length < 2 ? (
        <p className="text-sm text-slate-400 font-body text-center py-10 bg-slate-50 dark:bg-white/5 rounded-xl">
          {data.length === 0 ? 'No weight measurements yet.' : 'Log at least two measurements to see the trend.'}
        </p>
      ) : (
        <div className="w-full h-64 sm:h-80 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-white/10 p-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickMargin={6} />
              <YAxis
                domain={[Math.max(0, minW - yPad), maxW + yPad]}
                stroke="#94a3b8" fontSize={11} tickMargin={6}
                tickFormatter={(v) => `${v} kg`} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                formatter={(v, name) => name === 'weight' ? [`${v} kg`, 'Weight'] : [v, 'BCS']} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={maxW} stroke="#cbd5e1" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="weight" name="Weight (kg)"
                stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3.5 }} activeDot={{ r: 5 }} />
              {data.some(d => d.bcs != null) && (
                <Line type="monotone" dataKey="bcs" name="BCS (1-9)"
                  stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 2.5 }} yAxisId={0} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table of recent measurements */}
      {data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead className="text-xs text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="text-left font-600 py-2 px-2">Date</th>
                <th className="text-right font-600 py-2 px-2">Weight</th>
                <th className="text-right font-600 py-2 px-2">BCS</th>
                <th className="text-left font-600 py-2 px-2">Notes</th>
                {canWrite && <th className="w-8" />}
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().slice(0, 8).map((d) => (
                <tr key={d.id} className="border-t border-slate-100 dark:border-white/5">
                  <td className="py-2 px-2 text-slate-500">{d.label}</td>
                  <td className="py-2 px-2 text-right font-600 text-slate-700 dark:text-slate-200">{d.weight.toFixed(2)} kg</td>
                  <td className="py-2 px-2 text-right text-slate-500">{d.bcs ?? '—'}</td>
                  <td className="py-2 px-2 text-slate-500 truncate max-w-[200px]">{d.notes || ''}</td>
                  {canWrite && (
                    <td className="py-2 px-2 text-right">
                      <button onClick={() => removePoint(d.id)} className="p-1 rounded-md text-red-400 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
