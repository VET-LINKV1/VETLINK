import { Calendar, Clock, PawPrint, Stethoscope, XCircle, CheckCircle, AlertCircle, Ban } from 'lucide-react';
import PayNowButton from './PayNowButton';

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-600',
    label: 'Pending',
    dot: 'bg-amber-400',
  },
  confirmed: {
    icon: CheckCircle,
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-600',
    label: 'Confirmed',
    dot: 'bg-blue-500',
  },
  completed: {
    icon: CheckCircle,
    bg: 'bg-slate-100',
    border: 'border-slate-200',
    text: 'text-slate-500',
    label: 'Completed',
    dot: 'bg-slate-400',
  },
  cancelled: {
    icon: Ban,
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-400',
    label: 'Cancelled',
    dot: 'bg-red-400',
  },
};

function AppointmentCard({ appointment, onCancel, onPay }) {
  const cfg = STATUS_CONFIG[appointment.status] || STATUS_CONFIG.pending;
  const StatusIcon = cfg.icon;
  const canCancel = appointment.status === 'pending';

  // Show Pay button if appointment is unpaid/pending payment AND not already paid
  const canPay = appointment.payment_status === 'unpaid' || appointment.payment_status === 'pending' || appointment.payment_status === 'failed';

  const formatDate = (iso) => {
    if (!iso) return 'Date TBD';
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className={`bg-white rounded-2xl border ${canCancel ? 'border-slate-100' : 'border-slate-100'} shadow-card hover:shadow-card-hover transition-shadow p-5`}>
      <div className="flex items-start justify-between gap-4">
        {/* Left — icon + details */}
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            {/* Pet + service */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="font-display text-slate-800 font-600 text-sm">
                {appointment.pets?.name || 'Pet'}
              </p>
              <span className="text-slate-300 text-xs">·</span>
              <p className="text-slate-500 text-sm font-body">{appointment.type}</p>
            </div>

            {/* Date + time */}
            <div className="flex items-center gap-3 text-xs font-body text-slate-400 mb-2">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(appointment.appointment_at)}
              </span>
              {appointment.appointment_at && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTime(appointment.appointment_at)}
                </span>
              )}
            </div>

            {/* Notes */}
            {appointment.notes && (
              <p className="text-xs font-body text-slate-400 bg-slate-50 rounded-lg px-2.5 py-1.5 max-w-xs truncate">
                {appointment.notes}
              </p>
            )}
          </div>
        </div>

        {/* Right — status + cancel */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`inline-flex items-center gap-1.5 text-xs font-body font-600 px-2.5 py-1 rounded-lg border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>

          {canCancel && (
            <button
              onClick={() => onCancel(appointment.id)}
              className="flex items-center gap-1 text-xs font-body text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              Cancel
            </button>
          )}

          {canPay && onPay && (
            <PayNowButton appointment={appointment} onSuccess={onPay} />
          )}
        </div>
      </div>
    </div>
  );
}

export default AppointmentCard;
