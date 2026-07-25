/**
 * staffAuthRoutes.js
 * Routes for internal staff registration with OTP verification.
 */
const { Router } = require('express');
const staffAuthController = require('../controllers/staffAuthController');
const { validateMiddleware } = require('../middleware/validateMiddleware');
const schemas = require('../validations/staffAuthValidation');
const rateLimit = require('express-rate-limit');

const router = Router();

// Rate limiter — max 5 registration attempts per 15 minutes per IP
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, error: 'Too many registration attempts. Please try again later.' },
});

// Rate limiter — max 10 OTP verify attempts per 15 minutes per IP
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many verification attempts. Please try again later.' },
});

/**
 * @route   POST /api/staff/register
 * @desc    Submit registration form → validate → send OTP
 * @access  Public
 */
router.post(
  '/register',
  registerLimiter,
  validateMiddleware(schemas.register),
  staffAuthController.register
);

/**
 * @route   POST /api/staff/verify-otp
 * @desc    Verify OTP → create Supabase user → save profile
 * @access  Public
 */
router.post(
  '/verify-otp',
  otpLimiter,
  validateMiddleware(schemas.verifyOTP),
  staffAuthController.verifyOTP
);

/**
 * @route   POST /api/staff/resend-otp
 * @desc    Resend OTP (60s cooldown enforced)
 * @access  Public
 */
router.post(
  '/resend-otp',
  otpLimiter,
  validateMiddleware(schemas.resendOTP),
  staffAuthController.resendOTP
);

module.exports = router;
