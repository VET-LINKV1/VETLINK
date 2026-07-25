/**
 * ClientCommunicationsPage.jsx
 * Unified Communications Hub for Clients — Messages + Telehealth in one page.
 * Two tabs:
 *   1. Messages — single-pane chat with the clinic
 *   2. Telehealth — video consultation list
 *
 * Mounted at /client/messages, /client/telehealth, and /client/communications
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { commsService } from '../../services/commsService';
import { useConversation } from '../../hooks/useConversation';
import MessageBubble from '../../components/comms/MessageBubble';
import ChatComposer  from '../../components/comms/ChatComposer';
import {
  MessageCircle, Video, Loader2, User, Clock,
  CheckCircle2, XCircle,
} from 'lucide-react';

const TABS = [
  { key: 'messages',     label: 'Messages',   icon: MessageCircle },
  { key: 'telehealth',   label: 'Video Consults', icon: Video },
];

const CONSULTATION_FILTERS = [
  { key: 'all',         label: 'All' },
  { key: 'scheduled',   label: 'Scheduled' },
  { key: 'in_progress', label: 'Live' },
  { key: 'completed',   label: 'Completed' },
];

function statusPill(s) {
  const map = {
    scheduled:    'bg-slate-100 text-slate-700',
    waiting:      'bg-amber-100 text-amber-700',
    in_progress:  'bg-emerald-100 text-emerald-700',
    completed:    'bg-blue-100 text-blue-700',
    cancelled:    'bg-red-100 text-red-700',
    no_show:      'bg-red-100 text-red-700',
  };
  return map[s] || 'bg-slate-100 text-slate-700';
}

export default function ClientCommunicationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() =>
    location.pathname.includes('/telehealth') ? 'telehealth' : 'messages'
  );

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Header */}
      <div>
        <h1 className="font-display font-700 text-xl text-slate-800 dark:text-white">
          Communications
        </h1>
        <p className="text-xs font-body text-slate-400">Chat with the clinic and manage video consultations.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-xl w-fit">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-body font-600 transition-all
                ${activeTab === t.key
                  ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        {activeTab === 'messages' && <ClientMessagesTab user={user} />}
        {activeTab === 'telehealth' && <ClientTelehealthTab navigate={navigate} />}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   MESSAGES TAB — single-pane chat for clients
   ═══════════════════════════════════════════════════════════════ */

function ClientMessagesTab({ user }) {
  const [convId, setConvId] = useState(null);
  const [bootstrapping, setBoot] = useState(true);
  const [bootError, setBootError] = useState('');

  // Resolve (or lazily create) the client's own conversation.
  useEffect(() => {
    let alive = true;
    (async () => {
      setBoot(true); setBootError('');
      try {
        const list = await commsService.listConversations();
        if (!alive) return;
        if (list && list.length) {
          setConvId(list[0].id);
        }
      } catch (e) {
        setBootError(e?.response?.data?.error || 'Could not load messages.');
      } finally {
        if (alive) setBoot(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const {
    conversation, messages, loading, error,
    send, uploadAttachment,
  } = useConversation(convId);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState(0);
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async (text) => {
    try {
      const msg = await send({ body: text });
      if (!convId && msg?.conversation_id) setConvId(msg.conversation_id);
    } catch (e) {
      console.error('[ClientComms] send failed', e?.response?.data || e);
    }
  };
  const handleAttach = async (file) => {
    setUploading(true); setProgress(0);
    try {
      const att = await uploadAttachment(file, {}, setProgress);
      if (!convId && att?.conversation_id) setConvId(att.conversation_id);
    } catch (e) {
      console.error('[ClientComms] upload failed', e?.response?.data || e);
    } finally {
      setUploading(false); setProgress(0);
    }
  };

  return (
    <div className="h-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 scrollbar-thin">
        {bootstrapping || loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : (bootError || error) ? (
          <p className="text-sm text-red-600 font-body text-center py-8">{bootError || error}</p>
        ) : !messages.length ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 text-slate-400">
            <MessageCircle className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm font-body">No messages yet. Say hi to your clinic 👋</p>
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              isMine={m.sender_id === user?.id}
            />
          ))
        )}
        <div ref={endRef} />
      </div>

      <ChatComposer
        onSend={handleSend}
        onAttach={handleAttach}
        uploading={uploading}
        progress={progress}
      />
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   TELEHEALTH TAB — consultation list (client view)
   ═══════════════════════════════════════════════════════════════ */

function ClientTelehealthTab({ navigate }) {
  const [items, setItems]   = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const data = await commsService.listConsultations({
        status: filter === 'all' ? undefined : filter,
        days:   60,
      });
      setItems(data || []);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load consultations.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter]);

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        {CONSULTATION_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-body font-600 transition-colors
              ${filter === f.key
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'}`}
          >{f.label}</button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : error ? (
          <p className="p-8 text-center text-sm text-red-600 font-body">{error}</p>
        ) : !items.length ? (
          <div className="p-10 text-center">
            <Video className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-body text-slate-400">No consultations to show.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-50 dark:divide-white/5">
            {items.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => navigate(`/telehealth/${c.id}`)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <Video className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-body font-600 text-slate-700 dark:text-slate-200 truncate flex-1">
                        {c.subject || 'Video consultation'}
                      </p>
                      <span className={`text-[10px] font-700 uppercase tracking-wider px-2 py-0.5 rounded-full ${statusPill(c.status)}`}>
                        {c.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] font-body text-slate-400">
                      {c.scheduled_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {new Date(c.scheduled_at).toLocaleString()}
                        </span>
                      )}
                      {c.veterinarian_name && (
                        <span className="truncate">Vet: {c.veterinarian_name}</span>
                      )}
                    </div>
                  </div>
                  {c.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                  {(c.status === 'cancelled' || c.status === 'no_show') && <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
