/**
 * emailService.js
 *
 * Sends transactional email through nodemailer (lazy-loaded so the
 * dependency is optional). Configuration is read from env:
 *
 *   SMTP_HOST     (e.g. smtp.gmail.com / smtp.resend.com)
 *   SMTP_PORT     (default 587)
 *   SMTP_USER
 *   SMTP_PASS
 *   SMTP_FROM     (default "VETLINK <noreply@vetlink.local>")
 *   SMTP_SECURE   ("1" / "true" for SSL on 465)
 *
 * If anything is missing OR nodemailer isn't installed, send() returns
 * { delivered: false, reason: '...' } without throwing — callers can
 * still hand the share URL back to the user as a copy/paste fallback.
 */
const logger = require('../utils/logger');

let _transporter = null;
let _initTried = false;

function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (_initTried) return _transporter;
  _initTried = true;
  if (!isConfigured()) return null;
  try {
    // Lazy require so the app boots even if nodemailer isn't installed.
    const nodemailer = require('nodemailer');
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: ['1', 'true', 'yes'].includes(String(process.env.SMTP_SECURE || '').toLowerCase()),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    logger.info('email', 'transporter ready', { host: process.env.SMTP_HOST });
    return _transporter;
  } catch (e) {
    logger.warn('email', 'nodemailer not installed', { msg: e.message });
    return null;
  }
}

// Admin > Settings > Notification Settings (email_enabled / email_from_name /
// email_from). Cached briefly so a burst of notifications doesn't hit the DB
// for every message. Falls back to env defaults if the row can't be read.
let _senderCache = { at: 0, value: null };
async function getSenderSettings() {
  if (_senderCache.value && Date.now() - _senderCache.at < 60_000) return _senderCache.value;
  let value = { enabled: true, fromName: '', fromAddress: '' };
  try {
    const { supabaseAdmin } = require('../config/supabase');
    const { data } = await supabaseAdmin
      .from('settings_notifications').select('*').eq('id', 'default').maybeSingle();
    if (data) {
      value = {
        enabled:     data.email_enabled !== false,
        fromName:    data.email_from_name ?? data.clicksend_from ?? '',
        fromAddress: data.email_from || '',
      };
    }
  } catch (e) {
    logger.warn('email', 'could not read sender settings', { msg: e.message });
  }
  _senderCache = { at: Date.now(), value };
  return value;
}

function buildFrom({ fromName, fromAddress }) {
  // Gmail (and most providers) only deliver mail "From" the authenticated
  // mailbox; a different From address gets rewritten or flagged as spoofing,
  // which is a classic spam trigger. So on Gmail we always use SMTP_USER.
  const isGmail = /gmail\.com|googlemail\.com/i.test(process.env.SMTP_HOST || '');
  const addr = isGmail
    ? process.env.SMTP_USER
    : (fromAddress || process.env.SMTP_FROM_ADDRESS || process.env.SMTP_USER);
  if (!fromName && !fromAddress) {
    return isGmail
      ? `"VETLINK" <${addr}>`
      : (process.env.SMTP_FROM || 'VETLINK <noreply@vetlink.local>');
  }
  const name = String(fromName || 'VETLINK').replace(/["<>]/g, '');
  return `"${name}" <${addr}>`;
}

/** Readable plain-text fallback (spam filters penalise HTML-only mail). */
function htmlToText(html = '') {
  return String(html)
    .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '$2: $1')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const emailService = {

  isConfigured,

  /** Admin master switch for notification emails (Settings > Notifications). */
  async isEnabled() {
    return (await getSenderSettings()).enabled;
  },

  /** Drop the cached sender settings (call after they're edited). */
  clearSettingsCache() { _senderCache = { at: 0, value: null }; },

  /**
   * Send an email. Always resolves (never rejects) — the caller can
   * decide what to do with `delivered: false`.
   */
  async send({ to, subject, html, text, from }) {
    if (!to)      return { delivered: false, reason: 'no recipient' };
    if (!subject) return { delivered: false, reason: 'no subject' };

    const tx = getTransporter();
    if (!tx) {
      logger.info('email', 'dispatcher unavailable — skipping send', { to });
      return { delivered: false, reason: isConfigured() ? 'nodemailer not installed' : 'SMTP not configured' };
    }

    try {
      const sender = from ? null : await getSenderSettings();
      const fromHeader = from || buildFrom(sender);
      const replyAddr  = (fromHeader.match(/<([^>]+)>/) || [])[1] || process.env.SMTP_USER;
      const info = await tx.sendMail({
        from: fromHeader,
        to,
        replyTo: replyAddr,
        subject,
        text: text || htmlToText(html),
        html,
        headers: {
          // Marks this as a one-to-one system message (not bulk mail) and
          // stops auto-responders from replying to it.
          'Auto-Submitted': 'auto-generated',
          'X-Auto-Response-Suppress': 'OOF, AutoReply',
        },
      });
      logger.info('email', 'sent', { to, messageId: info.messageId });
      return { delivered: true, messageId: info.messageId };
    } catch (e) {
      logger.error('email', 'send failed', { to, msg: e.message });
      return { delivered: false, reason: e.message };
    }
  },

};

module.exports = emailService;
