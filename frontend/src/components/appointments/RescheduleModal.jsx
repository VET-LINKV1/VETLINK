/**
 * RescheduleModal.jsx
 *
 * Modal for rescheduling an appointment to a new date/time.
 * Handles the case where the original vet is NOT available:
 *   - Shows "Original vet unavailable" banner
 *   - Lists alternative available vets ranked by nearest open slot
 *   - User can pick an alternative vet + slot
 *
 * When the original vet IS available:
 *   - Shows available slots for that vet directly
 *
 * Props:
 *   appointment  the current appointment object
 *   onClose      callback to close the modal
 *   onSuccess    callback after successful reschedule
 */
import { useState, useEffect, useCallback } from 'react';
import {
  X, Calendar, Clock, Loader2, AlertCircle, Check,
  User, ChevronRight, RefreshCw,
} from 'lucide-react';
import { appointmentService } from '../../services/appointmentService';
import { bookingService } from '../../services/bookingService';
import { scheduleService } from '../../services/scheduleService';

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function toISODate(d) {
  const offset = d.getTimezoneOffset();
  const x = new Date(d.getTime() - offset * 60000);
  return x.toISOString().slice(0, 10);
}

function dayLabel(d) {
  const wd = d.toLocaleDateString(undefined, { weekday: 'short' });
  const md = d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
  return { wd, md };
}

