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

/** Absolute link to the app for a relative path. */
function absoluteUrl(link) {
  const base = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  if (!link) return null;
  return link.startsWith('http') ? link : (base ? `${base}${link}` : null);
}

/**
 * Subject line: no emoji / shouting (both are spam-filter triggers) and a
 * consistent "VETLINK:" prefix so recipients recognise the sender.
 */
function emailSubjectFor(title = '') {
  const clean = String(title)
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  const sentence = clean === clean.toUpperCase() && /[A-Z]{4,}/.test(clean)
    ? clean.charAt(0) + clean.slice(1).toLowerCase() : clean;
  return /^vetlink/i.test(sentence) ? sentence : `VETLINK: ${sentence}`;
}

const FOOTER_TEXT = 'VETLINK — Agoo, La Union. You are receiving this message because of activity on your VETLINK account or appointment.';

/** Plain-text version (always sent alongside the HTML). */
function emailText(title, message, link) {
  const url = absoluteUrl(link);
  return [title, '', message, ...(url ? ['', `Open VETLINK: ${url}`] : []), '', '--', FOOTER_TEXT].join('\n');
}

/** Simple branded wrapper so every notification email looks consistent. */
function emailTemplate(title, message, link) {
  const url = absoluteUrl(link);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(String(message).slice(0, 110))}</div>
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;font-family:Arial,Helvetica,sans-serif;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
      <p style="margin:0 0 4px;font-size:12px;color:#2563eb;font-weight:bold;letter-spacing:.5px;">VETLINK</p>
      <h2 style="color:#1e293b;margin:0 0 12px;font-size:20px;">${escapeHtml(title)}</h2>
      <p style="color:#475569;line-height:1.6;font-size:15px;margin:0 0 16px;">${escapeHtml(message)}</p>
      ${url ? `<p style="margin:0 0 8px;"><a href="${url}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;">Open VETLINK</a></p>` : ''}
    </div>
    <p style="color:#94a3b8;font-size:12px;line-height:1.5;margin:16px 4px 0;">${escapeHtml(FOOTER_TEXT)}</p>
  </div>
</body></html>`;
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
      if (user?.email && emailService.isConfigured() && await emailService.isEnabled()) {
        await emailService.send({
          to:      user.email,
          subject: emailSubject || emailSubjectFor(title),
          html:    emailHtml || emailTemplate(title, message, link),
          text:    emailHtml ? undefined : emailText(title, message, link),
        });
      }
    } catch (e) {
      logger.warn('notification', 'SMS/email dispatch failed', { msg: e.message, userId });
    }
  },

  /** In-app + email (no SMS). Used for staff/doctor alerts. */
  async createWithEmail(userId, { title, message, type = 'info', link, emailSubject, emailHtml }) {
    if (!userId) return;
    await notificationService.create(userId, { title, message, type, link });
    try {
      const { data: user } = await supabaseAdmin
        .from('users').select('email').eq('id', userId).single();
      if (user?.email && emailService.isConfigured() && await emailService.isEnabled()) {
        await emailService.send({
          to:      user.email,
          subject: emailSubject || emailSubjectFor(title),
          html:    emailHtml || emailTemplate(title, message, link),
          text:    emailHtml ? undefined : emailText(title, message, link),
        });
      }
    } catch (e) {
      logger.warn('notification', 'email dispatch failed', { msg: e.message, userId });
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
  async notifyRoles(roles, { title, message, type = 'info', link, email = false } = {}) {
    try {
      const { data: users } = await supabaseAdmin
        .from('users').select('id').in('role', roles).eq('is_active', true);
      await Promise.all((users || []).map(u => (email
        ? notificationService.createWithEmail(u.id, { title, message, type, link })
        : notificationService.create(u.id, { title, message, type, link })
      ).catch(() => null)));
    } catch (e) {
      logger.warn('notification', 'notifyRoles failed', { msg: e.message, roles });
    }
  },
};

module.exports = notificationService;
