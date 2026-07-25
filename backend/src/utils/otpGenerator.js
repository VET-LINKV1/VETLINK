/**
 * otpGenerator.js
 * Generates a cryptographically secure 6-digit OTP.
 * Uses Node's built-in crypto module — no external dependency needed.
 */
const crypto = require('crypto');

/**
 * Generate a 6-digit numeric OTP.
 * Uses crypto.randomInt for uniform distribution (no modulo bias).
 * @returns {string} 6-digit OTP string
 */
function generateOTP() {
  // randomInt(min, max) — max is exclusive
  const otp = crypto.randomInt(100000, 1000000);
  return otp.toString();
}

/**
 * Generate OTP with expiry timestamp.
 * @param {number} expiryMinutes - How long until OTP expires (default: 5 min)
 * @returns {{ otp: string, expiresAt: Date }}
 */
function generateOTPWithExpiry(expiryMinutes = 5) {
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
  return { otp, expiresAt };
}

module.exports = { generateOTP, generateOTPWithExpiry };
