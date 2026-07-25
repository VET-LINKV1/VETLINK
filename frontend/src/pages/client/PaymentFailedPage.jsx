import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { paymentService } from '../../services/paymentService';
import { XCircle, ArrowRight, Loader2 } from 'lucide-react';

export default function PaymentFailedPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const appointmentId = searchParams.get('appointmentId');
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState('');

  const retry = async () => {
    if (!appointmentId) return;
    setRetrying(true); setError('');
    try {
      const result = await paymentService.createCheckoutSession(appointmentId);
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        navigate('/client/appointments');
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to retry payment.');
      setRetrying(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-white/10 p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-red-50 border-4 border-red-100 flex items-center justify-center mx-auto mb-5">
          <XCircle className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="font-display text-slate-800 dark:text-white text-2xl font-700 mb-1">Payment Cancelled</h2>
        <p className="text-slate-500 dark:text-slate-400 font-body text-sm">
          Your appointment is still pending. You can try again or pay later from your appointment list.
        </p>

        {appointmentId && (
          <p className="font-body text-slate-400 dark:text-slate-500 text-xs mt-4">
            Appointment ID: <span className="font-mono">{appointmentId}</span>
          </p>
        )}

        {error && (
          <p className="mt-3 text-red-500 text-xs font-body">{error}</p>
        )}

        <div className="flex gap-3 justify-center mt-7">
          {appointmentId && (
            <button onClick={retry} disabled={retrying}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-body font-600 text-sm hover:bg-blue-700 disabled:opacity-60 shadow-md shadow-blue-500/25 transition-colors">
              {retrying ? <><Loader2 className="w-4 h-4 animate-spin" /> Retrying…</> : <>Try Again <ArrowRight className="w-4 h-4" /></>}
            </button>
          )}
          <Link to="/client/appointments"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-body font-600 text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
            Back to Appointments
          </Link>
        </div>
      </div>
    </div>
  );
}