export default function RescheduleModal({ appointment: appt, onClose, onSuccess }) {
  // Date options: next 14 days starting from today
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

  const currentVetId = appt.vet_id;
  const currentVetName = appt.vet?.name || 'Current vet';

  const [selectedDate, setSelectedDate]       = useState(() => toISODate(new Date()));
  const [selectedTime, setSelectedTime]       = useState(null);       // HH:MM string
  const [selectedVetId, setSelectedVetId]     = useState(currentVetId);
  const [selectedVetName, setSelectedVetName] = useState(currentVetName);

  const [originalVetAvailable, setOriginalVetAvailable] = useState(null); // null = loading
  const [originalVetSlots, setOriginalVetSlots]         = useState([]);
  const [altSuggestions, setAltSuggestions]             = useState([]);
  const [altVetSlots, setAltVetSlots]                   = useState({});   // vetId → [{start, end, available}]

  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState(false);

  // Check original vet availability + suggest alternatives
  const checkAvailability = useCallback(async () => {
    if (!selectedDate) return;
    setLoading(true);
    setError('');
    setOriginalVetAvailable(null);
    setOriginalVetSlots([]);
    setAltSuggestions([]);
    setSelectedTime(null);

    try {
      // 1. Check original vet's slots for the selected date
      const slotData = await scheduleService.getAvailableSlots(currentVetId, selectedDate);
      const availableSlots = (slotData?.slots || []).filter(s => s.available);

      if (availableSlots.length > 0) {
        setOriginalVetAvailable(true);
        setOriginalVetSlots(availableSlots);
      } else {
        setOriginalVetAvailable(false);

        // 2. Suggest alternative vets for this date
        const altRes = await bookingService.suggestVets({
          reasonCode: appt.reason_code || 'other',
          date: selectedDate,
          preferredTime: appt.appointment_at
            ? new Date(appt.appointment_at).toTimeString().slice(0, 5)
            : '09:00',
          limit: 5,
        });
        const suggestions = (altRes?.suggestions || []).filter(s => s.vet_id !== currentVetId);
        setAltSuggestions(suggestions);

        // If no alternatives either, show message
        if (suggestions.length === 0) {
          setError('No vets are available on this date. Try another day.');
        }
      }
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to check availability.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, currentVetId, appt]);

  useEffect(() => {
    checkAvailability();
  }, [selectedDate]);

  // Fetch full slot list for an alternative vet when selected
  useEffect(() => {
    if (!selectedVetId || selectedVetId === currentVetId || !selectedDate) return;
    if (altVetSlots[selectedVetId]) return; // already fetched
    let cancelled = false;
    (async () => {
      try {
        const slotData = await scheduleService.getAvailableSlots(selectedVetId, selectedDate);
        if (!cancelled) {
          setAltVetSlots(prev => ({ ...prev, [selectedVetId]: slotData?.slots || [] }));
        }
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [selectedVetId, selectedDate]);

  const handleReschedule = async () => {
    if (!selectedTime || !selectedVetId || !selectedDate) return;
    setSubmitting(true);
    setError('');

    try {
      const [h, m] = selectedTime.split(':');
      const dt = new Date(`${selectedDate}T${h.padStart(2, '0')}:${m.padStart(2, '0')}:00`);

      await appointmentService.reschedule(appt.id, {
        appointmentAt: dt.toISOString(),
        appointmentLocalDate: selectedDate,
        appointmentLocalTime: selectedTime,
        vetId: selectedVetId,
        durationMins: appt.duration_mins || 30,
      });

      setSuccess(true);
      setTimeout(() => onSuccess?.(), 1500);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to reschedule.');
      setSubmitting(false);
    }
  };

  const selectSlot = (time, vetId, vetName) => {
    setSelectedTime(time);
    setSelectedVetId(vetId);
    setSelectedVetName(vetName);
  };

  // Success screen
  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-3">
            <Check className="w-7 h-7 text-emerald-600" />
          </div>
          <p className="font-display text-lg font-700 text-slate-800">Appointment Rescheduled</p>
          <p className="text-sm text-slate-500 font-body mt-1">
            New date: {new Date(`${selectedDate}T${selectedTime}`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            {' at '}{selectedTime}
          </p>
          <p className="text-xs text-slate-400 font-body mt-2">Vet: {selectedVetName}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-display text-slate-800 text-lg font-700">Reschedule Appointment</h2>
            <p className="text-xs text-slate-400 font-body mt-0.5">
              {appt.pets?.name ? `${appt.pets.name} — ` : ''}{appt.type}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-red-500 text-sm font-body">{error}</p>
            </div>
          )}

          {/* Current appointment info */}
          <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3 text-xs text-slate-500 font-body">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>Currently: {appt.appointment_at ? new Date(appt.appointment_at).toLocaleString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : '—'}</span>
            <span className="text-slate-300">|</span>
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>{currentVetName}</span>
          </div>

          {/* Date strip */}
          <div>
            <p className="text-xs font-body font-600 uppercase tracking-wider text-slate-400 mb-2">
              Pick a new date
            </p>
            <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
              {dates.map((d) => {
                const iso = toISODate(d);
                const { wd, md } = dayLabel(d);
                const active = selectedDate === iso;
                return (
                  <button key={iso} onClick={() => setSelectedDate(iso)}
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

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
            </div>
          )}

          {/* Original vet available — show their slots */}
          {!loading && originalVetAvailable === true && (
            <div>
              <p className="text-xs font-body font-600 uppercase tracking-wider text-slate-400 mb-2">
                {currentVetName}'s available slots
              </p>
              <div className="flex flex-wrap gap-2">
                {originalVetSlots.map((slot) => {
                  const isSel = selectedTime === slot.start;
                  return (
                    <button key={slot.start} type="button"
                      onClick={() => selectSlot(slot.start, currentVetId, currentVetName)}
                      className={`text-xs font-body font-600 px-3 py-1.5 rounded-lg border transition-colors
                        ${isSel
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}>
                      {slot.start}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Original vet NOT available — show alternatives */}
          {!loading && originalVetAvailable === false && (
            <div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-amber-500" />
                  <p className="text-sm font-body font-600 text-amber-700">
                    {currentVetName} is not available on this date
                  </p>
                </div>
                <p className="text-xs text-amber-600 font-body mt-1">
                  Here are other vets who can see your pet:
                </p>
              </div>

              {altSuggestions.length > 0 ? (
                <ul className="space-y-2">
                  {altSuggestions.map((s) => {
                    const isVetSel = selectedVetId === s.vet_id && selectedTime;
                    return (
                      <li key={s.vet_id}>
                        <button type="button"
                          onClick={() => { setSelectedVetId(s.vet_id); setSelectedVetName(s.vet_name); }}
                          className={`w-full text-left bg-white rounded-xl border p-3 transition-colors
                            ${isVetSel ? 'border-blue-400 ring-2 ring-blue-200' : 'border-slate-100 hover:border-blue-300'}`}>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                              <User className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-body font-600 text-slate-700 truncate">
                                {s.vet_name}
                                {s.specialization && <span className="ml-2 text-[10px] font-600 text-slate-400 uppercase tracking-wider">{s.specialization}</span>}
                              </p>
                              <p className="text-xs text-slate-500 font-body">
                                Nearest: <span className="font-600 text-slate-700">{fmtTime(s.slot_start)}</span>
                                {' · '}{s.delta_mins != null ? `${s.delta_mins} min from preferred time` : ''}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300" />
                          </div>
                        </button>

                        {/* Show this vet's full slot list when selected */}
                        {selectedVetId === s.vet_id && (
                          <div className="mt-2 ml-4 pl-3 border-l-2 border-blue-200">
                            <p className="text-xs font-body text-slate-400 uppercase tracking-wider mb-1.5">
                              All open slots for {s.vet_name}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {altVetSlots[s.vet_id] ? (
                                altVetSlots[s.vet_id].filter(sl => sl.available).map((sl) => {
                                  const isTimeSel = selectedTime === sl.start;
                                  return (
                                    <button key={sl.start} type="button"
                                      onClick={() => selectSlot(sl.start, s.vet_id, s.vet_name)}
                                      className={`text-xs font-body font-600 px-2.5 py-1 rounded-lg border transition-colors
                                        ${isTimeSel
                                          ? 'bg-blue-600 text-white border-blue-600'
                                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                                      {sl.start}
                                    </button>
                                  );
                                })
                              ) : (
                                <div className="flex items-center gap-1.5 py-1">
                                  <Loader2 className="w-3 h-3 animate-spin text-slate-300" />
                                  <span className="text-xs text-slate-400 font-body">Loading slots…</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-slate-400 font-body text-center py-4 bg-slate-50 rounded-xl">
                  No other vets available on this date either. Try another day.
                </p>
              )}
            </div>
          )}

          {/* Selected summary */}
          {!loading && selectedTime && selectedVetId && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-xs font-body font-600 text-blue-700 uppercase tracking-wider mb-1">New appointment</p>
              <p className="text-sm font-display font-700 text-blue-900">
                {new Date(`${selectedDate}T${selectedTime}`).toLocaleDateString('en-US', {
                  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                })} at {selectedTime}
              </p>
              <p className="text-xs text-blue-600 font-body mt-0.5">Vet: {selectedVetName}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 text-sm font-body font-600 transition-colors">
            Cancel
          </button>
          <button onClick={handleReschedule}
            disabled={!selectedTime || !selectedVetId || submitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-body font-600 shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Rescheduling…</>
            ) : (
              <><RefreshCw className="w-4 h-4" /> Confirm Reschedule</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
