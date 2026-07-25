/**
 * CommunicationsPage.jsx
 * Unified Communications Hub — Messages + Telehealth in one page.
 * Two tabs:
 *   1. Messages — two-pane inbox for client chat
 *   2. Telehealth — video consultation list + scheduling
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { commsService } from '../../services/commsService';
import { useConversation } from '../../hooks/useConversation';
import ConversationList from '../../components/comms/ConversationList';
import MessageBubble    from '../../components/comms/MessageBubble';
import ChatComposer     from '../../components/comms/ChatComposer';
import {
  MessageCircle, Video, Loader2, User, Clock,
  CheckCircle2, XCircle, Plus, Phone, Mail,
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';

const TABS = [
  { key: 'messages',     label: 'Messages',   icon: MessageCircle },
  { key: 'telehealth',   label: 'Telehealth', icon: Video },
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

export default function CommunicationsPage() {
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
        <p className="text-xs font-body text-slate-400">Client messages and video consultations in one place.</p>
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
        {activeTab === 'messages' && <MessagesTab user={user} />}
        {activeTab === 'telehealth' && <TelehealthTab navigate={navigate} />}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   MESSAGES TAB — two-pane inbox
   ═══════════════════════════════════════════════════════════════ */

function MessagesTab({ user }) {
  const [convs, setConvs]           = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError]   = useState('');
  const [activeId, setActive]       = useState(null);

  const loadList = async () => {
    setListLoading(true); setListError('');
    try {
      const data = await commsService.listConversations();
      setConvs(data || []);
      if (!activeId && data?.length) setActive(data[0].id);
    } catch (e) {
      setListError(e?.response?.data?.error || 'Failed to load inbox.');
    } finally { setListLoading(false); }
  };

  useEffect(() => { loadList(); }, []);

  // Live-update inbox row
  useEffect(() => {
    const chan = supabase
      .channel('comms-inbox')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'conversations',
      }, () => { loadList(); })
      .subscribe();
    return () => { try { supabase.removeChannel(chan); } catch (_) {} };
    // eslint-disable-next-line
  }, []);

  const {
    conversation, messages, loading, error,
    send, uploadAttachment,
  } = useConversation(activeId);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState(0);
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeId]);

  const handleSend = async (text) => {
    try { await send({ body: text }); }
    catch (e) { console.error('[Comms] send failed', e?.response?.data || e); }
  };
  const handleAttach = async (file) => {
    setUploading(true); setProgress(0);
    try { await uploadAttachment(file, {}, setProgress); }
    catch (e) { console.error('[Comms] upload failed', e?.response?.data || e); }
    finally { setUploading(false); setProgress(0); }
  };

  return (
    <div className="flex-1 grid grid-cols-1 md:grid-cols-[20rem_1fr] gap-3 min-h-0">
      {/* Left: inbox */}
      <div className="min-h-0">
        {listLoading ? (
          <div className="h-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : listError ? (
          <div className="h-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl flex items-center justify-center px-4">
            <p className="text-sm text-red-600 text-center">{listError}</p>
          </div>
        ) : (
          <ConversationList
            items={convs}
            selectedId={activeId}
            onSelect={(c) => setActive(c.id)}
          />
        )}
      </div>

      {/* Right: thread */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl flex flex-col overflow-hidden min-h-0">
        {!activeId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <MessageCircle className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm font-body">Select a conversation to start.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 dark:border-white/10 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-display font-700 text-slate-800 dark:text-white truncate">
                  {conversation?.client_name || conversation?.client_email || 'Conversation'}
                </p>
                {conversation?.client_email && (
                  <p className="text-[11px] font-body text-slate-400 truncate">{conversation.client_email}</p>
                )}
              </div>
            </div>

            {/* Stream */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 scrollbar-thin">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : error ? (
                <p className="text-sm text-red-600 text-center py-8 font-body">{error}</p>
              ) : !messages.length ? (
                <p className="text-sm text-slate-400 text-center py-8 font-body">No messages yet.</p>
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
              placeholder="Reply to client…"
            />
          </>
        )}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   TELEHEALTH TAB — consultation list
   ═══════════════════════════════════════════════════════════════ */

function TelehealthTab({ navigate }) {
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

      {/* Consultation list */}
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
                      {c.client_name && (
                        <span className="flex items-center gap-1 truncate">
                          <User className="w-3 h-3" /> {c.client_name}
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
