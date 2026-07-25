import { useState, useEffect } from 'react';
import { scheduleService } from '../../services/scheduleService';
import { Clock, Loader2, AlertCircle } from 'lucide-react';

export default function SlotPicker({ vetId, date, selectedSlot, onSelectSlot }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!vetId || !date) { setData(null); return; }
    setLoading(true); setError('');
    scheduleService.getAvailableSlots(vetId, date)
      .then(setData)
      .catch(err => setError(err?.response?.data?.error || 'Failed to load slots'))
      .finally(() => setLoading(false));
  }, [vetId, date]);

  if (!vetId || !date) return null;
  if (loading) return (
    <div className="flex items-center gap-2 py-3 text-slate-400 text-sm font-body">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading slots...
    </div>
  );
  if (error) return (
    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
      <p className="text-red-500 text-sm font-body">{error}</p>
    </div>
  );
  if (!data?.slots?.length) return (
    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
      <Clock className="w-6 h-6 text-slate-300 mx-auto mb-2" />
      <p className="text-slate-400 text-sm font-body">No available slots on this date.</p>
    </div>
  );

  const availableCount = data.slots.filter(s => s.available).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-body font-600 text-slate-500 uppercase tracking-wide">Available Times</p>
        <span className={`text-xs font-body font-600 px-2 py-0.5 rounded-lg ${availableCount > 0 ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-500'}`}>
          {availableCount} available
        </span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {data.slots.map(slot => {
          const isSelected = selectedSlot === slot.start;
          return (
            <button key={slot.start} type="button" disabled={!slot.available}
              onClick={() => slot.available && onSelectSlot(slot.start)}
              className={`py-2 px-1 rounded-xl text-xs font-body font-600 border transition-all
                ${isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                  : slot.available ? 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:text-blue-600'
                  : 'bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed line-through'}`}>
              {slot.start}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-4">
        {[['bg-white border border-slate-200','Available'],['bg-slate-100','Booked'],['bg-blue-600','Selected']].map(([cls, label]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${cls}`} />
            <span className="text-xs text-slate-400 font-body">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
