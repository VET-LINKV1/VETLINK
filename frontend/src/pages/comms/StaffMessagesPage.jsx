/**
 * StaffMessagesPage.jsx
 * Two-pane inbox for staff: left = conversation list, right = active thread.
 */
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { commsService } from '../../services/commsService';
import { useConversation } from '../../hooks/useConversation';
import ConversationList from '../../components/comms/ConversationList';
import MessageBubble    from '../../components/comms/MessageBubble';
import ChatComposer     from '../../components/comms/ChatComposer';
import { MessageCircle, Loader2, User } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';

export default function StaffMessagesPage() {
  const { user } = useAuth();
  const [convs, setConvs] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError]     = useState('');
  const [activeId, setActive]         = useState(null);

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

  // Live-update inbox row when a new message hits any conversation.
  useEffect(() => {
    const chan = supabase
      .channel('staff-inbox')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'conversations',
      }, () => { loadList(); })
      .subscribe();
    return () => { try { supabase.removeChannel(chan); } catch (_) {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    catch (e) { console.error('[StaffMessages] send failed', e?.response?.data || e); }
  };
  const handleAttach = async (file) => {
    setUploading(true); setProgress(0);
    try { await uploadAttachment(file, {}, setProgress); }
    catch (e) { console.error('[StaffMessages] upload failed', e?.response?.data || e); }
    finally { setUploading(false); setProgress(0); }
  };

  return (
    <div className="h-full flex flex-col gap-3">
      <div>
        <h1 className="font-display font-700 text-xl text-slate-800 dark:text-white flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-blue-600" /> Client Messages
        </h1>
        <p className="text-xs font-body text-slate-400">Two-way secure chat with clients.</p>
      </div>

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
    </div>
  );
}
