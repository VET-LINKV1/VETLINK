/**
 * AppointmentForm.jsx
 * Booking form with live service pricing + PayMongo checkout redirect.
 *
 * Flow:
 *   1. user fills the form
 *   2. clicks "Pay & Book" → backend creates appointment with payment_status=pending
 *   3. immediately request a PayMongo checkout session for that appointment
 *   4. window.location → PayMongo hosted checkout (cards / GCash / PayMaya / GrabPay)
 *   5. after payment → user returns to /client/payment/success which polls + reconciles
 */
import { useState, useEffect, useMemo } from 'react';
import { scheduleService } from '../../services/scheduleService';
import { appointmentService } from '../../services/appointmentService';
import { paymentService } from '../../services/paymentService';
import SlotPicker from './SlotPicker';
import {
  PawPrint, Stethoscope, Calendar, Clock,
  FileText, Loader2, AlertCircle, X, CreditCard, ShieldCheck,
} from 'lucide-react';

function AppointmentForm({ pets, onSuccess, onClose }) {
  const [vets, setVets]               = useState([]);
  const [services, setServices]       = useState([]); // [{name, centavos, displayPrice}]
  const [form, setForm]               = useState({
    petId: '', vetId: '', date: '', slot: '', type: 'General Checkup', notes: '',
  });
  const [loading, setLoading]         = useState(false);
  const [loadingVets, setLoadingVets] = useState(true);
  const [error, setError]             = useState('');
  const [errors, setErrors]           = useState({});

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate  = tomorrow.toISOString().split('T')[0];

  useEffect(() => {
    scheduleService.getAllVets()
      .then(setVets)
      .catch(() => setError('Failed to load veterinarians.'))
      .finally(() => setLoadingVets(false));
    paymentService.listServices()
      .then(setServices)
      .catch(() => {/* non-fatal — fallback to old static list below */});
  }, []);

  // Either backend-driven prices, or static fallback if /payments/services is unreachable
  const serviceOptions = useMemo(() => {
    if (services?.length) return services;
    return [
      { name:'General Checkup',      centavos:50000,  displayPrice:'₱500.00' },
      { name:'Vaccination',          centavos:80000,  displayPrice:'₱800.00' },
      { name:'Dental Cleaning',      centavos:120000, displayPrice:'₱1,200.00' },
      { name:'Surgery Consultation', centavos:150000, displayPrice:'₱1,500.00' },
      { name:'Dermatology',          centavos:100000, displayPrice:'₱1,000.00' },
      { name:'Follow-up Visit',      centavos:30000,  displayPrice:'₱300.00' },
      { name:'Emergency',            centavos:200000, displayPrice:'₱2,000.00' },
      { name:'Grooming',             centavos:60000,  displayPrice:'₱600.00' },
      { name:'Other',                centavos:50000,  displayPrice:'₱500.00' },
    ];
  }, [services]);

  const selectedService = serviceOptions.find(s => s.name === form.type);

  const set = (key, val) => {
    setForm(p => ({ ...p, [key]: val, ...(key === 'vetId' || key === 'date' ? { slot: '' } : {}) }));
    setErrors(p => ({ ...p, [key]: '' }));
    setError('');
  };

  const validate = () => {
    const e = {};
    if (!form.petId)  e.petId  = 'Select a pet';
    if (!form.vetId)  e.vetId  = 'Select a veterinarian';
    if (!form.date)   e.date   = 'Select a date';
    if (!form.slot)   e.slot   = 'Select a time slot';
    if (!form.type)   e.type   = 'Select a service type';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setError('');

    try {
      // Step 1 — book the appointment (server sets amount + payment_status='pending')
      const [h, m] = form.slot.split(':');
      const dt = new Date(`${form.date}T${h.padStart(2,'0')}:${m.padStart(2,'0')}:00`);
      const localTime = h.padStart(2,'0') + ':' + m.padStart(2,'0');

      const appt = await appointmentService.book({
        petId:                form.petId,
        vetId:                form.vetId,
        appointmentAt:        dt.toISOString(),
        appointmentLocalDate: form.date,
        appointmentLocalTime: localTime,
        type:                 form.type,
        notes:                form.notes || undefined,
        durationMins:         30,
      });

      // Step 2 — create checkout session
      const checkout = await paymentService.createCheckoutSession(appt.id);

      // Step 3a — free service short-circuit
      if (checkout.free) {
        if (onSuccess) onSuccess(appt);
        return;
      }

      // Step 3b — redirect to PayMongo
      if (checkout.checkoutUrl) {
        window.location.href = checkout.checkoutUrl;
        return;
      }

      throw new Error('Payment provider returned no checkout URL.');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Booking failed. Please try again.');
      setLoading(false);
    }
  };

  const inputClass = (key) => `
    w-full px-4 py-2.5 rounded-xl border text-sm font-body
    focus:outline-none focus:ring-2 focus:border-transparent transition-all
    bg-white dark:bg-slate-900 text-slate-800 dark:text-white
    ${errors[key] ? 'border-red-300 focus:ring-red-400' : 'border-slate-200 dark:border-white/10 focus:ring-blue-500'}
  `;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-white/10 overflow-hidden w-full max-w-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/5">
        <h2 className="font-display text-slate-800 dark:text-white text-lg font-700">Book Appointment</h2>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-red-500 text-sm font-body">{error}</p>
          </div>
        )}

        {/* Pet selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5 font-body">
            <span className="flex items-center gap-1.5"><PawPrint className="w-3.5 h-3.5" /> Select Pet *</span>
          </label>
          {pets.length === 0 ? (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
              <p className="text-amber-600 text-sm font-body">Add a pet before booking an appointment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {pets.map(pet => (
                <button key={pet.id} type="button" onClick={() => set('petId', pet.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    form.petId === pet.id
                      ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 hover:border-blue-300'
                  }`}>
                  <p className={`font-display font-600 text-sm ${form.petId === pet.id ? 'text-white' : 'text-slate-800 dark:text-white'}`}>{pet.name}</p>
                  <p className={`text-xs font-body ${form.petId === pet.id ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>{pet.species}{pet.breed ? ` · ${pet.breed}` : ''}</p>
                </button>
              ))}
            </div>
          )}
          {errors.petId && <p className="mt-1 text-xs text-red-500">{errors.petId}</p>}
        </div>

        {/* Vet selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5 font-body">
            <span className="flex items-center gap-1.5"><Stethoscope className="w-3.5 h-3.5" /> Select Veterinarian *</span>
          </label>
          {loadingVets ? (
            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-sm font-body py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading vets...
            </div>
          ) : (
            <select value={form.vetId} onChange={e => set('vetId', e.target.value)} className={inputClass('vetId')}>
              <option value="">Choose a veterinarian...</option>
              {vets.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name}{v.staff_profiles?.specialization ? ` — ${v.staff_profiles.specialization}` : ''}
                </option>
              ))}
            </select>
          )}
          {errors.vetId && <p className="mt-1 text-xs text-red-500">{errors.vetId}</p>}
        </div>

        {/* Date + Service row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5 font-body">
              <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Date *</span>
            </label>
            <input type="date" value={form.date} min={minDate}
              onChange={e => set('date', e.target.value)} className={inputClass('date')} />
            {errors.date && <p className="mt-1 text-xs text-red-500">{errors.date}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5 font-body">
              <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Service *</span>
            </label>
            <select value={form.type} onChange={e => set('type', e.target.value)} className={inputClass('type')}>
              {serviceOptions.map(s => (
                <option key={s.name} value={s.name}>
                  {s.name} — {s.displayPrice}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Slot picker */}
        {form.vetId && form.date && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2 font-body">
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Time Slot *</span>
            </label>
            <SlotPicker
              vetId={form.vetId}
              date={form.date}
              selectedSlot={form.slot}
              onSelectSlot={slot => set('slot', slot)}
            />
            {errors.slot && <p className="mt-1 text-xs text-red-500">{errors.slot}</p>}
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5 font-body">Notes (optional)</label>
          <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)}
            placeholder="Any symptoms or concerns..."
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm font-body focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" />
        </div>

        {/* === Payment summary === */}
        <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-500/10 dark:to-sky-500/5 border border-blue-100 dark:border-blue-400/20 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-300" />
            <p className="font-display text-blue-900 dark:text-blue-100 text-sm font-700">Payment summary</p>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-700 dark:text-slate-200 font-body">{form.type || 'Service'}</span>
            <span className="font-display text-slate-800 dark:text-white font-700">{selectedService?.displayPrice || '—'}</span>
          </div>
          <div className="border-t border-blue-100 dark:border-blue-400/20 pt-2 flex items-center justify-between">
            <span className="text-blue-900 dark:text-blue-100 font-body font-600 text-sm">Total</span>
            <span className="font-display text-blue-900 dark:text-blue-100 text-lg font-700">{selectedService?.displayPrice || '—'}</span>
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            <ShieldCheck className="w-3 h-3 text-blue-600 dark:text-blue-300" />
            <span className="text-blue-700 dark:text-blue-200 text-[11px] font-body">Secured by PayMongo · Cards · GCash · Maya · GrabPay</span>
          </div>
        </div>

        {/* Submit — Pay & Book */}
        <button type="submit" disabled={loading || pets.length === 0}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-display font-600 text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 disabled:opacity-60 disabled:cursor-not-allowed transition-all">
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting to checkout…</>
            : <><CreditCard className="w-4 h-4" /> Pay {selectedService?.displayPrice || ''} & Book</>}
        </button>

        <p className="text-center text-[11px] font-body text-slate-400 dark:text-slate-500">
          You'll be redirected to a secure PayMongo page to complete payment.
        </p>
      </form>
    </div>
  );
}

export default AppointmentForm;
