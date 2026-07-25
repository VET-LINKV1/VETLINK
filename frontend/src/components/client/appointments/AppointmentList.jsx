import { Calendar, Plus } from 'lucide-react';
import AppointmentCard from './AppointmentCard';

function AppointmentList({ appointments, onCancel, onBook }) {
  const upcoming = appointments.filter(
    a => a.status === 'pending' || a.status === 'confirmed'
  );

  if (upcoming.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <Calendar className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="font-display text-slate-600 font-600 mb-1">No upcoming appointments</h3>
        <p className="text-slate-400 font-body text-sm mb-5">
          Book a visit for your pet today
        </p>
        <button onClick={onBook}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-body font-600 hover:bg-blue-700 shadow-lg shadow-blue-500/25 transition-all">
          <Plus className="w-4 h-4" /> Book Appointment
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {upcoming.map(appt => (
        <AppointmentCard key={appt.id} appointment={appt} onCancel={onCancel} />
      ))}
    </div>
  );
}

export default AppointmentList;
