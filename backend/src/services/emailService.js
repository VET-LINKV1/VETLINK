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

const emailService = {

  isConfigured,

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
      const info = await tx.sendMail({
        from: from || process.env.SMTP_FROM || 'VETLINK <noreply@vetlink.local>',
        to,
        subject,
        text: text || (html ? html.replace(/<[^>]+>/g, '') : ''),
        html,
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
