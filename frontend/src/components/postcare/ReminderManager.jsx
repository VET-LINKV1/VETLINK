/**
 * ReminderManager.jsx
 *
 * Client manages medication reminders for their pets. Each reminder
 * binds to a prescription and stores the times of day at which a
 * dose should be administered, plus food instructions and channels.
 *
 * Props:
 *   activeRx     active prescriptions for the client's pets
 *   reminders    rows from /api/postcare/reminders
 *   onChange()
 */
import { useState } from 'react';
import {
  Bell, BellOff, Plus, Loader2, Trash2, Clock, Smartphone, Mail, Pill, Utensils, X, Edit3,
} from 'lucide-react';
import { postCareService } from '../../services/postCareService';

const CHANNELS = [
  { key: 'in_app', label: 'In-app', Icon: Bell      },
  { key: 'sms',    label: 'SMS',    Icon: Smartphone },
  { key: 'email',  label: 'Email',  Icon: Mail      },
];

const DEFAULT_FORM = {
  prescriptionId: '',
  timesOfDay:     ['08:00'],
  foodInstruction: 'give with food',
  messageOverride: '',
  channels:       ['in_app'],
  startDate:      '',
  endDate:        '',
};

export default function ReminderManager({ activeRx = [], reminders = [], onChange }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(DEFAULT_FORM);
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState('');

  const startNew = () => {
    setEditing(null);
    setForm({ ...DEFAULT_FORM, prescriptionId: activeRx[0]?.id || '' });
    setShowForm(true);
    setErr('');
  };

  const startEdit = (r) => {
    setEditing(r.id);
    setForm({
      prescriptionId:  r.prescription_id,
      timesOfDay:      r.times_of_day || ['08:00'],
      foodInstruction: r.food_instruction || '',
      messageOverride: r.message_override || '',
      channels:        r.channels || ['in_app'],
      startDate:       r.start_date || '',
      endDate:         r.end_date   || '',
    });
    setShowForm(true);
    setErr('');
  };

  const close = () => { setShowForm(false); setEditing(null); setErr(''); };

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const payload = {
        prescriptionId:   form.prescriptionId,
        timesOfDay:       form.timesOfDay.filter(Boolean),
        foodInstruction:  form.foodInstruction || null,
        messageOverride:  form.messageOverride || null,
        channels:         form.channels,
        startDate:        form.startDate || undefined,
        endDate:          form.endDate || null,
      };
      if (editing) await postCareService.updateReminder(editing, payload);
      else         await postCareService.createReminder(payload);
      close();
      onChange && onChange();
    } catch (e2) {
      setErr(e2?.response?.data?.error || 'Failed to save reminder.');
    } finally { setBusy(false); }
  };

  const toggle = async (r) => {
    try { await postCareService.updateReminder(r.id, { isActive: !r.is_active }); onChange && onChange(); }
    catch (_) {}
  };
  const remove = async (r) => {
    if (!confirm('Delete this reminder?')) return;
    try { await postCareService.deleteReminder(r.id); onChange && onChange(); } catch (_) {}
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-body text-slate-400">
          {reminders.length} reminder{reminders.length === 1 ? '' : 's'}
        </p>
        <button onClick={startNew}
          disabled={!activeRx.length}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-body font-600 bg-blue-50 hover:bg-blue-100 text-blue-700 disabled:opacity-50">
          <Plus className="w-3.5 h-3.5" /> New reminder
        </button>
      </div>

      {!activeRx.length && (
        <p className="text-sm text-slate-400 font-body italic text-center py-4 bg-slate-50 rounded-xl">
          You don't have any active prescriptions to set reminders for.
        </p>
      )}

      {/* Reminder list */}
      <ul className="space-y-2">
        {reminders.map((r) => (
          <li key={r.id} className={`bg-white dark:bg-slate-900 border rounded-xl p-3 flex items-start gap-3
            ${r.is_active ? 'border-slate-100 dark:border-white/10' : 'border-slate-100 opacity-60'}`}>
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              {r.is_active ? <Bell className="w-4 h-4 text-blue-600" /> : <BellOff className="w-4 h-4 text-slate-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Pill className="w-3.5 h-3.5 text-violet-500" />
                <p className="text-sm font-body font-600 text-slate-700 dark:text-slate-200 truncate">
                  {r.prescription?.medication_name}
                </p>
                <span className="text-xs font-body text-slate-400">
                  {r.prescription?.dosage} · {r.pet?.name}
                </span>
              </div>
              <p className="text-xs font-body text-slate-500 mt-1 flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> {(r.times_of_day || []).join(' · ')}
                {r.food_instruction && (
                  <>
                    <Utensils className="w-3 h-3 ml-1" /> {r.food_instruction}
                  </>
                )}
              </p>
              <p className="text-[10px] font-body text-slate-400 mt-1 uppercase tracking-wider">
                Channels: {(r.channels || []).join(', ')}
                {r.next_fire_at && ` · next: ${new Date(r.next_fire_at).toLocaleString()}`}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => toggle(r)} title={r.is_active ? 'Pause' : 'Resume'}
                className={`p-1.5 rounded-lg ${r.is_active ? 'text-amber-500 hover:bg-amber-50' : 'text-emerald-500 hover:bg-emerald-50'}`}>
                {r.is_active ? <BellOff className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => startEdit(r)} title="Edit"
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => remove(r)} title="Delete"
                className="p-1.5 rounded-lg text-red-400 hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </li>
        ))}
        {!reminders.length && (
          <li className="text-sm text-slate-400 font-body italic text-center py-4 bg-slate-50 rounded-xl">
            No reminders yet.
          </li>
        )}
      </ul>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
          onClick={close}>
          <div onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden">
            <header className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-blue-600" />
                </div>
                <p className="font-display text-slate-800 dark:text-white font-700">
                  {editing ? 'Edit reminder' : 'New medication reminder'}
                </p>
              </div>
              <button onClick={close} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
                <X className="w-4 h-4" />
              </button>
            </header>

            <form onSubmit={submit} className="p-5 space-y-3">
              <label className="block">
                <span className="block text-[10px] uppercase tracking-wider font-body font-600 text-slate-400 mb-1">Prescription</span>
                <select required value={form.prescriptionId}
                  onChange={(e) => setForm({ ...form, prescriptionId: e.target.value })}
                  disabled={!!editing}
                  className={INPUT}>
                  <option value="">— pick a prescription —</option>
                  {activeRx.map(rx => (
                    <option key={rx.id} value={rx.id}>{rx.medication_name} ({rx.dosage})</option>
                  ))}
                </select>
              </label>

              <div>
                <p className="text-[10px] uppercase tracking-wider font-body font-600 text-slate-400 mb-1">Times of day</p>
                <div className="flex flex-wrap gap-2">
                  {form.timesOfDay.map((t, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <input type="time" value={t}
                        onChange={(e) => {
                          const next = [...form.timesOfDay]; next[i] = e.target.value;
                          setForm({ ...form, timesOfDay: next });
                        }} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-body bg-white" />
                      {form.timesOfDay.length > 1 && (
                        <button type="button" onClick={() =>
                          setForm({ ...form, timesOfDay: form.timesOfDay.filter((_, idx) => idx !== i) })}
                          className="p-1 rounded text-red-400 hover:bg-red-50">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {form.timesOfDay.length < 8 && (
                    <button type="button"
                      onClick={() => setForm({ ...form, timesOfDay: [...form.timesOfDay, '20:00'] })}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-body font-600 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg">
                      <Plus className="w-3 h-3" /> Add time
                    </button>
                  )}
                </div>
              </div>

              <label className="block">
                <span className="block text-[10px] uppercase tracking-wider font-body font-600 text-slate-400 mb-1">Food instruction</span>
                <input value={form.foodInstruction}
                  onChange={(e) => setForm({ ...form, foodInstruction: e.target.value })}
                  placeholder='e.g. "give with food"' className={INPUT} />
              </label>

              <label className="block">
                <span className="block text-[10px] uppercase tracking-wider font-body font-600 text-slate-400 mb-1">Custom message (optional)</span>
                <input value={form.messageOverride}
                  onChange={(e) => setForm({ ...form, messageOverride: e.target.value })}
                  placeholder="Auto-generated if blank" className={INPUT} />
              </label>

              <div>
                <p className="text-[10px] uppercase tracking-wider font-body font-600 text-slate-400 mb-1">Channels</p>
                <div className="flex flex-wrap gap-1.5">
                  {CHANNELS.map(({ key, label, Icon }) => {
                    const on = form.channels.includes(key);
                    return (
                      <button key={key} type="button"
                        onClick={() => setForm({ ...form, channels: on
                          ? form.channels.filter(c => c !== key)
                          : [...form.channels, key] })}
                        className={`flex items-center gap-1.5 text-xs font-body font-600 px-2.5 py-1 rounded-lg border transition-colors
                          ${on ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                        <Icon className="w-3.5 h-3.5" /> {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-wider font-body font-600 text-slate-400 mb-1">Start</span>
                  <input type="date" value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={INPUT} />
                </label>
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-wider font-body font-600 text-slate-400 mb-1">End (optional)</span>
                  <input type="date" value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={INPUT} />
                </label>
              </div>

              {err && <p className="text-xs text-red-600">{err}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={close}
                  className="px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 text-sm font-body">
                  Cancel
                </button>
                <button type="submit" disabled={busy}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-body font-600 disabled:opacity-50">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                  {editing ? 'Save changes' : 'Create reminder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const INPUT = 'w-full rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-sm font-body bg-white dark:bg-slate-800';
