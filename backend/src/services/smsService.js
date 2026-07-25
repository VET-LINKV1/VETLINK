/**
 * smsService.js
 * Provider chain (highest priority first):
 *
 *   1. Semaphore — if SEMAPHORE_API_KEY is set. Cheapest for PH (~₱0.50/SMS).
 *   2. Twilio    — if TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_PHONE_NUMBER are set.
 *   3. Dev mode  — log to console + return OTP via API response for testing.
 *
 * Each provider uses Node's built-in fetch (Node 18+). No new deps.
 */
const logger = require('../utils/logger');

// ── SMS kill-switch ────────────────────────────────────────────
// Set SMS_DISABLED=1 in .env to turn off ALL outgoing SMS (used by
// registration to skip the OTP step entirely).
function isSmsDisabled() {
  return ['1', 'true', 'yes'].includes(
    String(process.env.SMS_DISABLED || '').trim().toLowerCase()
  );
}

// ── Provider detection ─────────────────────────────────────────
function isSemaphoreConfigured() {
  return Boolean(process.env.SEMAPHORE_API_KEY);
}
function isTwilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
}

function activeProvider() {
  if (isSmsDisabled())         return 'disabled';
  if (isSemaphoreConfigured()) return 'semaphore';
  if (isTwilioConfigured())    return 'twilio';
  return 'dev-console';
}

// ── Semaphore (PH local SMS gateway) ───────────────────────────
// API docs: https://semaphore.co/docs
// Accepts both +639xxxxxxxxx and 09xxxxxxxxx formats.
async function sendViaSemaphore(to, message) {
  const apiKey     = process.env.SEMAPHORE_API_KEY;
  const senderName = process.env.SEMAPHORE_SENDER || 'SEMAPHORE'; // 11 chars max; pre-register custom names in Semaphore dashboard
  const params     = new URLSearchParams({
    apikey: apiKey,
    number: to,
    message,
    sendername: senderName,
  });

  const res = await fetch('https://api.semaphore.co/api/v4/messages', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    params.toString(),
  });

  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }

  if (!res.ok) {
    throw new Error(`Semaphore HTTP ${res.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  // Semaphore returns an array on success
  if (Array.isArray(body) && body[0]?.message_id) {
    return { success: true, messageId: String(body[0].message_id), provider: 'semaphore' };
  }
  // Some failure shapes return an object with errors
  throw new Error(`Semaphore unexpected response: ${JSON.stringify(body)}`);
}

// ── Twilio (kept as fallback) ──────────────────────────────────
let _twilioClient = null;
function getTwilioClient() {
  if (_twilioClient) return _twilioClient;
  try {
    const twilio = require('twilio');
    _twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    return _twilioClient;
  } catch (e) {
    logger.warn('sms', 'twilio package not installed', { msg: e.message });
    return null;
  }
}
async function sendViaTwilio(to, message) {
  const client = getTwilioClient();
  if (!client) throw new Error('Twilio package missing — run: npm install twilio');
  const result = await client.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE_NUMBER,
    to,
  });
  return { success: true, messageId: result.sid, provider: 'twilio' };
}

// ── Dev console fallback ──────────────────────────────────────
function logToConsole(to, message) {
  console.log('\n📱 [SMS DEV MODE — no provider configured]');
  console.log(`   To:      ${to}`);
  console.log(`   Message: ${message}`);
  console.log('   (Set SEMAPHORE_API_KEY (preferred for PH) or TWILIO_* in .env to send real SMS)\n');
}

// ── Generic dispatcher ────────────────────────────────────────
async function dispatch(phoneNumber, message) {
  if (isSmsDisabled()) {
    logger.info('sms', 'sms disabled — not sending', { to: phoneNumber });
    return { delivered: false, provider: 'disabled', disabled: true };
  }
  if (isSemaphoreConfigured()) {
    try {
      const r = await sendViaSemaphore(phoneNumber, message);
      logger.info('sms', 'sent via Semaphore', { to: phoneNumber, id: r.messageId });
      return { delivered: true, provider: 'semaphore' };
    } catch (e) {
      logger.error('sms', 'Semaphore failed, trying next provider', { msg: e.message });
      // fall through to next provider
    }
  }
  if (isTwilioConfigured()) {
    try {
      const r = await sendViaTwilio(phoneNumber, message);
      logger.info('sms', 'sent via Twilio', { to: phoneNumber, sid: r.messageId });
      return { delivered: true, provider: 'twilio' };
    } catch (e) {
      logger.error('sms', 'Twilio failed, falling back to dev log', { msg: e.message });
    }
  }
  logToConsole(phoneNumber, message);
  return { delivered: false, provider: 'dev-console' };
}

const smsService = {
  /**
   * Send an OTP. In dev/fallback mode, returns devOTP so the frontend can show it.
   */
  async sendOTP(phoneNumber, otp) {
    const message = `Your PHVC verification code is: ${otp}. It expires in 5 minutes. Do not share this with anyone.`;
    const result  = await dispatch(phoneNumber, message);
    return {
      ...result,
      devOTP: result.delivered ? null : otp,
    };
  },

  async sendNotification(phoneNumber, message) {
    if (!phoneNumber) return { delivered: false, provider: 'none', error: 'No phone number' };
    return dispatch(phoneNumber, message);
  },

  /**
   * Send SMS only if user has opted in. Checks the users table for sms_opt_in.
   */
  async sendIfOptedIn(userId, message) {
    if (!userId) return { delivered: false, provider: 'none', error: 'No user ID' };
    try {
      const { supabaseAdmin } = require('../config/supabase');
      const { data: user } = await supabaseAdmin
        .from('users').select('phone_number, sms_opt_in').eq('id', userId).single();
      if (!user) return { delivered: false, provider: 'none', error: 'User not found' };
      if (!user.sms_opt_in) return { delivered: false, provider: 'opted_out', disabled: true };
      if (!user.phone_number) return { delivered: false, provider: 'none', error: 'No phone number' };
      return dispatch(user.phone_number, message);
    } catch (e) {
      logger.error('sms', 'sendIfOptedIn failed', { msg: e.message });
      return { delivered: false, provider: 'error', error: e.message };
    }
  },

  isLive() { return activeProvider() !== 'dev-console' && activeProvider() !== 'disabled'; },
  isDisabled() { return isSmsDisabled(); },
  provider() { return activeProvider(); },
};

module.exports = smsService;
