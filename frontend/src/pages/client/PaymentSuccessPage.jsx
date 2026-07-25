/**
 * PaymentSuccessPage.jsx
 * User lands here after PayMongo Checkout. We poll /payments/status?reconcile=true
 * which asks PayMongo for the latest state if no webhook has marked it paid yet.
 */
import { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { paymentService } from '../../services/paymentService';
import { CheckCircle, Loader2, AlertCircle, ArrowRight, Receipt } from 'lucide-react';

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_MS      = 30000;

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const appointmentId = searchParams.get('appointmentId');

  const [state, setState] = useState({ loading: true, status: null, payment: null, appointment: null, error: '' });
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (!appointmentId) {
      setState({ loading: false, error: 'Missing appointment reference.' });
      return;
    }

    let cancelled = false;
    let timer = null;

    const poll = async () => {
      try {
        const r = await paymentService.getStatus(appointmentId, { reconcile: true });
        if (cancelled) return;
        setState({
          loading: false,
          status:  r.paymentStatus,
          payment: r.payment,
          appointment: r.appointment,
          error: '',
        });
        const elapsed = Date.now() - startedAt.current;
        const isFinal = r.paymentStatus === 'paid' || r.paymentStatus === 'failed';
        if (!isFinal && elapsed < MAX_POLL_MS) {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (cancelled) return;
        setState({ loading: false, error: err?.response?.data?.error || 'Failed to load payment status.' });
      }
    };
    poll();

    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [appointmentId]);

  const { loading, status, payment, appointment, error } = state;
  const isPaid = status === 'paid';

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-white/10 p-8">

        {loading && (
          <div className="text-center py-10">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
            <h2 className="font-display text-slate-800 dark:text-white text-xl font-700">Confirming your payment…</h2>
            <p className="text-slate-400 dark:text-slate-500 font-body text-sm mt-2">
              This usually takes a few seconds.
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-10">
            <div className="w-16 h-16 rounded-full bg-red-50 border-4 border-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="font-display text-slate-800 dark:text-white text-xl font-700 mb-1">We couldn't load this payment</h2>
            <p className="text-slate-500 dark:text-slate-400 font-body text-sm mt-2">{error}</p>
            <Link to="/client/appointments"
              className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-body font-600 text-sm hover:bg-blue-700 transition-colors">
              Back to Appointments <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {!loading && !error && (
          <div className="text-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 ${
              isPaid
                ? 'bg-blue-50 border-4 border-blue-100'
                : 'bg-amber-50 border-4 border-amber-100'
            }`}>
              {isPaid
                ? <CheckCircle className="w-10 h-10 text-blue-600" />
                : <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />}
            </div>

            <h2 className="font-display text-slate-800 dark:text-white text-2xl font-700 mb-1">
              {isPaid ? 'Payment Successful!' : 'Payment Pending'}
            </h2>
            <p className="text-slate-400 dark:text-slate-500 font-body text-sm">
              {isPaid
                ? 'Your appointment has been confirmed.'
                : 'We received your payment but it’s still confirming. You can safely close this page — we’ll notify you.'}
            </p>

            {/* Receipt */}
            <div className="mt-7 text-left rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 p-5 space-y-3">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 mb-1">
                <Receipt className="w-4 h-4" />
                <p className="font-display font-700 text-sm">Receipt</p>
              </div>
              <Row label="Appointment ID" value={appointmentId} mono />
              {appointment?.service && <Row label="Service"        value={appointment.service} />}
              {payment?.amount &&     <Row label="Amount"         value={'₱' + (payment.amount / 100).toFixed(2)} />}
              {payment?.payment_method && <Row label="Method"     value={payment.payment_method} />}
              {payment?.transaction_id && <Row label="Transaction" value={payment.transaction_id} mono />}
              <Row label="Status"
                value={isPaid ? 'PAID' : (status || 'pending').toUpperCase()}
                emphasis={isPaid ? 'good' : 'warn'} />
            </div>

            <div className="flex gap-3 justify-center mt-7">
              <Link to="/client/appointments"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-body font-600 text-sm hover:bg-blue-700 shadow-md shadow-blue-500/25 transition-colors">
                View My Appointments <ArrowRight className="w-4 h-4" />
              </Link>
              <button onClick={() => navigate('/client')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-body font-600 text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono = false, emphasis }) {
  const valueClass = [
    'text-sm font-body',
    mono ? 'font-mono text-xs' : '',
    emphasis === 'good' ? 'text-blue-600 dark:text-blue-300 font-700' :
    emphasis === 'warn' ? 'text-amber-600 dark:text-amber-300 font-700' :
                          'text-slate-800 dark:text-white font-500',
  ].join(' ');
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-slate-500 dark:text-slate-400 font-body">{label}</span>
      <span className={valueClass + ' text-right break-all'}>{value || '—'}</span>
    </div>
  );
}
