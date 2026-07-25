/**
 * otpService.js
 * OTP lifecycle: generate, store hashed, verify, expire.
 *
 * In dev mode (no Twilio), returns the plaintext OTP back so the frontend
 * can display it for testing. NEVER do this in production — gated by
 * smsService.isLive().
 */
const { supabaseAdmin } = require('../config/supabase');
const { generateOTPWithExpiry } = require('../utils/otpGenerator');
const { hashOTP, verifyOTPHash } = require('../utils/hashUtil');
const smsService = require('./smsService');
const logger = require('../utils/logger');

const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

const otpService = {
  /**
   * Create + send OTP. Returns metadata + (in dev) the raw OTP for display.
   */
  async createAndSendOTP(phoneNumber) {
    const { otp, expiresAt } = generateOTPWithExpiry(5);
    const otpHash = await hashOTP(otp);

    await supabaseAdmin.from('otp_verifications').delete().eq('phone_number', phoneNumber);
    const { error } = await supabaseAdmin.from('otp_verifications').insert({
      phone_number: phoneNumber,
      otp_hash:     otpHash,
      expires_at:   expiresAt.toISOString(),
      attempts:     0,
    });
    if (error) throw new Error('Failed to store OTP: ' + error.message);

    const sendResult = await smsService.sendOTP(phoneNumber, otp);

    logger.info('otp', 'created', { phoneNumber, provider: sendResult.provider, delivered: sendResult.delivered });

    return {
      expiresAt,
      delivered: sendResult.delivered,
      provider:  sendResult.provider,
      // Only present in dev mode — frontend uses this to display OTP for testing
      devOTP:    sendResult.devOTP || null,
    };
  },

  async verifyOTP(phoneNumber, enteredOTP) {
    const { data: record, error } = await supabaseAdmin
      .from('otp_verifications').select('*').eq('phone_number', phoneNumber).single();
    if (error || !record) return { valid: false, reason: 'No OTP found for this phone number.' };

    if (new Date() > new Date(record.expires_at)) {
      await otpService.deleteOTP(phoneNumber);
      return { valid: false, reason: 'OTP has expired. Please request a new one.' };
    }
    if (record.attempts >= MAX_ATTEMPTS) {
      await otpService.deleteOTP(phoneNumber);
      return { valid: false, reason: 'Too many failed attempts. Please request a new OTP.' };
    }

    await supabaseAdmin.from('otp_verifications').update({ attempts: record.attempts + 1 }).eq('phone_number', phoneNumber);

    const isMatch = await verifyOTPHash(enteredOTP, record.otp_hash);
    if (!isMatch) {
      const remaining = MAX_ATTEMPTS - (record.attempts + 1);
      return { valid: false, reason: `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` };
    }

    await otpService.deleteOTP(phoneNumber);
    return { valid: true };
  },

  async resendOTP(phoneNumber) {
    const { data: existing } = await supabaseAdmin
      .from('otp_verifications').select('created_at').eq('phone_number', phoneNumber).single();

    if (existing) {
      const secondsSinceSent = (Date.now() - new Date(existing.created_at).getTime()) / 1000;
      if (secondsSinceSent < RESEND_COOLDOWN_SECONDS) {
        return { sent: false, cooldownRemaining: Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceSent) };
      }
    }

    const result = await otpService.createAndSendOTP(phoneNumber);
    return { sent: true, devOTP: result.devOTP, delivered: result.delivered };
  },

  async deleteOTP(phoneNumber) {
    await supabaseAdmin.from('otp_verifications').delete().eq('phone_number', phoneNumber);
  },
};

module.exports = otpService;
