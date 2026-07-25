/**
 * useConversation.js
 *
 * React hook that loads a conversation + its messages and subscribes
 * to Supabase Realtime for INSERT events on `messages` and
 * `message_attachments` rows scoped to that conversation.
 *
 * Returns:
 *   { conversation, messages, loading, error,
 *     send, uploadAttachment, markRead, reload }
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { commsService } from '../services/commsService';

export function useConversation(conversationId) {
  const [conversation, setConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  // We keep the live channel in a ref so cleanup can unsubscribe properly.
  const chanRef = useRef(null);

  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await commsService.getConversation(conversationId);
      setConv(data.conversation);
      setMessages(data.messages || []);
      try { await commsService.markRead(data.conversation.id); } catch (_) {}
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load conversation.');
    } finally { setLoading(false); }
  }, [conversationId]);

  useEffect(() => { if (conversationId) reload(); }, [conversationId, reload]);

  // Realtime subscription: new messages + their attachments.
  useEffect(() => {
    if (!conversation?.id) return;

    const chan = supabase
      .channel(`conv:${conversation.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversation.id}`,
      }, async (payload) => {
        const m = payload.new;
        // Avoid duplicating echoes from our own send (which already inserted via REST)
        setMessages((prev) => prev.some(x => x.id === m.id) ? prev : [...prev, { ...m, attachments: [] }]);
        // Mark read if it's incoming to us
        try { commsService.markRead(conversation.id); } catch (_) {}
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'message_attachments',
      }, (payload) => {
        const att = payload.new;
        setMessages((prev) => prev.map(m =>
          m.id === att.message_id
            ? { ...m, attachments: [...(m.attachments || []), att] }
            : m
        ));
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversation.id}`,
      }, (payload) => {
        const m = payload.new;
        setMessages((prev) => prev.map(x => x.id === m.id ? { ...x, ...m } : x).filter(x => !x.is_deleted));
      })
      .subscribe();

    chanRef.current = chan;
    return () => { try { supabase.removeChannel(chan); } catch (_) {} };
  }, [conversation?.id]);

  const send = useCallback(async (payload) => {
    const msg = await commsService.sendMessage({
      conversationId: conversation?.id,
      ...payload,
    });
    setMessages((prev) => prev.some(x => x.id === msg.id) ? prev : [...prev, msg]);
    return msg;
  }, [conversation?.id]);

  const uploadAttachment = useCallback(async (file, meta = {}, onProgress) => {
    const att = await commsService.uploadAttachment(file, {
      conversationId: conversation?.id,
      ...meta,
    }, onProgress);
    return att;
  }, [conversation?.id]);

  const markRead = useCallback(async () => {
    if (!conversation?.id) return;
    try { await commsService.markRead(conversation.id); } catch (_) {}
  }, [conversation?.id]);

  return { conversation, messages, loading, error, send, uploadAttachment, markRead, reload };
}
