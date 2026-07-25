/**
 * VetSchedulePage.jsx
 * Allows veterinarians (and admins) to set their weekly availability.
 * Each day can be toggled on/off with custom start/end times.
 *
 * Layout: 2-column on lg+ screens.
 *   LEFT  — day toggles + time inputs (the editor)
 *   RIGHT — live weekly calendar grid that mirrors the editor in real time
 */
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { scheduleService } from '../../services/scheduleService';
import { Clock, CheckCircle, AlertCircle, Loader2, Save, CalendarDays } from 'lucide-react';

const DAYS = [
  { value: 0, label: 'Sunday',    short: 'Sun' },
  { value: 1, label: 'Monday',    short: 'Mon' },
  { value: 2, label: 'Tuesday',   short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday',  short: 'Thu' },
  { value: 5, label: 'Friday',    short: 'Fri' },
  { value: 6, label: 'Saturday',  short: 'Sat' },
];

const DEFAULT_SCHEDULE = {
  startTime: '09:00',
  endTime:   '17:00',
  slotDurationMins: 30,
  isActive: false,
};

// Calendar-grid helpers
const GRID_START_HOUR = 7;   // grid spans 07:00…21:00 (covers most reasonable clinic hours)
const GRID_END_HOUR   = 21;
const HOUR_PX         = 36;  // pixels per hour
const HOURS = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR + 1 }, (_, i) => GRID_START_HOUR + i);

