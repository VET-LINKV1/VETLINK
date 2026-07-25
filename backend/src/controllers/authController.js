const authService = require('../services/authService');

/**
 * AuthController — thin layer that delegates to AuthService
 */
const authController = {
  /**
   * POST /auth/login
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result,
      });
    } catch (err) {
      console.error('[authController.login]', err.message);

      // Don't reveal whether email or password is wrong
      const isCredentialError =
        err.message.toLowerCase().includes('invalid') ||
        err.message.toLowerCase().includes('credentials') ||
        err.message.toLowerCase().includes('password');

      return res.status(isCredentialError ? 401 : 400).json({
        success: false,
        error: isCredentialError ? 'Invalid email or password' : err.message,
      });
    }
  },

  /**
   * GET /auth/me
   * Requires authMiddleware
   */
  async getMe(req, res) {
    try {
      return res.status(200).json({
        success: true,
        data: { user: req.user },
      });
    } catch (err) {
      console.error('[authController.getMe]', err.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve user profile',
      });
    }
  },

  /**
   * POST /auth/logout
   * Requires authMiddleware
   */
  async logout(req, res) {
    try {
      await authService.logout(req.token);
      return res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (err) {
      console.error('[authController.logout]', err.message);
      return res.status(500).json({
        success: false,
        error: 'Logout failed',
      });
    }
  },
};

module.exports = authController;
