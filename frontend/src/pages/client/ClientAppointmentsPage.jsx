/**
 * ClientAppointmentsPage.jsx
 * Unified client view: BOOK a visit (wizard) + view / pay / cancel appointments.
 *
 * The former standalone "Book Visit" (/client/book) wizard is now embedded
 * here, so Pet Owners manage everything appointments-related from one screen:
 *   1. Pick a pet
 *   2. Pick a reason
 *   3. Pick date + vet + slot
 *   4. Review + confirm  → POST /api/booking
 *   5. Success → list refreshes, with an option to fill the intake form
 *   6. Existing unpaid appointments show a "Pay now" → PayMongo button
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { appointmentService } from '../../services/appointmentService';
import { clientService } from '../../services/clientService';
import { bookingService } from '../../services/bookingService';
import AppointmentCard from '../../components/appointments/AppointmentCard';
import PayNowButton from '../../components/client/appointments/PayNowButton';
import ReasonPicker from '../../components/booking/ReasonPicker';
import SlotPicker   from '../../components/booking/SlotPicker';
import {
  Calendar, Plus, Filter, Loader2, AlertCircle, X,
  PawPrint, ChevronLeft, ChevronRight, Check, Siren, ClipboardList,
} from 'lucide-react';

const STATUS_TABS = [
  { value: '',           label: 'All' },
  { value: 'pending',    label: 'Pending' },
  { value: 'confirmed',  label: 'Confirmed' },
  { value: 'completed',  label: 'Completed' },
  { value: 'no_show',    label: 'No-Show' },
  { value: 'cancelled',  label: 'Cancelled' },
];

const BOOK_STEPS = [
  { key: 'pet',    label: 'Pet'    },
  { key: 'reason', label: 'Reason' },
  { key: 'time',   label: 'Time'   },
  { key: 'review', label: 'Review' },
];

export default function ClientAppointmentsPage() {
  const navigate = useNavigate();

  /* ─────────────────── LIST STATE ─────────────────── */
  const [appointments, setAppointments] = useState([]);
  const [pets, setPets]                 = useState([]);
  const [services, setServices]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm]         = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Appointments + pets are required for the page to render.
      const [appts, myPets] = await Promise.all([
        appointmentService.getAll({ status: statusFilter || undefined }),
        clientService.getPets(),
      ]);
      setAppointments(appts);
      setPets(myPets);
      // Services feed the booking form only — never let it block the list.
      appointmentService.listServices()
        .then(setServices)
        .catch(() => setServices([]));
    } catch (err) {
      setError('Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleStatusChange = async (id, newStatus) => {
    try {
      const reason = newStatus === 'cancelled' ? window.prompt('Reason for cancellation (optional):') ?? undefined : undefined;
      await appointmentService.cancel(id, reason);
      loadData();
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to update.');
    }
  };

  const handlePay = () => loadData();

  const upcoming = appointments.filter(a => ['pending','confirmed'].includes(a.status));
  const past     = appointments.filter(a => ['completed','cancelled','no_show'].includes(a.status));
  const toDisplay = appointments;

  /* ─────────────────── BOOKING WIZARD STATE ─────────────────── */
  const [reasons, setReasons]     = useState([]);
  const [bookLoading, setBookLoading] = useState(true);
  const [bookErr, setBookErr]     = useState('');

  const [step, setStep]     = useState(0);
  const [bookPet, setBookPet]       = useState(null);
  const [reason, setReason] = useState(null);
  const [slot, setSlot]     = useState(null);   // { date, vetId, slotISO }
  const [notes, setNotes]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked]         = useState(null);

  // Load reasons (used by the booking wizard) whenever the modal opens
  useEffect(() => {
    if (!showForm) return;
    let cancelled = false;
    (async () => {
      setBookLoading(true); setBookErr('');
      try {
        const r = await bookingService.listReasons();
        if (!cancelled) setReasons(r || []);
      } catch (e) {
        if (!cancelled) setBookErr(e?.response?.data?.error || 'Failed to load services.');
      } finally { if (!cancelled) setBookLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [showForm]);

  const canNext = useMemo(() => {
    if (step === 0) return !!bookPet;
    if (step === 1) return !!reason;
    if (step === 2) return !!(slot?.vetId && slot?.slotISO);
    return true;
  }, [step, bookPet, reason, slot]);

  const next = () => setStep(s => Math.min(BOOK_STEPS.length - 1, s + 1));
  const back = () => setStep(s => Math.max(0, s - 1));

  const resetBooking = () => {
    setStep(0); setBookPet(null); setReason(null); setSlot(null);
    setNotes(''); setBooked(null); setBookErr('');
  };

  const openBooking = () => { resetBooking(); setShowForm(true); };
  const closeBooking = () => { setShowForm(false); resetBooking(); };

  const confirmBooking = async () => {
    setSubmitting(true); setBookErr('');
    try {
      const data = await bookingService.createBooking({
        petId:         bookPet.id,
        reasonCode:    reason.code,
        appointmentAt: slot.slotISO,
        vetId:         slot.vetId,
        durationMins:  reason.durationMins,
        notes:         notes || undefined,
      });
      setBooked(data);
      loadData(); // refresh the list behind the modal
    } catch (e) {
      setBookErr(e?.response?.data?.error || 'Failed to book appointment.');
    } finally { setSubmitting(false); }
  };

  const isEmer = booked?.urgency === 'emergency';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-slate-800 dark:text-white text-2xl font-700">My Appointments</h1>
          <p className="text-slate-400 dark:text-slate-500 font-body text-sm mt-0.5">
            {upcoming.length} upcoming · {past.length} past
          </p>
        </div>
        <button onClick={openBooking}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-body font-600 text-sm shadow-lg shadow-blue-500/25 transition-all">
          <Plus className="w-4 h-4" /> Book Appointment
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-red-500 text-sm font-body">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {STATUS_TABS.map(tab => (
          <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-1.5 rounded-lg text-xs font-body font-600 transition-all ${
              statusFilter === tab.value ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-slate-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Appointments grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="flex gap-1.5">
            {[0,1,2].map(i => <div key={i} className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-bounce" style={{animationDelay:`${i*0.15}s`}} />)}
          </div>
        </div>
      ) : toDisplay.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 dark:border-white/10">
          <Calendar className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="font-display text-slate-500 dark:text-slate-400 dark:text-slate-500 font-600 mb-2">No appointments found</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm font-body mb-5">Book your first appointment to get started.</p>
          <button onClick={openBooking}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-body font-600 hover:bg-blue-700 transition-all">
            <Plus className="w-4 h-4" /> Book Now
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {toDisplay.map(appt => (
            <AppointmentCard
              key={appt.id}
              appointment={appt}
              userRole="client"
              onStatusChange={handleStatusChange}
              onReschedule={loadData}
              onPay={handlePay}
            />
          ))}
        </div>
      )}

      {/* ─────────────────── BOOKING MODAL (merged wizard) ─────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/10 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <h2 className="font-display text-slate-800 dark:text-white text-lg font-700">
                {booked ? 'Booking confirmed' : 'Book an appointment'}
              </h2>
              <button onClick={closeBooking}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5">
              {/* Success screen */}
              {booked ? (
                <div className="space-y-4">
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
                  <p className="text-sm text-slate-500 font-body text-center">
                    Filling out the pre-visit intake helps the vet prepare before your visit.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button onClick={() => { closeBooking(); navigate(`/intake/${booked.id}`); }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-body font-600">
                      <ClipboardList className="w-4 h-4" /> Fill intake form
                    </button>
                    <button onClick={closeBooking}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-body font-600">
                      <Calendar className="w-4 h-4" /> View appointments
                    </button>
                  </div>
                </div>
              ) : bookLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Stepper */}
                  <ol className="flex items-center gap-2 text-xs font-body font-600 text-slate-400">
                    {BOOK_STEPS.map((s, i) => (
                      <li key={s.key} className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center
                            ${i < step ? 'bg-blue-600 text-white'
                            : i === step ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-300'
                            : 'bg-slate-100 text-slate-400'}`}>
                            {i < step ? <Check className="w-3 h-3" /> : i + 1}
                        </span>
                        <span className={i === step ? 'text-slate-700 dark:text-slate-200' : ''}>{s.label}</span>
                        {i < BOOK_STEPS.length - 1 && <ChevronRight className="w-3 h-3 opacity-50" />}
                      </li>
                    ))}
                  </ol>

                  {bookErr && (
                    <p className="bg-red-50 border border-red-100 text-red-600 text-sm font-body px-3 py-2 rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" /> {bookErr}
                    </p>
                  )}

                  {/* Step content */}
                  <div className="rounded-2xl p-1">
                    {BOOK_STEPS[step].key === 'pet' && (
                      !pets.length ? (
                        <div className="text-center py-10">
                          <PawPrint className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                          <p className="text-slate-500 font-body">You have no pets registered yet.</p>
                          <button onClick={() => { closeBooking(); navigate('/client/pets'); }}
                            className="mt-3 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-body font-600">
                            Add a pet
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {pets.map((p) => (
                            <button key={p.id} onClick={() => setBookPet(p)}
                              className={`flex items-center gap-3 p-3 rounded-xl border transition-colors
                                ${bookPet?.id === p.id
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
                    )}

                    {BOOK_STEPS[step].key === 'reason' && (
                      <ReasonPicker reasons={reasons} selected={reason?.code} onSelect={setReason} />
                    )}

                    {BOOK_STEPS[step].key === 'time' && (
                      <SlotPicker reason={reason} value={slot} onChange={setSlot} />
                    )}

                    {BOOK_STEPS[step].key === 'review' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <MiniCard label="Pet"    value={bookPet?.name}    sub={`${bookPet?.species || ''}${bookPet?.breed ? ` · ${bookPet.breed}` : ''}`} />
                          <MiniCard label="Reason" value={reason?.label} sub={`${reason?.durationMins || 30} min`}
                            tone={reason?.code === 'emergency' ? 'red' : reason?.code === 'injury' ? 'amber' : 'blue'} />
                          <MiniCard label="When"   value={slot ? new Date(slot.slotISO).toLocaleString() : '—'} />
                        </div>
                        <label className="block">
                          <span className="block text-[10px] uppercase tracking-wider font-body font-600 text-slate-400 mb-1">
                            Anything else the vet should know?
                          </span>
                          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                            placeholder="(optional)"
                            className="w-full rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-sm font-body bg-white dark:bg-slate-800" />
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Nav */}
                  <div className="flex items-center justify-between pt-2">
                    <button onClick={step === 0 ? closeBooking : back}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40 text-sm font-body">
                      <ChevronLeft className="w-4 h-4" /> {step === 0 ? 'Cancel' : 'Back'}
                    </button>
                    {step < BOOK_STEPS.length - 1 ? (
                      <button onClick={next} disabled={!canNext}
                        className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-body font-600 shadow-md shadow-blue-500/20 disabled:opacity-50">
                        Continue <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button onClick={confirmBooking} disabled={submitting}
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
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniCard({ label, value, sub, tone = 'blue' }) {
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
