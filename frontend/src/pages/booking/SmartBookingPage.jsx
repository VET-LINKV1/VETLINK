/**
 * SmartBookingPage.jsx
 *
 * Client-side booking wizard.
 *   1. Pick a pet
 *   2. Pick a reason
 *   3. Pick date + vet + slot
 *   4. Review + confirm → POST /api/booking
 *   5. On success, offer to fill the pre-visit intake form
 *
 * Mounted at /client/book (and /book for staff booking on behalf).
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PawPrint, ChevronLeft, ChevronRight, Loader2, Check, AlertCircle, Calendar, ClipboardList, Siren,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { bookingService } from '../../services/bookingService';
import { clientService } from '../../services/clientService';
import ReasonPicker from '../../components/booking/ReasonPicker';
import SlotPicker   from '../../components/booking/SlotPicker';

const STEPS = [
  { key: 'pet',     label: 'Pet'    },
  { key: 'reason',  label: 'Reason' },
  { key: 'time',    label: 'Time'   },
  { key: 'review',  label: 'Review' },
];

export default function SmartBookingPage() {
  const { user } = useAuth();
  const role = user?.role;
  const navigate = useNavigate();

  const [pets, setPets]       = useState([]);
  const [reasons, setReasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');

  const [step, setStep]   = useState(0);
  const [pet, setPet]     = useState(null);
  const [reason, setReason] = useState(null);
  const [slot, setSlot]   = useState(null);   // { date, vetId, slotISO }
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked]         = useState(null);

  // Load pets + reasons on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [r, p] = await Promise.all([
          bookingService.listReasons(),
          role === 'client' ? clientService.getPets() : Promise.resolve([]),
        ]);
        if (!cancelled) {
          setReasons(r || []);
          setPets(p || []);
        }
      } catch (e) {
        if (!cancelled) setErr(e?.response?.data?.error || 'Failed to load.');
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [role]);

  const canNext = useMemo(() => {
    if (step === 0) return !!pet;
    if (step === 1) return !!reason;
    if (step === 2) return !!(slot?.vetId && slot?.slotISO);
    return true;
  }, [step, pet, reason, slot]);

  const next = () => setStep(s => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep(s => Math.max(0, s - 1));

  const confirm = async () => {
    setSubmitting(true); setErr('');
    try {
      const data = await bookingService.createBooking({
        petId:         pet.id,
        reasonCode:    reason.code,
        appointmentAt: slot.slotISO,
        vetId:         slot.vetId,
        durationMins:  reason.durationMins,
        notes:         notes || undefined,
      });
      setBooked(data);
    } catch (e) {
      setErr(e?.response?.data?.error || 'Failed to book appointment.');
    } finally { setSubmitting(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>;
  }

  // Success screen
  if (booked) {
    const isEmer = booked.urgency === 'emergency';
    return (
      <div className="max-w-xl mx-auto">
        <div className={`rounded-2xl p-6 text-center text-white shadow-lg ${isEmer ? 'bg-gradient-to-br from-red-500 to-red-700' : 'bg-gradient-to-br from-emerald-500 to-emerald-700'}`}>
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mx-auto mb-3">
            {isEmer ? <Siren className="w-7 h-7" /> : <Check className="w-7 h-7" />}
          </div>
          <p className="font-display text-2xl font-700">
            {isEmer ? 'Emergency booked — front desk alerted' : 'Appointment booked!'}
          </p>
          <p className="text-sm opacity-90 mt-1">
            {new Date(booked.appointment_at).toLocaleString()}
          </p>
        </div>

        <div className="mt-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl p-5 space-y-3">
          <p className="font-display font-600 text-slate-700 dark:text-slate-200">What's next?</p>
          <p className="text-sm text-slate-500 font-body">
            Filling out the pre-visit intake helps the vet prepare before your visit.
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate(`/intake/${booked.id}`)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-body font-600">
              <ClipboardList className="w-4 h-4" /> Fill intake form
            </button>
            <button onClick={() => navigate(role === 'client' ? '/client/appointments' : '/appointments')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-body font-600">
              <Calendar className="w-4 h-4" /> View appointments
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="font-display text-slate-800 dark:text-white text-2xl font-700">Book an appointment</h1>
        <p className="text-slate-400 font-body text-sm mt-0.5">
          Pick a reason, we'll suggest the nearest available vet.
        </p>
      </div>

      {/* Stepper */}
      <ol className="flex items-center gap-2 text-xs font-body font-600 text-slate-400">
        {STEPS.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center
              ${i < step ? 'bg-blue-600 text-white'
              : i === step ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-300'
              : 'bg-slate-100 text-slate-400'}`}>
              {i < step ? <Check className="w-3 h-3" /> : i + 1}
            </span>
            <span className={i === step ? 'text-slate-700 dark:text-slate-200' : ''}>{s.label}</span>
            {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 opacity-50" />}
          </li>
        ))}
      </ol>

      {err && (
        <p className="bg-red-50 border border-red-100 text-red-600 text-sm font-body px-3 py-2 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {err}
        </p>
      )}

      {/* Step content */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl p-5">
        {STEPS[step].key === 'pet' && (
          role === 'client' ? (
            !pets.length ? (
              <div className="text-center py-10">
                <PawPrint className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-body">You have no pets registered yet.</p>
                <button onClick={() => navigate('/client/pets')}
                  className="mt-3 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-body font-600">
                  Add a pet
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pets.map((p) => (
                  <button key={p.id} onClick={() => setPet(p)}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors
                      ${pet?.id === p.id
                        ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-slate-200 bg-white hover:border-blue-300'}`}>
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                      <PawPrint className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-body font-600 text-slate-700 dark:text-slate-200">{p.name}</p>
                      <p className="text-xs text-slate-400 font-body">
                        {p.species}{p.breed ? ` · ${p.breed}` : ''}{p.age != null ? ` · ${p.age}y` : ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (
            <p className="text-sm text-slate-500 font-body">
              Staff bookings require selecting a client + pet. (Coming soon — for now use the legacy /appointments page.)
            </p>
          )
        )}

        {STEPS[step].key === 'reason' && (
          <ReasonPicker reasons={reasons} selected={reason?.code} onSelect={setReason} />
        )}

        {STEPS[step].key === 'time' && (
          <SlotPicker reason={reason} value={slot} onChange={setSlot} />
        )}

        {STEPS[step].key === 'review' && (
          <div className="space-y-4">
            <Review
              pet={pet} reason={reason} slot={slot}
              notes={notes} setNotes={setNotes} />
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between">
        <button onClick={back} disabled={step === 0}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40 text-sm font-body">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        {step < STEPS.length - 1 ? (
          <button onClick={next} disabled={!canNext}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-body font-600 shadow-md shadow-blue-500/20 disabled:opacity-50">
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={confirm} disabled={submitting}
            className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-white text-sm font-body font-600 shadow-md disabled:opacity-50
              ${reason?.code === 'emergency'
                ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'}`}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {reason?.code === 'emergency' ? 'Confirm emergency booking' : 'Confirm booking'}
          </button>
        )}
      </div>
    </div>
  );
}

