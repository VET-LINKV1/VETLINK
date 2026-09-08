/**
 * commsService.js
 *
 * Direct Support & Communication Channels.
 *
 * Three concerns:
 *   1. Per-client chat threads with media attachments
 *   2. Secure file upload + signed-URL retrieval (chat-files bucket)
 *   3. Telehealth via Jitsi Meet (room_name + status lifecycle)
 *
 * Realtime: writes happen here; the React app subscribes to the
 * `messages`, `message_attachments`, and `video_consultations`
 * tables via Supabase Realtime — we just need to keep the rows
 * fresh.
 *
 * Roles:
 *   client   — own conversation only; can start/join scheduled
 *              consults; can upload attachments
 *   admin / vet / staff — all conversations; can reply to any;
 *              vet/admin can create + run consults
 */
const crypto = require('crypto');
const path = require('path');
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

let notificationService = null;
try { notificationService = require('./notificationService'); } catch (_) {}

const BUCKET     = 'chat-files';
const SIGN_TTL   = 60 * 10;          // 10 min signed URL
const MAX_BYTES  = 50 * 1024 * 1024; // 50 MB (videos go here)

const STAFF_ROLES = ['admin', 'veterinarian', 'staff'];

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic',
  'video/mp4', 'video/quicktime', 'video/webm',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
  'application/dicom',
]);

