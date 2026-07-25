/**
 * TelehealthPage.jsx
 * Active video consultation room. Path: /telehealth/:id
 *
 * Lifecycle:
 *   on mount:    POST /comms/consultations/:id/join → returns meeting_url + status
 *   while live:  embeds Jitsi iframe
 *   on end:      POST /comms/consultations/:id/end → records duration + status
 *   vets only:   notes editor renders alongside (or after) the call
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { commsService } from '../../services/commsService';
import JitsiEmbed from '../../components/comms/JitsiEmbed';
import ConsultationNotesEditor from '../../components/comms/ConsultationNotesEditor';
import { Loader2, Video, Clock, CheckCircle2, ArrowLeft, AlertTriangle } from 'lucide-react';

function statusPill(s) {
  const map = {
    scheduled:    'bg-slate-100 text-slate-600',
    waiting:      'bg-amber-100 text-amber-700',
    in_progress:  'bg-emerald-100 text-emerald-700',
    completed:    'bg-blue-100 text-blue-700',
    cancelled:    'bg-red-100 text-red-700',
    no_show:      'bg-red-100 text-red-700',
  };
  return map[s] || 'bg-slate-100 text-slate-600';
}

export default function TelehealthPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isVet, isAdmin } = useAuth();
  const canTakeNotes = isVet || isAdmin;

  const [data, setData]       = useState(null);   // { consultation, meeting_url, ... }
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [ending, setEnding]   = useState(false);
  const [error, setError]     = useState('');
  const [done, setDone]       = useState(false);

  const fetchConsult = async () => {
    try {
      const c = await commsService.getConsultation(id);
      setData((prev) => ({ ...(prev || {}), consultation: c }));
      if (c?.status === 'completed' || c?.status === 'cancelled' || c?.status === 'no_show') {
        setDone(true);
      }
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not load consultation.');
    }
  };

  const join = async () => {
    setJoining(true); setError('');
    try {
      const res = await commsService.joinConsultation(id);
      setData(res);   // { consultation, meeting_url, ... }
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not join the room.');
    } finally { setJoining(false); }
  };

  const end = async () => {
    if (!window.confirm('End the call?')) return;
    setEnding(true);
    try {
      const res = await commsService.endConsultation(id);
      setData((prev) => ({ ...(prev || {}), consultation: res }));
      setDone(true);
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not end the call.');
    } finally { setEnding(false); }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      setLoading(true);
      await fetchConsult();
      // Auto-join if currently scheduled / waiting / in_progress
      try {
        const c = await commsService.getConsultation(id);
        if (alive && ['scheduled','waiting','in_progress'].includes(c?.status)) {
          await join();
        }
      } catch (_) {}
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const c = data?.consultation;
  const meetingUrl = data?.meeting_url;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error && !c) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-4">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <p className="text-sm font-body text-slate-600 dark:text-slate-300">{error}</p>
        <button onClick={() => navigate(-1)} className="text-sm font-body text-blue-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h1 className="font-display font-700 text-lg text-slate-800 dark:text-white flex items-center gap-2 truncate">
              <Video className="w-5 h-5 text-blue-600" /> Telehealth
            </h1>
            <p className="text-xs font-body text-slate-400 truncate">
              {c?.subject || 'Video consultation'} · room {c?.room_name || '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-body font-700 uppercase tracking-wider px-2 py-1 rounded-full ${statusPill(c?.status)}`}>
            {c?.status || '—'}
          </span>
          {c?.scheduled_at && (
            <span className="text-[11px] font-body text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {new Date(c.scheduled_at).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-xs font-body">
          {error}
        </div>
      )}

      {/* Body */}
      {done ? (
        <CompletedState consultation={c} canTakeNotes={canTakeNotes} />
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-3 min-h-0">
          {/* Video frame */}
          <div className="min-h-[16rem] lg:min-h-0 relative">
            {meetingUrl ? (
              <JitsiEmbed
                url={meetingUrl}
                displayName={user?.name || user?.email || 'Participant'}
                subject={c?.subject || 'VETLINK consultation'}
                onClose={end}
              />
            ) : (
              <div className="h-full rounded-2xl border border-dashed border-slate-200 dark:border-white/10 flex flex-col items-center justify-center text-center px-6 gap-3">
                <Video className="w-8 h-8 text-slate-400" />
                <p className="text-sm font-body text-slate-500 dark:text-slate-400">
                  {joining ? 'Connecting to the room…' : 'Ready to join when you are.'}
                </p>
                <button onClick={join} disabled={joining}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-body font-600 flex items-center gap-2 disabled:opacity-40">
                  {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
                  {joining ? 'Joining…' : 'Join now'}
                </button>
              </div>
            )}
          </div>

          {/* Side panel */}
          <div className="flex flex-col gap-3 min-h-0 overflow-y-auto scrollbar-thin">
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl p-4">
              <p className="text-xs font-body font-600 uppercase tracking-wider text-slate-400 mb-2">Session</p>
              <dl className="text-xs font-body space-y-1.5 text-slate-600 dark:text-slate-300">
                <div className="flex justify-between gap-2"><dt className="text-slate-400">Status</dt><dd>{c?.status}</dd></div>
                {c?.scheduled_at && <div className="flex justify-between gap-2"><dt className="text-slate-400">Scheduled</dt><dd>{new Date(c.scheduled_at).toLocaleString()}</dd></div>}
                {c?.started_at  && <div className="flex justify-between gap-2"><dt className="text-slate-400">Started</dt><dd>{new Date(c.started_at).toLocaleString()}</dd></div>}
                {c?.client_name && <div className="flex justify-between gap-2"><dt className="text-slate-400">Client</dt><dd className="truncate">{c.client_name}</dd></div>}
                {c?.veterinarian_name && <div className="flex justify-between gap-2"><dt className="text-slate-400">Vet</dt><dd className="truncate">{c.veterinarian_name}</dd></div>}
              </dl>
              {meetingUrl && (
                <button onClick={end} disabled={ending}
                  className="mt-3 w-full px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-body font-600 flex items-center justify-center gap-1.5 disabled:opacity-40">
                  {ending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {ending ? 'Ending…' : 'End consultation'}
                </button>
              )}
            </div>

            {canTakeNotes && c?.id && (
              <ConsultationNotesEditor
                consultationId={c.id}
                initial={c.notes || {}}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CompletedState({ consultation: c, canTakeNotes }) {
  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-3 min-h-0">
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-2 min-h-[16rem]">
        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        <h2 className="font-display font-700 text-lg text-slate-800 dark:text-white">Consultation ended</h2>
        {c?.duration_sec
          ? <p className="text-sm font-body text-slate-500 dark:text-slate-400">Duration: {Math.round(c.duration_sec / 60)} min</p>
          : <p className="text-sm font-body text-slate-400">Thanks — the room has been closed.</p>}
      </div>

      <div className="flex flex-col gap-3 min-h-0 overflow-y-auto scrollbar-thin">
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl p-4">
          <p className="text-xs font-body font-600 uppercase tracking-wider text-slate-400 mb-2">Session</p>
          <dl className="text-xs font-body space-y-1.5 text-slate-600 dark:text-slate-300">
            <div className="flex justify-between"><dt className="text-slate-400">Status</dt><dd>{c?.status}</dd></div>
            {c?.started_at && <div className="flex justify-between"><dt className="text-slate-400">Started</dt><dd>{new Date(c.started_at).toLocaleString()}</dd></div>}
            {c?.ended_at   && <div className="flex justify-between"><dt className="text-slate-400">Ended</dt><dd>{new Date(c.ended_at).toLocaleString()}</dd></div>}
            {c?.duration_sec != null && <div className="flex justify-between"><dt className="text-slate-400">Duration</dt><dd>{Math.round(c.duration_sec / 60)}m</dd></div>}
          </dl>
        </div>

        {canTakeNotes && c?.id && (
          <ConsultationNotesEditor
            consultationId={c.id}
            initial={c.notes || {}}
          />
        )}
      </div>
    </div>
  );
}
