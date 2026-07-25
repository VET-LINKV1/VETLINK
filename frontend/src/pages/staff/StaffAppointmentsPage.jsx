/**
 * StaffAppointmentsPage.jsx
 * Staff/Admin view: confirm, complete, cancel any appointment.
 */
import { useState, useEffect, useCallback } from 'react';
import { appointmentService } from '../../services/appointmentService';
import AppointmentCard from '../../components/appointments/AppointmentCard';
import { Calendar, Search, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const STATUS_TABS = [
  { value: '',           label: 'All',       color: 'text-slate-500' },
  { value: 'pending',    label: 'Pending',   color: 'text-amber-600' },
  { value: 'confirmed',  label: 'Confirmed', color: 'text-blue-600' },
  { value: 'completed',  label: 'Completed', color: 'text-teal-600' },
  { value: 'no_show',    label: 'No-Show',   color: 'text-red-600' },
  { value: 'declined',   label: 'Declined',  color: 'text-red-500' },
  { value: 'cancelled',  label: 'Cancelled', color: 'text-red-400' },
];

export default function StaffAppointmentsPage() {
  const { role } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [dateFilter, setDateFilter]     = useState('');
  const [search, setSearch]             = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await appointmentService.getAll({
        status: statusFilter || undefined,
        date:   dateFilter   || undefined,
      });
      setAppointments(data);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFilter]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleStatusChange = async (id, newStatus) => {
    const reason = (newStatus === 'cancelled' || newStatus === 'declined')
      ? prompt(newStatus === 'declined' ? 'Reason for decline (optional):' : 'Reason for cancellation (optional):') ?? undefined
      : undefined;
    try {
      await appointmentService.updateStatus(id, newStatus, reason);
      loadAll();
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to update status.');
    }
  };

  // Client-side search filter
  const filtered = appointments.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.pets?.name?.toLowerCase().includes(q) ||
      a.client?.name?.toLowerCase().includes(q) ||
      a.type?.toLowerCase().includes(q) ||
      a.vet?.name?.toLowerCase().includes(q)
    );
  });

  const counts = appointments.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-slate-800 dark:text-white text-2xl font-700">Appointments</h1>
          <p className="text-slate-400 dark:text-slate-500 font-body text-sm mt-0.5">{appointments.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 dark:text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search pet, owner, type..."
              className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-body focus:outline-none focus:ring-2 focus:ring-blue-500 w-52" />
          </div>
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-body focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={loadAll} className="p-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:bg-slate-800/50 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-red-500 text-sm font-body">{error}</p>
        </div>
      )}

      {/* Tabs with counts */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
        {STATUS_TABS.map(tab => (
          <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-body font-600 transition-all ${
              statusFilter === tab.value ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-slate-700'
            }`}>
            {tab.label}
            {tab.value && counts[tab.value] ? (
              <span className={`text-xs font-700 ${tab.color || 'text-slate-500'}`}>
                {counts[tab.value]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="flex gap-1.5">
            {[0,1,2].map(i => <div key={i} className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-bounce" style={{animationDelay:`${i*0.15}s`}} />)}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 dark:border-white/10">
          <Calendar className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="font-display text-slate-500 dark:text-slate-400 dark:text-slate-500 font-600">No appointments found</p>
          {search && <p className="text-slate-400 dark:text-slate-500 text-sm font-body mt-1">Try clearing the search filter</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(appt => (
            <AppointmentCard
              key={appt.id}
              appointment={appt}
              userRole={role}
              onStatusChange={handleStatusChange}
              onReschedule={loadAll}
            />
          ))}
        </div>
      )}
    </div>
  );
}
