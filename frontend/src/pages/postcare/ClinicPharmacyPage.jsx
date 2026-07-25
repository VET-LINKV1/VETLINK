/**
 * ClinicPharmacyPage.jsx
 *
 * Clinic-side pharmacy queue. Lists refill requests and lets
 * staff/admin/vet approve, deny, or mark dispensed.
 *
 * Mounted at /pharmacy.
 */
import { useEffect, useState, useCallback } from 'react';
import {
  Pill, RefreshCw, CheckCircle, XCircle, PackageCheck, Loader2, AlertCircle,
  User, Phone, Mail, Clock, Send, Zap,
} from 'lucide-react';
import { postCareService } from '../../services/postCareService';

const STATUSES = [
  { key: 'pending',   label: 'Pending'   },
  { key: 'approved',  label: 'Approved'  },
  { key: 'dispensed', label: 'Dispensed' },
  { key: 'denied',    label: 'Denied'    },
];

export default function ClinicPharmacyPage() {
  const [tab, setTab]       = useState('pending');
  const [rows, setRows]     = useState([]);
  const [loading, setL]     = useState(true);
  const [busy, setBusy]     = useState(null);
  const [err, setErr]       = useState('');
  const [counts, setCounts] = useState({ pending: 0, approved: 0 });
  const [denying, setDenying] = useState(null);
  const [denialReason, setDR] = useState('');

  const load = useCallback(async () => {
    setL(true); setErr('');
    try {
      const [list, pendingList, approvedList] = await Promise.all([
        postCareService.listPharmacyQueue(tab),
        postCareService.listPharmacyQueue('pending'),
        postCareService.listPharmacyQueue('approved'),
      ]);
      setRows(list || []);
      setCounts({ pending: pendingList?.length || 0, approved: approvedList?.length || 0 });
    } catch (e) {
      setErr(e?.response?.data?.error || 'Failed to load pharmacy queue.');
    } finally { setL(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id) => {
    setBusy(id);
    try { await postCareService.approveRefill(id, null); await load(); }
    catch (e) { alert(e?.response?.data?.error || 'Failed.'); }
    finally { setBusy(null); }
  };
  const dispense = async (id) => {
    setBusy(id);
    try { await postCareService.dispenseRefill(id); await load(); }
    catch (e) { alert(e?.response?.data?.error || 'Failed.'); }
    finally { setBusy(null); }
  };
  const confirmDeny = async () => {
    if (!denying || !denialReason.trim()) return;
    setBusy(denying);
    try {
      await postCareService.denyRefill(denying, denialReason.trim());
      setDenying(null); setDR('');
      await load();
    } catch (e) { alert(e?.response?.data?.error || 'Failed.'); }
    finally { setBusy(null); }
  };

  const tick = async () => {
    try {
      const res = await postCareService.tickReminders();
      alert(`Tick: ${res.dispatched} reminder(s) dispatched out of ${res.processed} due.`);
    } catch (e) { alert(e?.response?.data?.error || 'Failed.'); }
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-slate-800 dark:text-white text-2xl font-700">Pharmacy Queue</h1>
          <p className="text-slate-400 font-body text-sm mt-0.5">
            Approve refill requests and trigger medication reminders.
          </p>
        </div>
        <button onClick={tick}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-body font-600 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200">
          <Zap className="w-4 h-4" /> Run reminder tick
        </button>
      </header>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile label="Pending"   value={counts.pending}  tone="amber" />
        <Tile label="Approved"  value={counts.approved} tone="emerald" />
        <Tile label="Current view" value={rows.length}  tone="slate" />
        <Tile label="Status filter" value={tab}         tone="blue" />
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 p-1 flex flex-wrap gap-1">
        {STATUSES.map((s) => (
          <button key={s.key} onClick={() => setTab(s.key)}
            className={`px-3 py-2 rounded-xl text-sm font-body font-600 transition-colors
              ${tab === s.key
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {err && (
        <p className="bg-red-50 border border-red-100 text-red-600 text-sm font-body px-3 py-2 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {err}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
      ) : !rows.length ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center">
          <Pill className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-body">No {tab} requests.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                  <Pill className="w-4 h-4 text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-body font-700 text-slate-700 dark:text-slate-200">
                    {r.prescription?.medication_name}
                    <span className="text-xs font-body font-500 text-slate-500 ml-2">
                      {r.prescription?.dosage} · {r.prescription?.frequency}
                    </span>
                  </p>
                  <p className="text-xs font-body text-slate-500 mt-1">
                    Pet: <b className="text-slate-700 dark:text-slate-200">{r.pet?.name}</b> ({r.pet?.species})
                  </p>
                  <p className="text-xs font-body text-slate-500 mt-1">
                    Refills used: {r.prescription?.refills_used}/{r.prescription?.refills_allowed}
                  </p>
                  {r.notes && <p className="text-xs italic text-slate-600 dark:text-slate-300 mt-2">"{r.notes}"</p>}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-xs font-body text-slate-500">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> {r.requester?.name}</span>
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {r.requester?.email}</span>
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {r.requester?.phone_number}</span>
                  </div>
                  <p className="text-[10px] font-body uppercase tracking-wider text-slate-400 mt-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Requested {new Date(r.requested_at).toLocaleString()}
                  </p>
                </div>

                {tab === 'pending' && (
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button onClick={() => approve(r.id)} disabled={busy === r.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-body font-600 disabled:opacity-50">
                      {busy === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      Approve
                    </button>
                    <button onClick={() => { setDenying(r.id); setDR(''); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-body font-600 border border-red-200">
                      <XCircle className="w-3.5 h-3.5" /> Deny
                    </button>
                  </div>
                )}

                {tab === 'approved' && (
                  <button onClick={() => dispense(r.id)} disabled={busy === r.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-body font-600 disabled:opacity-50 shrink-0">
                    {busy === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PackageCheck className="w-3.5 h-3.5" />}
                    Mark dispensed
                  </button>
                )}
              </div>

              {tab === 'denied' && r.denial_reason && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5 mt-3 italic">
                  "{r.denial_reason}"
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Deny modal */}
      {denying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
          onClick={() => setDenying(null)}>
          <div onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-5">
            <p className="font-display text-slate-800 dark:text-white font-700 mb-2">Deny refill request</p>
            <p className="text-sm text-slate-500 font-body mb-3">
              The owner will see this reason. Be specific.
            </p>
            <textarea rows={3} value={denialReason} onChange={(e) => setDR(e.target.value)}
              placeholder="e.g. Pet must be re-examined before another refill is issued."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-body bg-white" />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setDenying(null)}
                className="px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-100 text-sm font-body">Cancel</button>
              <button onClick={confirmDeny} disabled={!denialReason.trim() || busy === denying}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-body font-600 disabled:opacity-50">
                {busy === denying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send denial
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, tone }) {
  const tones = {
    slate:   'bg-slate-50 text-slate-700 border-slate-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber:   'bg-amber-50 text-amber-700 border-amber-200',
    blue:    'bg-blue-50 text-blue-700 border-blue-200',
  };
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${tones[tone] || tones.slate}`}>
      <p className="text-[10px] uppercase tracking-wider font-body font-600 opacity-70">{label}</p>
      <p className="font-display text-2xl font-700 mt-0.5 capitalize">{value}</p>
    </div>
  );
}
