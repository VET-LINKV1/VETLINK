/**
 * AppointmentSettings.jsx
 * Duration, types, cancellation/reschedule, check-in, no-show, booking,
 * veterinarian scheduling rules.
 */
import { useState, useEffect } from 'react';
import { Calendar, Clock, Ban, RotateCcw, CheckCircle2, Stethoscope } from 'lucide-react';
import { settingsService } from '../../services/settingsService';
import { SettingCard, Field, TextInput, Select, Toggle, ChipList, FormFooter, Note, ErrorCard } from './primitives';

const NO_SHOW_ACTIONS = [
  { key: 'mark_no_show', label: 'Mark as no-show (record only)' },
  { key: 'auto_charge', label: 'Charge cancellation fee' },
  { key: 'suspend_booking', label: 'Suspend online booking' },
];
const VET_SCHED = [
  { key: 'open', label: 'Open — clients pick any vet' },
  { key: 'assigned', label: 'Assigned — must choose a vet' },
  { key: 'balanced', label: 'Balanced load distribution' },
];

function SettingsSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
              <div className="h-3 w-56 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AppointmentSettings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState('');

  useEffect(() => {
    settingsService.getSection('appointments')
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { console.error(e); setError('Failed to load appointment settings. Is the backend running and the Phase 20 migration applied?'); setLoading(false); });
  }, []);

  const a = data;

  const set = async (patch) => {
    await settingsService.updateSection('appointments', { ...data, ...patch });
    setData(d => ({ ...d, ...patch }));
  };

  const handleSave = async () => {
    setSaving(true);
    await settingsService.updateSection('appointments', a, 'Updated appointment settings');
    setLastSaved(`Saved ${new Date().toLocaleTimeString()}`);
    setSaving(false);
  };

  const handleReset = async () => {
    await settingsService.resetSection('appointments');
    const d = await settingsService.getSection('appointments');
    setData(d);
  };

  if (loading) return <SettingsSkeleton />;
  if (error) return <ErrorCard message={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="space-y-5">
      <SettingCard title="Duration & Types" subtitle="Default slot length and bookable visit categories." icon={Calendar}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Default appointment duration (minutes)" htmlFor="adur">
            <Select id="adur" value={a.defaultDuration} onChange={e => set({ defaultDuration: Number(e.target.value) })}>
              {[15,20,30,45,60,90].map(d => <option key={d} value={d}>{d} min</option>)}
            </Select>
          </Field>
          <Field label="Check-in window (minutes before)" htmlFor="ackw">
            <TextInput id="ackw" type="number" min="0" value={a.checkInWindow} onChange={e => set({ checkInWindow: Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Allowed custom durations (minutes)" htmlFor="acust">
          <ChipList items={a.customDurations.map(String)} onAdd={(v) => set({ customDurations: [...a.customDurations, Number(v)] })} onRemove={(v) => set({ customDurations: a.customDurations.filter(x => String(x) !== v) })} placeholder="e.g. 75" />
        </Field>
        <Field label="Appointment types" htmlFor="atypes">
          <ChipList items={a.types} onAdd={(v) => set({ types: [...a.types, v] })} onRemove={(v) => set({ types: a.types.filter(x => x !== v) })} placeholder="Add appointment type" />
        </Field>
        <div className="flex items-center justify-between pt-2">
          <div>
            <p className="font-body text-slate-700 dark:text-slate-200">Allow custom durations</p>
            <p className="text-xs font-body text-slate-400">Let staff override the default slot length.</p>
          </div>
          <Toggle checked={a.allowCustomDuration} onChange={v => set({ allowCustomDuration: v })} label="Custom durations" />
        </div>
      </SettingCard>

      <SettingCard title="Cancellation & Rescheduling" subtitle="Client self-service limits and fees." icon={Ban}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Cancellation notice required (hours)" htmlFor="acan">
            <TextInput id="acan" type="number" min="0" value={a.cancellationHours} onChange={e => set({ cancellationHours: Number(e.target.value) })} />
          </Field>
          <Field label="Maximum reschedules per booking" htmlFor="ares">
            <TextInput id="ares" type="number" min="0" value={a.rescheduleLimit} onChange={e => set({ rescheduleLimit: Number(e.target.value) })} />
          </Field>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-body text-slate-700 dark:text-slate-200">Require deposit for booking</p>
            <p className="text-xs font-body text-slate-400">Collect a hold to reduce no-shows.</p>
          </div>
          <Toggle checked={a.requireDeposit} onChange={v => set({ requireDeposit: v })} label="Require deposit" />
        </div>
        {a.requireDeposit && (
          <Field label="Deposit percentage (%)" htmlFor="adep">
            <TextInput id="adep" type="number" min="0" max="100" value={a.depositPercent} onChange={e => set({ depositPercent: Number(e.target.value) })} />
          </Field>
        )}
      </SettingCard>

      <SettingCard title="No-Show Rules" subtitle="What happens when a client misses an appointment." icon={Clock}>
        <Field label="No-show action" htmlFor="ans">
          <Select id="ans" value={a.noShowAction} onChange={e => set({ noShowAction: e.target.value })}>
            {NO_SHOW_ACTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </Select>
        </Field>
        <Field label="Grace period (minutes)" htmlFor="ansg">
          <TextInput id="ansg" type="number" min="0" value={a.noShowGrace} onChange={e => set({ noShowGrace: Number(e.target.value) })} hint="Time after the start time before a visit is marked no-show." />
        </Field>
      </SettingCard>

      <SettingCard title="Booking Availability" subtitle="Online booking window and veterinarian assignment." icon={CheckCircle2}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-body text-slate-700 dark:text-slate-200">Enable online booking</p>
            <p className="text-xs font-body text-slate-400">Clients can book from the portal.</p>
          </div>
          <Toggle checked={a.onlineBooking} onChange={v => set({ onlineBooking: v })} label="Online booking" />
        </div>
        <Field label="Booking lead time (days ahead)" htmlFor="ablead">
          <TextInput id="ablead" type="number" min="1" value={a.bookingLeadDays} onChange={e => set({ bookingLeadDays: Number(e.target.value) })} />
        </Field>
        <Field label="Veterinarian scheduling mode" htmlFor="avet">
          <Select id="avet" value={a.vetScheduling} onChange={e => set({ vetScheduling: e.target.value })}>
            {VET_SCHED.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </Select>
        </Field>
        <Note tone="info">Veterinarian availability is managed per-staff in the Schedule module; these settings control how the booking engine uses that data.</Note>
      </SettingCard>

      <div className="flex justify-end">
        <FormFooter onSave={handleSave} onReset={handleReset} saving={saving} lastSaved={lastSaved} />
      </div>
    </div>
  );
}
