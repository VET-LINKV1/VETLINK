/**
 * hashUtil.js
 * Utility for hashing and comparing OTPs using bcrypt.
 * 
 * SECURITY NOTE: We hash OTPs before storing them so that
 * even if the database is compromised, raw OTPs are never exposed.
 */
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

/**
 * Hash a plain OTP string.
 * @param {string} otp - Plain 6-digit OTP
 * @returns {Promise<string>} Hashed OTP
 */
async function hashOTP(otp) {
  return bcrypt.hash(otp, SALT_ROUNDS);
}

/**
 * Compare a plain OTP with a stored hash.
 * @param {string} otp - Plain OTP entered by user
 * @param {string} hash - Stored hash from database
 * @returns {Promise<boolean>} True if match
 */
async function verifyOTPHash(otp, hash) {
  return bcrypt.compare(otp, hash);
}

module.exports = { hashOTP, verifyOTPHash };
