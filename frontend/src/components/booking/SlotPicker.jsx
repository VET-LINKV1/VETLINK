/**
 * SlotPicker.jsx (client booking wizard — "Time" step)
 *
 * Simplified by clinic request: the pet owner just tells us their
 * preferred date and time, and -- optionally -- which vet they'd
 * like. We no longer make them browse a computed list of open
 * slots; front desk confirms the exact time (adjusting it if
 * needed) and assigns/confirms a vet when they approve the
 * booking, the same way they already do for reschedules.
 *
 * Props:
 *   reason        the selected reason object (from /booking/reasons)
 *   value         { date, vetId, slotISO }
 *   onChange(value)
 */
import { useEffect, useState } from 'react';
import { Clock, User, Siren } from 'lucide-react';
import { scheduleService } from '../../services/scheduleService';

function dayLabel(d) {
  const wd = d.toLocaleDateString(undefined, { weekday: 'short' });
  const md = d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
  return { wd, md };
}
function toISODate(d) {
  const offset = d.getTimezoneOffset();
  const x = new Date(d.getTime() - offset * 60000);
  return x.toISOString().slice(0, 10);
}
function vetSpecialization(v) {
  const sp = Array.isArray(v.staff_profiles) ? v.staff_profiles[0] : v.staff_profiles;
  return sp?.specialization || '';
}

export default function SlotPicker({ reason, value, onChange }) {
  const isEmergency = reason?.code === 'emergency';

  const [dates] = useState(() => {
    const arr = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      arr.push(d);
    }
    return arr;
  });

  const [date, setDate] = useState(value?.date || toISODate(new Date()));
  const [time, setTime] = useState(() => {
    if (value?.slotISO) return new Date(value.slotISO).toTimeString().slice(0, 5);
    return '09:00';
  });
  const [vets, setVets]     = useState([]);
  const [vetId, setVetId]   = useState(value?.vetId || '');
  const [vetsErr, setVetsErr] = useState('');

  // Load the vet list once, for the optional "preferred vet" dropdown.
  useEffect(() => {
    let cancelled = false;
    scheduleService.getAllVets()
      .then((v) => { if (!cancelled) setVets(v || []); })
      .catch(() => { if (!cancelled) setVetsErr('Could not load the list of vets -- that\'s okay, you can still book without picking one.'); });
    return () => { cancelled = true; };
  }, []);

  // Propagate the chosen date + time (and optional vet) upstream as soon
  // as we have a complete, valid local date/time.
  useEffect(() => {
    if (!date || !time) return;
    const local = new Date(`${date}T${time}:00`);
    if (isNaN(local.getTime())) return;
    onChange && onChange({ date, vetId: vetId || null, slotISO: local.toISOString() });
  }, [date, time, vetId]); // eslint-disable-line

  return (
    <div className="space-y-4">
      {/* Date strip */}
      <div>
        <p className="text-xs font-body font-600 uppercase tracking-wider text-slate-400 mb-2">
          Pick a date
        </p>
        <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
          {dates.map((d) => {
            const iso = toISODate(d);
            const { wd, md } = dayLabel(d);
            const active = date === iso;
            return (
              <button key={iso} type="button" onClick={() => setDate(iso)}
                className={`shrink-0 min-w-[64px] rounded-xl border px-3 py-2 text-center transition-colors
                  ${active
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                <p className={`text-[10px] uppercase tracking-wider font-body ${active ? 'opacity-90' : 'text-slate-400'}`}>{wd}</p>
                <p className="font-display font-700 text-sm">{md}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Preferred time -- free text, no restriction to pre-computed slots */}
      <div>
        <p className="text-xs font-body font-600 uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> Preferred time
        </p>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white w-40" />
        <p className="text-xs font-body text-slate-400 mt-1.5">
          Type in any time that works for you. The clinic will confirm this time
          (or reach out to adjust it) when they approve your booking.
        </p>
      </div>

      {/* Optional preferred vet */}
      <div>
        <p className="text-xs font-body font-600 uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5" /> Preferred veterinarian (optional)
        </p>
        <select value={vetId} onChange={(e) => setVetId(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white w-full sm:w-72">
          <option value="">No preference -- clinic will assign</option>
          {vets.map((v) => {
            const spec = vetSpecialization(v);
            return <option key={v.id} value={v.id}>{v.name}{spec ? ` · ${spec}` : ''}</option>;
          })}
        </select>
        {vetsErr && <p className="text-xs font-body text-slate-400 mt-1.5">{vetsErr}</p>}
      </div>

      {/* Emergency note */}
      {isEmergency && (
        <div className="bg-gradient-to-br from-red-500 to-red-700 text-white rounded-2xl p-4 flex items-center gap-3 shadow-lg shadow-red-500/20">
          <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
            <Siren className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-700">Emergency -- front desk will be alerted immediately</p>
            <p className="text-sm opacity-90 font-body">
              We'll call you back right away to confirm the fastest time available --
              the time above just tells us roughly when this started.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