function timeToMins(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** Compute pixel offset + height inside the calendar grid for a given start/end time. */
function gridBlock(startTime, endTime) {
  const startM = timeToMins(startTime);
  const endM   = timeToMins(endTime);
  const gridStartM = GRID_START_HOUR * 60;
  const top    = ((startM - gridStartM) / 60) * HOUR_PX;
  const height = ((endM - startM) / 60) * HOUR_PX;
  return { top: Math.max(0, top), height: Math.max(0, height) };
}

/** Build the visual slot ticks inside an active day's block. */
function buildSlotTicks(startTime, endTime, slotMins) {
  const out = [];
  const startM = timeToMins(startTime);
  const endM   = timeToMins(endTime);
  for (let m = startM + slotMins; m < endM; m += slotMins) {
    const offset = ((m - startM) / 60) * HOUR_PX;
    out.push(offset);
  }
  return out;
}

export default function VetSchedulePage() {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState(
    DAYS.reduce((acc, d) => ({ ...acc, [d.value]: { ...DEFAULT_SCHEDULE } }), {})
  );
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [success, setSuccess]   = useState(false);
  const [error, setError]       = useState('');

  // Load existing schedule
  useEffect(() => {
    if (!user?.id) return;
    scheduleService.getVetSchedule(user.id)
      .then(existing => {
        if (existing?.length > 0) {
          setSchedule(prev => {
            const updated = { ...prev };
            existing.forEach(row => {
              updated[row.day_of_week] = {
                startTime:        row.start_time.slice(0, 5),
                endTime:          row.end_time.slice(0, 5),
                slotDurationMins: row.slot_duration_mins,
                isActive:         row.is_active,
              };
            });
            return updated;
          });
        }
      })
      .catch(() => setError('Failed to load schedule'))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const toggleDay = (day) => {
    setSchedule(prev => ({ ...prev, [day]: { ...prev[day], isActive: !prev[day].isActive } }));
  };
  const updateDay = (day, key, value) => {
    setSchedule(prev => ({ ...prev, [day]: { ...prev[day], [key]: value } }));
  };

  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess(false);
    try {
      const days = DAYS.map(d => ({
        dayOfWeek:        d.value,
        startTime:        schedule[d.value].startTime,
        endTime:          schedule[d.value].endTime,
        slotDurationMins: schedule[d.value].slotDurationMins,
        isActive:         schedule[d.value].isActive,
      }));
      await scheduleService.setWeeklySchedule(days);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save schedule.');
    } finally {
      setSaving(false);
    }
  };

  const activeDays = useMemo(() => DAYS.filter(d => schedule[d.value].isActive).length, [schedule]);

  // Today's column index for the calendar (Sun=0..Sat=6)
  const todayIdx = new Date().getDay();

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex gap-1.5">
        {[0,1,2].map(i => <div key={i} className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-bounce" style={{animationDelay:`${i*0.15}s`}} />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-slate-800 dark:text-white text-2xl font-700">My Schedule</h1>
          <p className="text-slate-400 dark:text-slate-500 font-body text-sm mt-0.5">
            Set your weekly availability — {activeDays} day{activeDays !== 1 ? 's' : ''} active
          </p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-body font-600 text-sm shadow-lg shadow-blue-500/25 disabled:opacity-60 transition-all">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Schedule</>}
        </button>
      </div>

      {/* Banners */}
      {success && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100">
          <CheckCircle className="w-5 h-5 text-blue-500 shrink-0" />
          <p className="text-blue-700 font-body text-sm font-500">Schedule saved successfully!</p>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-red-600 font-body text-sm">{error}</p>
        </div>
      )}

      {/* === 2-column layout === */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── LEFT: editor ── */}
        <div className="lg:col-span-3 space-y-3">
          {DAYS.map(day => {
            const s = schedule[day.value];
            return (
              <div key={day.value}
                className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all ${s.isActive ? 'border-blue-200 shadow-sm' : 'border-slate-100'}`}>
                <div className="flex items-center gap-4 p-4">
                  <button type="button" onClick={() => toggleDay(day.value)}
                    className={`w-11 h-6 rounded-full transition-all duration-200 relative flex-shrink-0 ${s.isActive ? 'bg-blue-600' : 'bg-slate-200'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white dark:bg-slate-900 shadow-sm transition-transform duration-200 ${s.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>

                  <div className="w-24 shrink-0">
                    <p className={`font-display font-600 text-sm ${s.isActive ? 'text-slate-800' : 'text-slate-400'}`}>{day.label}</p>
                  </div>

                  {s.isActive ? (
                    <div className="flex items-center gap-2 flex-1 flex-wrap">
                      <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                      <input type="time" value={s.startTime}
                        onChange={e => updateDay(day.value, 'startTime', e.target.value)}
                        className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-sm font-body focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                      <span className="text-slate-400 dark:text-slate-500 text-xs">to</span>
                      <input type="time" value={s.endTime}
                        onChange={e => updateDay(day.value, 'endTime', e.target.value)}
                        className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-sm font-body focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                      <select value={s.slotDurationMins}
                        onChange={e => updateDay(day.value, 'slotDurationMins', parseInt(e.target.value, 10))}
                        className="ml-auto px-2 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-body focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 dark:bg-slate-900">
                        <option value={15}>15 min</option>
                        <option value={30}>30 min</option>
                        <option value={45}>45 min</option>
                        <option value={60}>60 min</option>
                      </select>
                    </div>
                  ) : (
                    <p className="text-slate-300 dark:text-slate-600 text-sm font-body flex-1">Day off</p>
                  )}
                </div>

                {s.isActive && (
                  <div className="px-4 pb-3">
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-body">
                      {(() => {
                        const totalMins = timeToMins(s.endTime) - timeToMins(s.startTime);
                        const slots = totalMins > 0 ? Math.floor(totalMins / s.slotDurationMins) : 0;
                        return `${slots} slot${slots !== 1 ? 's' : ''} · ${s.startTime}–${s.endTime}`;
                      })()}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-xs text-slate-300 dark:text-slate-600 font-body text-center pt-2">
            Changes take effect immediately for new bookings
          </p>
        </div>

        {/* ── RIGHT: live weekly calendar grid ── */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm overflow-hidden sticky top-6">
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-100 dark:border-white/10 dark:border-white/10">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-blue-500" />
                <p className="font-display text-slate-800 dark:text-white text-sm font-700">Weekly preview</p>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-body">{activeDays} active</p>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-[40px_repeat(7,1fr)] border-b border-slate-100 dark:border-white/10 text-center">
              <div className="" />
              {DAYS.map((d, i) => {
                const isActive = schedule[d.value].isActive;
                const isToday = i === todayIdx;
                return (
                  <div key={d.value} className={`py-2 text-[10px] font-body font-700 ${
                    isToday ? 'text-blue-600' : isActive ? 'text-slate-700' : 'text-slate-300'
                  }`}>
                    <p>{d.short}</p>
                    {isToday && <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mt-0.5" />}
                  </div>
                );
              })}
            </div>

            {/* Time grid */}
            <div className="relative" style={{ height: HOURS.length * HOUR_PX }}>
              <div className="absolute inset-0 grid grid-cols-[40px_repeat(7,1fr)]">
                {/* Hour labels column */}
                <div className="relative">
                  {HOURS.map((h, i) => (
                    <div key={h} className="absolute left-0 right-0 text-[9px] font-mono text-slate-300 dark:text-slate-600 text-right pr-1.5"
                      style={{ top: i * HOUR_PX - 4 }}>
                      {String(h).padStart(2, '0')}
                    </div>
                  ))}
                </div>

                {/* 7 day columns */}
                {DAYS.map((d) => {
                  const s = schedule[d.value];
                  const blk = s.isActive ? gridBlock(s.startTime, s.endTime) : null;
                  const ticks = s.isActive ? buildSlotTicks(s.startTime, s.endTime, s.slotDurationMins) : [];
                  return (
                    <div key={d.value} className="relative border-l border-slate-100 dark:border-white/10 dark:border-white/10">
                      {/* Hour rules */}
                      {HOURS.slice(0, -1).map((h, i) => (
                        <div key={h} className="absolute left-0 right-0 border-t border-dashed border-slate-100 dark:border-white/10 dark:border-white/10"
                          style={{ top: (i + 1) * HOUR_PX }} />
                      ))}

                      {/* Active-time block */}
                      {blk && blk.height > 0 && (
                        <div
                          className="absolute left-0.5 right-0.5 rounded-md bg-gradient-to-b from-blue-500 to-blue-600 ring-1 ring-blue-400/50 shadow-sm overflow-hidden"
                          style={{ top: blk.top, height: blk.height }}
                        >
                          {/* Slot ticks (faint internal lines so vet sees granularity) */}
                          {ticks.map((t, i) => (
                            <div key={i} className="absolute left-0 right-0 border-t border-white/20"
                              style={{ top: t }} />
                          ))}
                          {/* Time label inside block */}
                          {blk.height > 30 && (
                            <p className="text-[9px] font-mono font-700 text-white/90 px-1 pt-0.5 leading-tight">
                              {s.startTime}
                            </p>
                          )}
                          {blk.height > 60 && (
                            <p className="absolute bottom-0.5 left-1 text-[9px] font-mono font-700 text-white/90 leading-tight">
                              {s.endTime}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer summary */}
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-white/10 flex items-center justify-between text-[11px] font-body">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-blue-500" />
                <span className="text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-500">Working</span>
              </div>
              <span className="text-slate-400 dark:text-slate-500 dark:text-slate-500">
                {(() => {
                  const totalSlots = DAYS.reduce((sum, d) => {
                    const s = schedule[d.value];
                    if (!s.isActive) return sum;
                    const m = timeToMins(s.endTime) - timeToMins(s.startTime);
                    return sum + (m > 0 ? Math.floor(m / s.slotDurationMins) : 0);
                  }, 0);
                  return `${totalSlots} slot${totalSlots !== 1 ? 's' : ''} / week`;
                })()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
