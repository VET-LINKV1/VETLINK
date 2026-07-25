/**
 * ClientAppointmentsPage.jsx
 * Client view: book + view + cancel appointments.
 */
import { useState, useEffect, useCallback } from 'react';
import { appointmentService } from '../../services/appointmentService';
import { clientService } from '../../services/clientService';
import AppointmentCard from '../../components/appointments/AppointmentCard';
import AppointmentForm from '../../components/appointments/AppointmentForm';
import { Calendar, Plus, Filter, Loader2, AlertCircle, X } from 'lucide-react';

const STATUS_TABS = [
  { value: '',           label: 'All' },
  { value: 'pending',    label: 'Pending' },
  { value: 'confirmed',  label: 'Confirmed' },
  { value: 'completed',  label: 'Completed' },
  { value: 'no_show',    label: 'No-Show' },
  { value: 'cancelled',  label: 'Cancelled' },
];

export default function ClientAppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [pets, setPets]                 = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm]         = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [appts, myPets] = await Promise.all([
        appointmentService.getAll({ status: statusFilter || undefined }),
        clientService.getPets(),
      ]);
      setAppointments(appts);
      setPets(myPets);
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

  const upcoming   = appointments.filter(a => ['pending','confirmed'].includes(a.status));
  const past       = appointments.filter(a => ['completed','cancelled','no_show'].includes(a.status));
  const toDisplay  = statusFilter ? appointments : appointments;

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
        <button onClick={() => setShowForm(true)}
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
          <button onClick={() => setShowForm(true)}
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
            />
          ))}
        </div>
      )}

      {/* Booking modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <AppointmentForm
            pets={pets}
            onSuccess={() => { setShowForm(false); loadData(); }}
            onClose={() => setShowForm(false)}
          />
        </div>
      )}
    </div>
  );
}
