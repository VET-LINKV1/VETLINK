/**
 * VetIntakeReviewPage.jsx
 *
 * Vet-facing pre-visit dashboard. Shows the next N days of
 * appointments assigned to the logged-in vet (or all vets for
 * admins), grouped by day, with each appointment expandable to
 * reveal the submitted intake.
 *
 * Mounted at /vet/intake-review.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Loader2, Clock, PawPrint, User, ChevronDown, ChevronUp,
  Siren, AlertCircle, ClipboardList, Phone, Mail, XCircle,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { bookingService } from '../../services/bookingService';
import { appointmentService } from '../../services/appointmentService';
import IntakeSummary from '../../components/booking/IntakeSummary';

const URGENCY_PILL = {
  routine:   'bg-blue-50 text-blue-600 border-blue-200',
  standard:  'bg-slate-100 text-slate-600 border-slate-200',
  urgent:    'bg-amber-50 text-amber-600 border-amber-200',
  emergency: 'bg-red-50 text-red-700 border-red-200',
};

function dayKey(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: '2-digit', year: 'numeric' });
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function VetIntakeReviewPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]       = useState('');
  const [days, setDays]     = useState(7);
  const [open, setOpen]     = useState(() => new Set());
  const [declining, setDeclining] = useState(null); // appointment id being declined

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setErr('');
      try {
        const data = await bookingService.vetUpcoming(days);
        if (!cancelled) setRows(data || []);
      } catch (e) {
        if (!cancelled) setErr(e?.response?.data?.error || 'Failed to load upcoming.');
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [days]);

  const grouped = useMemo(() => {
    const byDay = {};
    for (const r of rows) {
      const k = dayKey(r.appointment_at);
      (byDay[k] = byDay[k] || []).push(r);
    }
    return byDay;
  }, [rows]);

  const toggle = (id) => setOpen((s) => {
    const next = new Set(s);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // Vet declines a pending booking
  const handleDecline = async (appointmentId) => {
    const reason = prompt('Reason for declining (optional):') ?? undefined;
    setDeclining(appointmentId);
    try {
      await appointmentService.updateStatus(appointmentId, 'declined', reason);
      // Remove from local list so it disappears from the vet's view
      setRows(prev => prev.filter(r => r.id !== appointmentId));
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to decline appointment.');
    } finally {
      setDeclining(null);
    }
  };

  const counts = useMemo(() => rows.reduce((acc, r) => {
    acc.total += 1;
    acc.withIntake += r.intake ? 1 : 0;
    if (r.urgency === 'emergency') acc.emergency += 1;
    if (r.urgency === 'urgent')    acc.urgent    += 1;
    return acc;
  }, { total: 0, withIntake: 0, emergency: 0, urgent: 0 }), [rows]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-slate-800 dark:text-white text-2xl font-700">Pre-visit dashboard</h1>
          <p className="text-slate-400 font-body text-sm mt-0.5">
            {user?.role === 'admin'
              ? 'Every upcoming appointment with intake-status visibility.'
              : 'Your upcoming appointments. Review intake before each visit.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {[3, 7, 14].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-body font-600 border transition-colors
                ${days === d
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile label="Upcoming"   value={counts.total}      tone="slate" />
        <Tile label="With intake" value={`${counts.withIntake}/${counts.total}`} tone="emerald" />
        <Tile label="Urgent"     value={counts.urgent}     tone="amber" />
        <Tile label="Emergency"  value={counts.emergency}  tone="red" />
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
          <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-body">No upcoming appointments in the next {days} days.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([day, items]) => (
            <section key={day}>
              <h2 className="text-xs font-body font-600 uppercase tracking-wider text-slate-400 mb-2">{day}</h2>
              <ul className="space-y-2">
                {items.map((r) => {
                  const isOpen = open.has(r.id);
                  const isEmer = r.urgency === 'emergency';
                  return (
                    <li key={r.id} className={`bg-white dark:bg-slate-900 rounded-xl border overflow-hidden
                      ${isEmer ? 'border-red-200 ring-2 ring-red-100' : 'border-slate-100 dark:border-white/10'}`}>
                      <button onClick={() => toggle(r.id)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-white/5 text-left">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                          ${isEmer ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                          {isEmer ? <Siren className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-body font-700 text-slate-700 dark:text-slate-200">{fmtTime(r.appointment_at)}</p>
                            <span className={`text-[10px] font-body font-600 uppercase tracking-wider px-2 py-0.5 rounded-md border ${URGENCY_PILL[r.urgency] || URGENCY_PILL.standard}`}>
                              {r.urgency}
                            </span>
                            <span className="text-xs font-body text-slate-500">{r.type}</span>
                            {r.intake ? (
                              <span className="text-[10px] font-body font-600 uppercase tracking-wider px-2 py-0.5 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700">
                                Intake submitted
                              </span>
                            ) : (
                              <span className="text-[10px] font-body font-600 uppercase tracking-wider px-2 py-0.5 rounded-md border border-slate-200 bg-slate-100 text-slate-500">
                                Awaiting intake
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 font-body truncate mt-0.5">
                            <PawPrint className="inline w-3 h-3 mr-1 text-slate-400" />
                            {r.pet?.name}
                            {r.pet?.species ? ` · ${r.pet.species}` : ''}
                            {r.pet?.breed ? ` · ${r.pet.breed}` : ''}
                            <User className="inline w-3 h-3 ml-2 mr-1 text-slate-400" />
                            {r.client?.name}
                          </p>
                        </div>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </button>

                      {isOpen && (
                        <div className="px-3 pb-3 space-y-3 border-t border-slate-100 dark:border-white/10 pt-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-body">
                            <Meta label="Owner"  value={r.client?.name} />
                            <Meta label="Email"  value={r.client?.email} icon={Mail} />
                            <Meta label="Phone"  value={r.client?.phone_number} icon={Phone} />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider font-body font-600 text-slate-400 mb-2">Intake</p>
                            <IntakeSummary intake={r.intake?.[0] || r.intake} />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => navigate(`/emr`)}
                              className="text-xs font-body font-600 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100">
                              Open EMR
                            </button>
                            {/* Decline button — only for pending appointments */}
                            {r.status === 'pending' && (
                              <button
                                onClick={() => handleDecline(r.id)}
                                disabled={declining === r.id}
                                className="text-xs font-body font-600 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 flex items-center gap-1.5 disabled:opacity-50">
                                {declining === r.id
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : <XCircle className="w-3 h-3" />}
                                Decline — cannot accommodate
                              </button>
                            )}
                            {!r.intake && (
                              <span className="text-xs font-body text-slate-400 italic flex items-center gap-1">
                                <ClipboardList className="w-3 h-3" /> Owner has not filled the intake yet.
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
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
    red:     'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${tones[tone] || tones.slate}`}>
      <p className="text-[10px] uppercase tracking-wider font-body font-600 opacity-70">{label}</p>
      <p className="font-display text-2xl font-700 mt-0.5">{value}</p>
    </div>
  );
}

function Meta({ label, value, icon: Icon }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-body font-600 text-slate-400">{label}</p>
      <p className="text-slate-700 dark:text-slate-200 truncate">
        {Icon && <Icon className="inline w-3 h-3 mr-1 text-slate-400" />}
        {value || '—'}
      </p>
    </div>
  );
}