function safeName(n) {
  return path.basename(n || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}
function detectKind(mime) {
  if (!mime) return 'file';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'file';
}
function makeRoomName() {
  // unguessable Jitsi room slug
  return 'vetlink-' + crypto.randomBytes(10).toString('hex');
}

async function getOrCreateConversation(clientId) {
  const { data, error } = await supabaseAdmin.rpc('get_or_create_conversation', { p_client: clientId });
  if (error) throw new Error(error.message);
  // RPC returns SETOF / single record depending on PG version — handle both
  return Array.isArray(data) ? data[0] : data;
}

async function getConversationForCaller(actorId, role) {
  if (role === 'client') return getOrCreateConversation(actorId);
  throw new Error('Provide conversationId or clientId for staff calls.');
}

const commsService = {

  /* ──────────────────────────────────────────────────────────────
   * CONVERSATIONS
   * ──────────────────────────────────────────────────────────── */

  /**
   * List conversations the caller can see.
   *   client   → one row (their own)
   *   vet      → only conversations assigned to them
   *   admin    → every conversation
   *   staff    → every conversation (shared inbox)
   */
  async listConversations(actorId, role) {
    if (role === 'client') {
      const conv = await getOrCreateConversation(actorId);
      return [{
        ...conv,
        client_name:   null,
        client_email:  null,
        client_phone:  null,
        client_avatar: null,
      }];
    }
    if (!STAFF_ROLES.includes(role)) throw new Error('Access denied.');

    let q = supabaseAdmin
      .from('v_conversation_list').select('*')
      .order('last_message_at', { ascending: false, nullsFirst: false });

    // Veterinarians only see their assigned conversations
    if (role === 'veterinarian') {
      q = q.eq('assigned_vet_id', actorId);
    }

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
  },

  /**
   * Fetch one conversation along with the most recent N messages.
   */
  async getConversation(id, actorId, role, { limit = 50, before = null } = {}) {
    let conv = null;
    if (role === 'client') {
      conv = await getOrCreateConversation(actorId);
      if (id && id !== conv.id) throw new Error('Access denied.');
    } else {
      if (!STAFF_ROLES.includes(role)) throw new Error('Access denied.');
      const { data } = await supabaseAdmin.from('v_conversation_list').select('*').eq('id', id).single();
      conv = data;
    }
    if (!conv) throw new Error('Conversation not found.');

    let q = supabaseAdmin.from('messages')
      .select('*, attachments:message_attachments(*)')
      .eq('conversation_id', conv.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 200));
    if (before) q = q.lt('created_at', new Date(before).toISOString());

    const { data: msgs, error } = await q;
    if (error) throw new Error(error.message);

    return { conversation: conv, messages: (msgs || []).reverse() };
  },

  /**
   * Mark all messages in a conversation as read for the caller's side.
   * Resets unread_for_client / unread_for_staff accordingly.
   */
  async markRead(conversationId, actorId, role) {
    if (role === 'client') {
      const conv = await getOrCreateConversation(actorId);
      if (conv.id !== conversationId) throw new Error('Access denied.');
      await supabaseAdmin.from('conversations')
        .update({ unread_for_client: 0 }).eq('id', conversationId);
    } else {
      if (!STAFF_ROLES.includes(role)) throw new Error('Access denied.');
      await supabaseAdmin.from('conversations')
        .update({ unread_for_staff: 0 }).eq('id', conversationId);
      // Track which staff read it
      await supabaseAdmin.from('conversation_participants')
        .upsert({
          conversation_id: conversationId,
          user_id: actorId,
          last_read_at: new Date().toISOString(),
        }, { onConflict: 'conversation_id,user_id' });
    }
    return { ok: true };
  },


  /**
   * Pause or resume a client's ability to send new messages on a
   * conversation. Only clinical staff can toggle this -- meant to
   * give a vet/admin/staff a quick way to stop a difficult or
   * abusive pet owner from continuing to message, without losing
   * the chat history or the clinic's own ability to reply.
   * A visible system note is left in the thread either way.
   */
  async setMessagingStatus(actorId, actorRole, conversationId, { disabled, reason } = {}) {
    if (!STAFF_ROLES.includes(actorRole)) throw new Error('Access denied.');
    if (typeof disabled !== 'boolean') throw new Error('disabled must be true or false.');
    if (!conversationId) throw new Error('conversationId is required.');

    const { data: existing } = await supabaseAdmin
      .from('conversations').select('id').eq('id', conversationId).single();
    if (!existing) throw new Error('Conversation not found.');

    const patch = disabled
      ? {
          messaging_disabled:        true,
          messaging_disabled_reason: reason || null,
          messaging_disabled_at:     new Date().toISOString(),
          messaging_disabled_by:     actorId,
        }
      : {
          messaging_disabled:        false,
          messaging_disabled_reason: null,
          messaging_disabled_at:     null,
          messaging_disabled_by:     null,
        };

    const { data: updated, error } = await supabaseAdmin
      .from('conversations').update(patch).eq('id', conversationId)
      .select('*').single();
    if (error) throw new Error(error.message);

    // Leave a visible, permanent note in the thread so any staff
    // opening it later understands why the client couldn't message in.
    try {
      await supabaseAdmin.from('messages').insert({
        conversation_id: conversationId,
        sender_id:       actorId,
        sender_role:      actorRole,
        kind:             'system',
        body: disabled
          ? `Messaging paused for this conversation${reason ? ' — ' + reason : ''}.`
          : 'Messaging re-enabled for this conversation.',
      });
    } catch (_) {}

    return updated;
  },

  /* ──────────────────────────────────────────────────────────────
   * MESSAGES
   * ──────────────────────────────────────────────────────────── */

  /**
   * Send a message. If the caller is a client, conversationId is
   * derived automatically from their own thread.
   */
  async sendMessage(actorId, role, payload) {
    const { body, kind = 'text', petId, appointmentId, replyToId } = payload;
    let { conversationId } = payload;

    if (role === 'client') {
      const conv = await getOrCreateConversation(actorId);
      if (conv.messaging_disabled) {
        throw new Error('Messaging is currently paused for your account. Please call the clinic directly if this is urgent.');
      }
      conversationId = conv.id;
    } else {
      if (!STAFF_ROLES.includes(role)) throw new Error('Access denied.');
      if (!conversationId) throw new Error('conversationId is required.');

      // Auto-assign vet to conversation if replying as a vet and no vet assigned
      if (role === 'veterinarian') {
        // Directly set the assigned vet if not already set
        await supabaseAdmin
          .from('conversations')
          .update({ assigned_vet_id: actorId })
          .eq('id', conversationId)
          .is('assigned_vet_id', null);
      }
    }

    if ((!body || !body.trim()) && kind === 'text') {
      throw new Error('Message body is required.');
    }

    const { data: msg, error } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id:       actorId,
        sender_role:     role,
        kind,
        body:            body || null,
        pet_id:          petId          || null,
        appointment_id:  appointmentId  || null,
        reply_to_id:     replyToId      || null,
      })
      .select('*, attachments:message_attachments(*)')
      .single();
    if (error) throw new Error(error.message);

    // Track participants
    if (STAFF_ROLES.includes(role)) {
      try {
        await supabaseAdmin.from('conversation_participants')
          .upsert({
            conversation_id: conversationId,
            user_id: actorId,
          }, { onConflict: 'conversation_id,user_id' });
      } catch (_) {}
    }

    // Notify the other side (vet-specific: notify assigned vet + admin)
    if (notificationService) {
      try {
        if (role === 'client') {
          // Get the conversation with vet assignment
          const { data: convRow } = await supabaseAdmin
            .from('conversations').select('client_id, assigned_vet_id').eq('id', conversationId).single();
          const preview = (body || '(attachment)').slice(0, 160);

          // Notify assigned vet (if set) — in-app + SMS
          if (convRow?.assigned_vet_id) {
            await notificationService.createWithSMS(convRow.assigned_vet_id, {
              title:   '💬 New message from client',
              message: preview,
              type:    'info',
              link:    `/messages/${conversationId}`,
              smsBody: `PHVC: New message from your client — "${(body || '').slice(0, 100)}"`,
            }).catch(() => null);
          }

          // Also notify admin (in-app only, no SMS)
          const { data: admins } = await supabaseAdmin
            .from('users').select('id').eq('role', 'admin').eq('is_active', true);
          await Promise.all((admins || []).map(a =>
            notificationService.create(a.id, {
              title:   '💬 New message from client',
              message: preview,
              type:    'info',
              link:    `/messages/${conversationId}`,
            }).catch(() => null)
          ));
        } else {
          // Staff → client: in-app + SMS
          const { data: conv } = await supabaseAdmin
            .from('conversations').select('client_id').eq('id', conversationId).single();
          if (conv?.client_id) {
            await notificationService.createWithSMS(conv.client_id, {
              title:   '💬 New message from your clinic',
              message: (body || '(attachment)').slice(0, 160),
              type:    'info',
              link:    `/client/messages`,
              smsBody: `PHVC: New message from your vet — "${(body || '').slice(0, 100)}"`,
            }).catch(() => null);
          }
        }
      } catch (_) {}
    }

    logger.info('comms', 'message.sent', { id: msg.id, conv: conversationId, role });
    return msg;
  },

  async deleteMessage(id, actorId, role) {
    const { data: msg } = await supabaseAdmin
      .from('messages').select('id, sender_id').eq('id', id).single();
    if (!msg) throw new Error('Message not found.');
    if (msg.sender_id !== actorId && !STAFF_ROLES.includes(role)) {
      throw new Error('Access denied.');
    }
    const { error } = await supabaseAdmin
      .from('messages')
      .update({ is_deleted: true, body: null }).eq('id', id);
    if (error) throw new Error(error.message);
    return { deleted: true };
  },


  /* ──────────────────────────────────────────────────────────────
   * ATTACHMENTS (Supabase Storage)
   * ──────────────────────────────────────────────────────────── */

  /**
   * Upload one file and attach it to a message.
   * If `messageId` is omitted, a system-style message is created so
   * the attachment has a parent row to render against.
   */
  async uploadAttachment(actorId, role, file, meta) {
    if (!file || !file.buffer) throw new Error('No file provided.');
    if (file.size > MAX_BYTES) throw new Error('File too large (max 50 MB).');
    if (!ALLOWED_MIME.has(file.mimetype)) throw new Error('Unsupported file type: ' + file.mimetype);

    let conversationId = meta.conversationId;
    if (role === 'client') {
      const conv = await getOrCreateConversation(actorId);
      conversationId = conv.id;
    }
    if (!conversationId) throw new Error('conversationId is required.');

    // Determine / create the parent message
    let messageId = meta.messageId;
    if (!messageId) {
      const parent = await this.sendMessage(actorId, role, {
        conversationId,
        body:          meta.caption || null,
        kind:          detectKind(file.mimetype),
        petId:         meta.petId         || null,
        appointmentId: meta.appointmentId || null,
      });
      messageId = parent.id;
    }

    const stamp = Date.now();
    const rand  = crypto.randomBytes(4).toString('hex');
    const key   = `${conversationId}/${messageId}/${stamp}_${rand}_${safeName(file.originalname)}`;

    const { error: upErr } = await supabaseAdmin
      .storage.from(BUCKET)
      .upload(key, file.buffer, { contentType: file.mimetype, upsert: false });
    if (upErr) throw new Error('Upload failed: ' + upErr.message);

    const { data, error } = await supabaseAdmin
      .from('message_attachments')
      .insert({
        message_id:   messageId,
        storage_path: key,
        file_name:    file.originalname,
        mime_type:    file.mimetype,
        size_bytes:   file.size,
        kind:         detectKind(file.mimetype),
      })
      .select().single();
    if (error) {
      try { await supabaseAdmin.storage.from(BUCKET).remove([key]); } catch (_) {}
      throw new Error(error.message);
    }
    return data;
  },

  async getAttachmentUrl(id, actorId, role) {
    const { data: att } = await supabaseAdmin
      .from('message_attachments')
      .select('*, message:messages(id, conversation_id, conversation:conversations(client_id))')
      .eq('id', id).single();
    if (!att) throw new Error('Attachment not found.');

    if (role === 'client' && att.message?.conversation?.client_id !== actorId) {
      throw new Error('Access denied.');
    }
    if (!STAFF_ROLES.includes(role) && role !== 'client') throw new Error('Access denied.');

    const { data, error } = await supabaseAdmin
      .storage.from(BUCKET)
      .createSignedUrl(att.storage_path, SIGN_TTL);
    if (error) throw new Error(error.message);
    return { url: data.signedUrl, expiresIn: SIGN_TTL, attachment: att };
  },


  /* ──────────────────────────────────────────────────────────────
   * VIDEO CONSULTATIONS (Jitsi Meet)
   * ──────────────────────────────────────────────────────────── */

  async listConsultations(actorId, role, { status = null, days = 30 } = {}) {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    let q = supabaseAdmin
      .from('video_consultations')
      .select(`
        *,
        pet:pets ( id, name, species ),
        client:users!video_consultations_client_id_fkey ( id, name, email ),
        vet:users!video_consultations_vet_id_fkey ( id, name )
      `)
      .gte('created_at', since)
      .order('scheduled_at', { ascending: false, nullsFirst: false });

    if (role === 'client') q = q.eq('client_id', actorId);
    else if (role === 'veterinarian') q = q.eq('vet_id', actorId);
    else if (!STAFF_ROLES.includes(role)) throw new Error('Access denied.');

    if (status) q = q.eq('status', status);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getConsultation(id, actorId, role) {
    const { data, error } = await supabaseAdmin
      .from('video_consultations')
      .select(`
        *,
        pet:pets ( id, name, species, breed ),
        client:users!video_consultations_client_id_fkey ( id, name, email, phone_number ),
        vet:users!video_consultations_vet_id_fkey ( id, name ),
        notes:consultation_notes ( * )
      `)
      .eq('id', id).single();
    if (error || !data) throw new Error('Consultation not found.');

    if (role === 'client' && data.client_id !== actorId) throw new Error('Access denied.');
    if (role === 'veterinarian' && data.vet_id && data.vet_id !== actorId
        && !STAFF_ROLES.includes(role)) {
      // a vet can still see their own scheduled consults; treat as denied otherwise
      if (data.vet_id !== actorId) throw new Error('Access denied.');
    }
    return data;
  },

  /**
   * Create a consultation. Either a vet/admin schedules it ahead
   * of time, or a client requests one (status='scheduled').
   * Generates the Jitsi room name immediately.
   */
  async createConsultation(actorId, role, payload) {
    const { clientId, petId, appointmentId, vetId, scheduledAt } = payload;
    if (!STAFF_ROLES.includes(role) && role !== 'client') throw new Error('Access denied.');

    const finalClientId = role === 'client' ? actorId : clientId;
    if (!finalClientId) throw new Error('clientId is required.');

    // Lazily ensure the conversation exists so the consultation links to it
    const conv = await getOrCreateConversation(finalClientId);

    const insert = {
      appointment_id: appointmentId || null,
      conversation_id: conv.id,
      pet_id:         petId    || null,
      client_id:      finalClientId,
      vet_id:         vetId    || null,
      room_name:      makeRoomName(),
      scheduled_at:   scheduledAt ? new Date(scheduledAt).toISOString() : null,
      status:         'scheduled',
      created_by:     actorId,
    };
    const { data, error } = await supabaseAdmin
      .from('video_consultations').insert(insert).select().single();
    if (error) throw new Error(error.message);

    // System message in the chat
    try {
      await supabaseAdmin.from('messages').insert({
        conversation_id: conv.id,
        sender_id:       actorId,
        sender_role:     role,
        kind:            'system',
        body:            `📹 Telehealth consultation ${scheduledAt
          ? 'scheduled for ' + new Date(scheduledAt).toLocaleString()
          : 'created — ready to join'}`,
      });
    } catch (_) {}

    return data;
  },

  /**
   * Caller joins their own session. Stamps client_joined_at / vet_joined_at
   * and flips status into `waiting` / `in_progress` accordingly.
   */
  async joinConsultation(id, actorId, role) {
    const c = await this.getConsultation(id, actorId, role);
    if (['completed','cancelled','no_show'].includes(c.status)) {
      throw new Error('This session is no longer active.');
    }

    const now = new Date().toISOString();
    const patch = {};
    if (role === 'client' && c.client_id === actorId) {
      patch.client_joined_at = now;
    } else if (STAFF_ROLES.includes(role)) {
      patch.vet_joined_at = now;
      if (!c.vet_id) patch.vet_id = actorId;
    } else {
      throw new Error('Access denied.');
    }

    // Decide new status:
    //   client first      → waiting   (vet not yet in)
    //   vet first         → waiting   (client not yet in)
    //   both present      → in_progress + started_at
    let newStatus = c.status;
    const clientIn = patch.client_joined_at || c.client_joined_at;
    const vetIn    = patch.vet_joined_at    || c.vet_joined_at;
    if (clientIn && vetIn) {
      newStatus = 'in_progress';
      if (!c.started_at) patch.started_at = now;
    } else {
      newStatus = 'waiting';
    }
    patch.status = newStatus;

    const { data, error } = await supabaseAdmin
      .from('video_consultations').update(patch).eq('id', id).select().single();
    if (error) throw new Error(error.message);

    return {
      ...data,
      // Compose the URL the iframe should load
      meeting_url: `${data.jitsi_base_url}/${data.room_name}`,
    };
  },

  async endConsultation(id, actorId, role, { cancel = false, cancelReason = null } = {}) {
    if (!STAFF_ROLES.includes(role) && role !== 'client') throw new Error('Access denied.');

    const c = await this.getConsultation(id, actorId, role);
    const now = new Date();
    const startedAt = c.started_at ? new Date(c.started_at) : null;
    const duration  = startedAt ? Math.floor((now.getTime() - startedAt.getTime()) / 1000) : null;

    const { data, error } = await supabaseAdmin
      .from('video_consultations')
      .update({
        status:       cancel ? 'cancelled' : 'completed',
        ended_at:     now.toISOString(),
        duration_sec: duration,
        cancel_reason: cancelReason || null,
      })
      .eq('id', id)
      .select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  /* ── consultation notes ──────────────────────────────────── */
  async upsertConsultNote(actorId, role, consultationId, payload) {
    if (!STAFF_ROLES.includes(role)) throw new Error('Access denied.');
    const row = {
      consultation_id: consultationId,
      vet_id:          actorId,
      subjective:      payload.subjective || null,
      objective:       payload.objective  || null,
      assessment:      payload.assessment || null,
      plan:            payload.plan       || null,
      follow_up_required: payload.followUpRequired === true,
      follow_up_date:  payload.followUpDate || null,
    };
    const { data, error } = await supabaseAdmin
      .from('consultation_notes')
      .upsert(row, { onConflict: 'consultation_id' })
      .select().single();
    if (error) throw new Error(error.message);
    return data;
  },

};

module.exports = commsService;
