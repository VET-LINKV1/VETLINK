/**
 * RefillRequestPanel.jsx
 *
 * Client view: shows the pet's active prescriptions with a one-click
 * "Request Refill" button, plus a list of past refill requests with
 * status pills.
 *
 * Props:
 *   activeRx      Array of prescriptions (from emrService or passport)
 *   myRequests    Array from postCareService.listMyRefills()
 *   onChange()    reload callback
 */
import { useState } from 'react';
import { RefreshCw, Pill, Clock, CheckCircle, XCircle, PackageCheck, Loader2, AlertCircle } from 'lucide-react';
import { postCareService } from '../../services/postCareService';

const STATUS = {
  pending:   { label: 'Pending',   tint: 'bg-amber-50 text-amber-700 border-amber-200',   Icon: Clock },
  approved:  { label: 'Approved',  tint: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle },
  denied:    { label: 'Denied',    tint: 'bg-red-50 text-red-700 border-red-200',         Icon: XCircle },
  dispensed: { label: 'Dispensed', tint: 'bg-blue-50 text-blue-700 border-blue-200',      Icon: PackageCheck },
  cancelled: { label: 'Cancelled', tint: 'bg-slate-100 text-slate-500 border-slate-200',  Icon: XCircle },
};

export default function RefillRequestPanel({ activeRx = [], myRequests = [], onChange }) {
  const [busy, setBusy] = useState(null);
  const [err, setErr]   = useState('');

  // Which prescriptions still have a pending request (block re-submit)
  const pendingMap = new Set(
    myRequests.filter(r => r.status === 'pending').map(r => r.prescription?.id)
  );

  const request = async (rxId) => {
    setErr(''); setBusy(rxId);
    try {
      await postCareService.requestRefill(rxId);
      onChange && onChange();
    } catch (e) {
      setErr(e?.response?.data?.error || 'Failed to request refill.');
    } finally { setBusy(null); }
  };

  const cancel = async (id) => {
    if (!confirm('Cancel this refill request?')) return;
    try { await postCareService.cancelRefill(id); onChange && onChange(); } catch (_) {}
  };

  const refillable = activeRx.filter(rx =>
    rx.status === 'active' && (rx.refills_used || 0) < (rx.refills_allowed || 0)
  );

  return (
    <div className="space-y-5">
      {err && (
        <p className="bg-red-50 border border-red-100 text-red-600 text-sm font-body px-3 py-2 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {err}
        </p>
      )}

      <section>
        <h3 className="text-xs font-body font-600 uppercase tracking-wider text-slate-500 mb-2">
          Active medications
        </h3>
        {refillable.length === 0 ? (
          <p className="text-sm text-slate-400 font-body italic">No refillable prescriptions on file.</p>
        ) : (
          <ul className="space-y-2">
            {refillable.map((rx) => {
              const pending = pendingMap.has(rx.id);
              const remaining = (rx.refills_allowed || 0) - (rx.refills_used || 0);
              return (
                <li key={rx.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                    <Pill className="w-4 h-4 text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-body font-600 text-slate-700 dark:text-slate-200 truncate">{rx.medication_name}</p>
                    <p className="text-xs font-body text-slate-500">
                      {rx.dosage} · {rx.frequency} · {remaining} refill{remaining === 1 ? '' : 's'} left
                    </p>
                  </div>
                  <button onClick={() => request(rx.id)} disabled={busy === rx.id || pending}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-body font-600 disabled:opacity-60
                      ${pending
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                    {busy === rx.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    {pending ? 'Awaiting clinic' : 'Request refill'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-xs font-body font-600 uppercase tracking-wider text-slate-500 mb-2">
          Refill history
        </h3>
        {myRequests.length === 0 ? (
          <p className="text-sm text-slate-400 font-body italic">No refill requests yet.</p>
        ) : (
          <ul className="space-y-2">
            {myRequests.map((r) => {
              const s = STATUS[r.status] || STATUS.pending;
              const Icon = s.Icon;
              return (
                <li key={r.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-xl p-3 flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${s.tint}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-body font-600 text-slate-700 dark:text-slate-200 truncate">
                        {r.prescription?.medication_name}
                      </p>
                      <span className={`text-[10px] font-body font-600 uppercase tracking-wider px-2 py-0.5 rounded-md border ${s.tint}`}>
                        {s.label}
                      </span>
                    </div>
                    <p className="text-xs font-body text-slate-500">
                      {r.pet?.name} · requested {new Date(r.requested_at).toLocaleString()}
                    </p>
                    {r.denial_reason && (
                      <p className="text-xs text-red-600 font-body mt-1 italic">"{r.denial_reason}"</p>
                    )}
                    {r.pickup_ready_at && (
                      <p className="text-xs text-emerald-700 font-body mt-1">
                        Ready: {new Date(r.pickup_ready_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  {r.status === 'pending' && (
                    <button onClick={() => cancel(r.id)}
                      className="text-xs font-body text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg">
                      Cancel
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
