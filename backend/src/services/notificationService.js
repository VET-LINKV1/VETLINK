/**
 * notificationService.js
 * Create + read in-app notifications. Optionally fires SMS and/or email too.
 */
const { supabaseAdmin } = require('../config/supabase');
const smsService = require('./smsService');
const emailService = require('./emailService');
const logger = require('../utils/logger');

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/** Simple branded wrapper so every notification email looks consistent. */
function emailTemplate(title, message, link) {
  const appBaseUrl = process.env.FRONTEND_URL || '';
  const url = link ? (link.startsWith('http') ? link : `${appBaseUrl}${link}`) : null;
  return `
    <div style="font-family:sans-serif;">
      <h2 style="color:#1e293b;margin:0 0 8px;">${escapeHtml(title)}</h2>
      <p style="color:#475569;line-height:1.5;">${escapeHtml(message)}</p>
      ${url ? `<p><a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;">Open VETLINK</a></p>` : ''}
      <p style="color:#94a3b8;font-size:12px;margin-top:16px;">This is an automated message from VETLINK — Agoo, La Union.</p>
    </div>
  `;
}

const notificationService = {
  /** In-app only. */
  async create(userId, { title, message, type = 'info', link }) {
    if (!userId) return;
    const { error } = await supabaseAdmin
      .from('notifications')
      .insert({ user_id: userId, title, message, type, link: link || null });
    if (error) logger.warn('notification', 'create failed', { msg: error.message, userId });
  },

  /**
   * In-app + SMS + email. The SMS body defaults to "{title}: {message}"
   * but can be overridden with `smsBody` (SMS respects the user's
   * sms_opt_in preference). Email is sent whenever SMTP is configured
   * (see emailService) and the user has an email on file — subject/body
   * default to `title`/`message` but can be overridden with
   * `emailSubject`/`emailHtml`.
   */
  async createWithSMS(userId, { title, message, type = 'info', link, smsBody, emailSubject, emailHtml }) {
    if (!userId) return;
    // Insert in-app notification first
    await notificationService.create(userId, { title, message, type, link });
    // Then check opt-in and send SMS
    try {
      const { data: user } = await supabaseAdmin
        .from('users').select('email, phone_number, sms_opt_in').eq('id', userId).single();
      if (user?.phone_number && user.sms_opt_in !== false) {
        const body = smsBody || `${title}: ${message}`;
        await smsService.sendNotification(user.phone_number, body);
      }
      if (user?.email && emailService.isConfigured()) {
        await emailService.send({
          to:      user.email,
          subject: emailSubject || title,
          html:    emailHtml || emailTemplate(title, message, link),
        });
      }
    } catch (e) {
      logger.warn('notification', 'SMS/email dispatch failed', { msg: e.message, userId });
    }
  },

  async getForUser(userId, { limit = 50 } = {}) {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
  },

  async markRead(notificationId, userId) {
    const { data: existing } = await supabaseAdmin
      .from('notifications').select('id, user_id').eq('id', notificationId).single();
    if (!existing) throw new Error('Notification not found');
    if (existing.user_id !== userId) throw new Error('Access denied');

    const { error } = await supabaseAdmin
      .from('notifications').update({ is_read: true }).eq('id', notificationId);
    if (error) throw new Error(error.message);
    return true;
  },

  async markAllRead(userId) {
    const { error } = await supabaseAdmin
      .from('notifications').update({ is_read: true })
      .eq('user_id', userId).eq('is_read', false);
    if (error) throw new Error(error.message);
    return true;
  },

  /**
   * Notify every active user in one or more roles (e.g. front desk /
   * admin broadcasts — emergency bookings, cancellations, new
   * confinements). Best-effort: a failure for one user, or for the
   * whole lookup, is logged and swallowed so it never blocks the
   * action that triggered it.
   */
  async notifyRoles(roles, { title, message, type = 'info', link } = {}) {
    try {
      const { data: users } = await supabaseAdmin
        .from('users').select('id').in('role', roles).eq('is_active', true);
      await Promise.all((users || []).map(u =>
        notificationService.create(u.id, { title, message, type, link }).catch(() => null)
      ));
    } catch (e) {
      logger.warn('notification', 'notifyRoles failed', { msg: e.message, roles });
    }
  },
};

module.exports = notificationService;
