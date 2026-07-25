const staffAuthService = require('../services/staffAuthService');
const otpService = require('../services/otpService');

const staffAuthController = {
  async register(req, res) {
    try {
      const result = await staffAuthService.initiateRegistration(req.body);
      // SMS_DISABLED path → user already created, tell the frontend
      // to skip the OTP screen and go straight to login.
      const status = result.skippedOtp ? 201 : 200;
      return res.status(status).json({
        success: true,
        message: result.message,
        data: {
          phone:      result.phone,
          delivered:  result.delivered,
          provider:   result.provider,
          skippedOtp: !!result.skippedOtp,
          email:      result.email || null,
          role:       result.role  || null,
          // ONLY surfaces in dev mode — null when a live provider is configured
          devOTP:     result.devOTP || null,
        },
      });
    } catch (err) {
      console.error('[staffAuthController.register]', err.message);
      const isDuplicate = err.message.includes('already exists') || err.message.includes('already registered');
      return res.status(isDuplicate ? 409 : 400).json({ success: false, error: err.message });
    }
  },

  async verifyOTP(req, res) {
    try {
      const { phoneNumber, otp } = req.body;
      const result = await staffAuthService.completeRegistration(phoneNumber, otp);
      return res.status(201).json({
        success: true,
        message: result.message,
        data: { email: result.email },
      });
    } catch (err) {
      console.error('[staffAuthController.verifyOTP]', err.message);
      return res.status(400).json({ success: false, error: err.message });
    }
  },

  async resendOTP(req, res) {
    try {
      const { phoneNumber } = req.body;
      const result = await otpService.resendOTP(phoneNumber);

      if (!result.sent) {
        return res.status(429).json({
          success: false,
          error: `Please wait ${result.cooldownRemaining} seconds before requesting a new OTP.`,
          cooldownRemaining: result.cooldownRemaining,
        });
      }

      return res.status(200).json({
        success: true,
        message: 'OTP resent successfully.',
        data: {
          devOTP:    result.devOTP || null,
          delivered: result.delivered,
        },
      });
    } catch (err) {
      console.error('[staffAuthController.resendOTP]', err.message);
      return res.status(500).json({ success: false, error: 'Failed to resend OTP. Please try again.' });
    }
  },
};

module.exports = staffAuthController;