function Review({ pet, reason, slot, notes, setNotes }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card label="Pet"    value={pet?.name}    sub={`${pet?.species || ''}${pet?.breed ? ` · ${pet.breed}` : ''}`} />
        <Card label="Reason" value={reason?.label} sub={`${reason?.durationMins || 30} min`}
          tone={reason?.code === 'emergency' ? 'red' : reason?.code === 'injury' ? 'amber' : 'blue'} />
        <Card label="When"   value={slot ? new Date(slot.slotISO).toLocaleString() : '—'} />
      </div>
      <label className="block">
        <span className="block text-[10px] uppercase tracking-wider font-body font-600 text-slate-400 mb-1">
          Anything else the vet should know?
        </span>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="(optional)"
          className="w-full rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-sm font-body bg-white dark:bg-slate-800" />
      </label>
    </>
  );
}

function Card({ label, value, sub, tone = 'blue' }) {
  const tones = {
    blue:  'border-blue-200 bg-blue-50',
    amber: 'border-amber-200 bg-amber-50',
    red:   'border-red-200 bg-red-50',
  };
  return (
    <div className={`rounded-xl border p-3 ${tones[tone] || tones.blue}`}>
      <p className="text-[10px] uppercase tracking-wider font-body font-600 text-slate-500">{label}</p>
      <p className="font-display font-700 text-slate-800 truncate">{value || '—'}</p>
      {sub && <p className="text-xs text-slate-500 font-body">{sub}</p>}
    </div>
  );
}
