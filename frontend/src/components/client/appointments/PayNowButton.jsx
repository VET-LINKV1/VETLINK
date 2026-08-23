/**
 * PayNowButton.jsx
 * Reusable button that triggers a PayMongo checkout for a given appointment.
 * Calls backend /api/payments/create-checkout-session → redirects to PayMongo.
 */
import { useState } from 'react';
import { paymentService } from '../../../services/paymentService';
import { CreditCard, Loader2 } from 'lucide-react';

export default function PayNowButton({ appointment, onSuccess, label = 'Pay now', className = '' }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePay = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await paymentService.createCheckoutSession(appointment.id);

      // Free service short-circuit
      if (result.free) {
        if (onSuccess) onSuccess();
        return;
      }
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      throw new Error('Payment provider returned no checkout URL.');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to start payment.');
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handlePay}
        disabled={loading}
        className={
          'flex items-center gap-1.5 text-xs font-body font-600 text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-60 ' +
          className
        }
      >
        {loading
          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Redirecting…</>
          : <><CreditCard className="w-3.5 h-3.5" /> {label}</>}
      </button>
      {error && <p className="text-[11px] text-red-500 font-body mt-1">{error}</p>}
    </>
  );
}
