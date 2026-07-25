/**
 * IntakeSubmitPage.jsx
 *
 * Client (or staff) submits / edits the pre-visit intake form for
 * a specific appointment. Mounted at /intake/:appointmentId.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Loader2, Check, AlertCircle } from 'lucide-react';
import { bookingService } from '../../services/bookingService';
import IntakeForm from '../../components/booking/IntakeForm';

export default function IntakeSubmitPage() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();

  const [intake, setIntake]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');
  const [submitting, setSub]    = useState(false);
  const [done, setDone]         = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await bookingService.getIntake(appointmentId);
        if (!cancelled) setIntake(data);
      } catch (e) {
        if (!cancelled) setErr(e?.response?.data?.error || 'Could not load intake.');
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [appointmentId]);

  const submit = async (payload) => {
    setSub(true); setErr('');
    try {
      await bookingService.submitIntake(payload);
      setDone(true);
    } catch (e) {
      setErr(e?.response?.data?.error || 'Failed to submit intake.');
    } finally { setSub(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>;
  }

  if (done) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="rounded-2xl p-6 text-center text-white bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg">
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mx-auto mb-3">
            <Check className="w-7 h-7" />
          </div>
          <p className="font-display text-2xl font-700">Intake submitted</p>
          <p className="text-sm opacity-90 mt-1">Your vet will review it before the visit.</p>
        </div>
        <div className="mt-4 flex justify-center">
          <button onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-body font-600">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
            <ClipboardList className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h1 className="font-display text-slate-800 dark:text-white text-xl font-700">Pre-visit intake</h1>
            <p className="text-xs text-slate-400 font-body">
              Helps the vet prepare. Takes about 2 minutes.
            </p>
          </div>
        </div>
      </div>

      {err && (
        <p className="bg-red-50 border border-red-100 text-red-600 text-sm font-body px-3 py-2 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {err}
        </p>
      )}

      <IntakeForm
        appointmentId={appointmentId}
        initial={intake}
        submitting={submitting}
        onSubmit={submit}
      />
    </div>
  );
}
