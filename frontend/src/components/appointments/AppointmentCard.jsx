import { useState } from 'react';
import { Calendar, Clock, PawPrint, Stethoscope, MoreVertical, X, CheckCircle, RefreshCw } from 'lucide-react';
import Badge from '../ui/Badge';
import RescheduleModal from './RescheduleModal';

const STATUS_ACTIONS = {
  admin:        { pending: ['confirmed','cancelled'], confirmed: ['completed','cancelled','no_show'], completed: [], cancelled: [], no_show: [], declined: [] },
  staff:        { pending: ['confirmed','cancelled'], confirmed: ['completed','cancelled','no_show'], completed: [], cancelled: [], no_show: [], declined: [] },
  veterinarian: { pending: ['declined'], confirmed: ['completed','cancelled'], completed: [], cancelled: [], no_show: [], declined: [] },
  client:       { pending: ['cancelled'], confirmed: ['cancelled'], completed: [], cancelled: [], no_show: [], declined: [] },
};

const ACTION_LABELS = { confirmed: 'Confirm', completed: 'Mark Complete', cancelled: 'Cancel', no_show: 'No-Show', declined: 'Decline' };
const ACTION_STYLES = {
  confirmed: 'bg-blue-600 text-white hover:bg-blue-700',
  completed: 'bg-teal-600 text-white hover:bg-teal-700',
  cancelled: 'border border-red-200 text-red-500 hover:bg-red-50',
  no_show:   'bg-red-600 text-white hover:bg-red-700',
  declined:  'border border-red-300 text-red-600 hover:bg-red-50',
};

// Reschedule is available for pending/confirmed appointments by clients, staff, and admins
const CAN_RESCHEDULE = {
  admin:        ['pending', 'confirmed'],
  staff:        ['pending', 'confirmed'],
  veterinarian: [],
  client:       ['pending', 'confirmed'],
};

function AppointmentCard({ appointment: appt, userRole, onStatusChange, onReschedule, compact = false }) {
  const actions = STATUS_ACTIONS[userRole]?.[appt.status] || [];
  const canReschedule = (CAN_RESCHEDULE[userRole] || []).includes(appt.status);
  const [showReschedule, setShowReschedule] = useState(false);
  const dt = appt.appointment_at ? new Date(appt.appointment_at) : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Colored top strip by status */}
      <div className={`h-1 ${
        appt.status === 'confirmed' ? 'bg-blue-500'
        : appt.status === 'completed' ? 'bg-teal-500'
        : appt.status === 'cancelled' ? 'bg-red-400'
        : appt.status === 'no_show' ? 'bg-red-600'
        : appt.status === 'declined' ? 'bg-red-500'
        : 'bg-amber-400'
      }`} />

      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-display text-slate-800 text-sm font-700">{appt.type}</h3>
              <Badge label={appt.status} variant={appt.status} />
            </div>
            {dt && (
              <div className="flex items-center gap-3 text-xs text-slate-400 font-body">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Pet + vet info */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {appt.pets && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50">
              <PawPrint className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-display font-600 text-slate-700 truncate">{appt.pets.name}</p>
                <p className="text-xs font-body text-slate-400 truncate">{appt.pets.species}</p>
              </div>
            </div>
          )}
          {appt.vet && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50">
              <Stethoscope className="w-3.5 h-3.5 text-teal-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-display font-600 text-slate-700 truncate">{appt.vet.name}</p>
                <p className="text-xs font-body text-slate-400">Veterinarian</p>
              </div>
            </div>
          )}
        </div>

        {/* Client info — visible to staff/admin/vet */}
        {appt.client && (userRole === 'admin' || userRole === 'staff' || userRole === 'veterinarian') && (
          <p className="text-xs text-slate-400 font-body mb-3">
            Owner: <span className="text-slate-600 font-500">{appt.client.name}</span>
            {appt.client.phone_number && <span className="ml-2 text-slate-400">{appt.client.phone_number}</span>}
          </p>
        )}

        {/* Notes */}
        {appt.notes && !compact && (
          <p className="text-xs text-slate-500 font-body bg-slate-50 rounded-lg px-3 py-2 mb-3 italic">
            "{appt.notes}"
          </p>
        )}

        {/* Action buttons */}
        {(actions.length > 0 || canReschedule) && (
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            {actions.map(action => (
              <button key={action} type="button"
                onClick={() => onStatusChange(appt.id, action)}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-body font-600 transition-all ${ACTION_STYLES[action]}`}>
                {ACTION_LABELS[action]}
              </button>
            ))}
            {canReschedule && (
              <button type="button"
                onClick={() => setShowReschedule(true)}
                className="flex-1 py-1.5 px-3 rounded-lg text-xs font-body font-600 transition-all border border-blue-200 text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-1">
                <RefreshCw className="w-3 h-3" /> Reschedule
              </button>
            )}
          </div>
        )}

        {/* Reschedule modal */}
        {showReschedule && (
          <RescheduleModal
            appointment={appt}
            onClose={() => setShowReschedule(false)}
            onSuccess={() => { setShowReschedule(false); onReschedule?.(); }}
          />
        )}
      </div>
    </div>
  );
}

export default AppointmentCard;
