/**
 * SlotPicker.jsx
 *
 * Two-stage picker:
 *   1. Date — a horizontal strip of the next 14 days
 *   2. Vet & slot — ranked vet cards, each with their nearest open slot.
 *      Click a card to lock that vet, then choose a different slot
 *      from their full slot list.
 *
 * For an emergency reason, the urgency-banner displays the earliest
 * available slot across all vets and lets the client book in one tap.
 *
 * Props:
 *   reason        the selected reason object (from /booking/reasons)
 *   value         { date, vetId, slotISO }
 *   onChange(value)
 */
import { useEffect, useMemo, useState } from 'react';
import { Loader2, Clock, User, Calendar, Siren, ChevronRight } from 'lucide-react';
import { bookingService } from '../../services/bookingService';

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
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

  const [date, setDate]                 = useState(value?.date || toISODate(new Date()));
  const [preferredTime, setPreferred]   = useState('09:00');
  const [suggestions, setSuggestions]   = useState([]);
  const [vetSlots, setVetSlots]         = useState({});      // vetId → [{slot_start,slot_end}]
  const [selectedVet, setSelectedVet]   = useState(value?.vetId || null);
  const [selectedSlot, setSelectedSlot] = useState(value?.slotISO || null);
  const [loading, setLoading]           = useState(false);
  const [err, setErr]                   = useState('');

  // Load suggestions whenever date/reason/preferredTime changes
  useEffect(() => {
    if (!reason) return;
    let cancelled = false;
    (async () => {
      setLoading(true); setErr(''); setSuggestions([]); setVetSlots({});
      try {
        const res = await bookingService.suggestVets({
          reasonCode: reason.code,
          date,
          preferredTime: isEmergency ? null : preferredTime,
          limit: 5,
        });
        if (!cancelled) setSuggestions(res?.suggestions || []);
      } catch (e) {
        if (!cancelled) setErr(e?.response?.data?.error || 'Could not load slots.');
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [reason?.code, date, preferredTime, isEmergency]);

  // When a vet is picked, load that vet's full slot list
  useEffect(() => {
    if (!selectedVet) return;
    let cancelled = false;
    (async () => {
      try {
        const slots = await bookingService.getAvailableSlots(selectedVet, date);
        if (!cancelled) setVetSlots((m) => ({ ...m, [selectedVet]: slots || [] }));
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [selectedVet, date]);

  // Propagate value upstream when complete
  useEffect(() => {
    if (selectedVet && selectedSlot && date && onChange) {
      onChange({ date, vetId: selectedVet, slotISO: selectedSlot });
    }
  }, [date, selectedVet, selectedSlot]); // eslint-disable-line

  const top = suggestions[0];

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
              <button key={iso} onClick={() => { setDate(iso); setSelectedVet(null); setSelectedSlot(null); }}
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

      {/* Preferred time (hidden for emergencies) */}
      {!isEmergency && (
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-xs font-body font-600 uppercase tracking-wider text-slate-400">Preferred time</p>
          <input type="time" value={preferredTime}
            onChange={(e) => { setPreferred(e.target.value); setSelectedVet(null); setSelectedSlot(null); }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-body bg-white" />
          <p className="text-xs font-body text-slate-400">
            We'll suggest vets with the nearest open slot.
          </p>
        </div>
      )}

      {/* Emergency banner */}
      {isEmergency && top && (
        <div className="bg-gradient-to-br from-red-500 to-red-700 text-white rounded-2xl p-4 flex items-center gap-3 shadow-lg shadow-red-500/20">
          <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
            <Siren className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-700">Emergency — fast-tracked</p>
            <p className="text-sm opacity-90 font-body">
              Earliest available: {top.vet_name} at {fmtTime(top.slot_start)}.
              Booking will alert the front desk immediately.
            </p>
          </div>
          <button onClick={() => { setSelectedVet(top.vet_id); setSelectedSlot(top.slot_start); }}
            className="bg-white text-red-700 px-3 py-2 rounded-xl text-sm font-body font-700">
            Take this slot
          </button>
        </div>
      )}

      {/* Vet suggestions */}
      <div>
        <p className="text-xs font-body font-600 uppercase tracking-wider text-slate-400 mb-2">
          {isEmergency ? 'All available vets today' : 'Suggested vets (ranked by nearest open slot)'}
        </p>
        {loading ? (
          <div className="flex items-center justify-center h-24"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
        ) : err ? (
          <p className="bg-red-50 border border-red-100 text-red-600 text-sm font-body px-3 py-2 rounded-lg">{err}</p>
        ) : !suggestions.length ? (
          <p className="text-sm text-slate-400 font-body text-center py-6 bg-slate-50 rounded-xl">
            No vets have free slots on this date. Try another day.
          </p>
        ) : (
          <ul className="space-y-2">
            {suggestions.map((s) => {
              const active = selectedVet === s.vet_id;
              return (
                <li key={s.vet_id}>
                  <button type="button"
                    onClick={() => { setSelectedVet(s.vet_id); setSelectedSlot(s.slot_start); }}
                    className={`w-full text-left bg-white dark:bg-slate-900 rounded-xl border p-3 transition-colors
                      ${active ? 'border-blue-400 ring-2 ring-blue-200' : 'border-slate-100 hover:border-blue-300'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-body font-600 text-slate-700 dark:text-slate-200 truncate">
                          {s.vet_name}
                          {s.specialization && <span className="ml-2 text-[10px] font-600 text-slate-400 uppercase tracking-wider">{s.specialization}</span>}
                        </p>
                        <p className="text-xs text-slate-500 font-body">
                          Nearest: <span className="font-600 text-slate-700 dark:text-slate-200">{fmtTime(s.slot_start)}</span>
                          {' · '}{s.load_today} on schedule today
                          {!isEmergency && s.delta_mins != null ? ` · ${s.delta_mins} min from your preferred time` : ''}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                  </button>

                  {/* Full slot list for the selected vet */}
                  {active && vetSlots[selectedVet] && (
                    <div className="mt-2 ml-4 pl-3 border-l-2 border-blue-200">
                      <p className="text-xs font-body text-slate-400 uppercase tracking-wider mb-1.5">
                        All open slots
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {vetSlots[selectedVet].map((sl) => {
                          const isSel = selectedSlot === sl.slot_start;
                          return (
                            <button key={sl.slot_start} type="button"
                              onClick={() => setSelectedSlot(sl.slot_start)}
                              className={`text-xs font-body font-600 px-2.5 py-1 rounded-lg border transition-colors
                                ${isSel
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                              {fmtTime(sl.slot_start)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
