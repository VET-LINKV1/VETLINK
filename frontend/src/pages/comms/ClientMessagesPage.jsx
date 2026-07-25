/**
 * ClientMessagesPage.jsx
 * Single-pane chat for the client. The backend resolves to the
 * client's own conversation thread on first message.
 */
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { commsService } from '../../services/commsService';
import { useConversation } from '../../hooks/useConversation';
import MessageBubble from '../../components/comms/MessageBubble';
import ChatComposer  from '../../components/comms/ChatComposer';
import { MessageCircle, Loader2 } from 'lucide-react';

export default function ClientMessagesPage() {
  const { user } = useAuth();
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
        } else {
          // No conversation yet — send a silent "open thread" placeholder
          // via getOrCreate by posting an empty system-friendly message later.
          // For now we just stay in "no conv" state and let the composer
          // create it on first send.
          setConvId(null);
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
      // If there's no conv yet, the backend will create one for this client.
      const msg = await send({ body: text });
      if (!convId && msg?.conversation_id) setConvId(msg.conversation_id);
    } catch (e) {
      console.error('[ClientMessages] send failed', e?.response?.data || e);
    }
  };
  const handleAttach = async (file) => {
    setUploading(true); setProgress(0);
    try {
      const att = await uploadAttachment(file, {}, setProgress);
      if (!convId && att?.conversation_id) setConvId(att.conversation_id);
    } catch (e) {
      console.error('[ClientMessages] upload failed', e?.response?.data || e);
    } finally {
      setUploading(false); setProgress(0);
    }
  };

  return (
    <div className="h-full flex flex-col gap-3">
      <div>
        <h1 className="font-display font-700 text-xl text-slate-800 dark:text-white flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-blue-600" /> Messages
        </h1>
        <p className="text-xs font-body text-slate-400">Chat directly with the clinic team.</p>
      </div>

      <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl flex flex-col overflow-hidden">
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
    </div>
  );
}
