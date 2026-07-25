/**
 * analyticsController.js
 * HTTP layer for "The Health Check" — descriptive analytics.
 */
const analyticsService = require('../services/analyticsService');
const logger = require('../utils/logger');

function readFilters(req) {
  return {
    startDate: req.query.startDate || null,
    endDate:   req.query.endDate   || null,
  };
}

const analyticsController = {
  async admin(req, res) {
    try {
      const data = await analyticsService.getAdminHealthCheck(readFilters(req));
      res.json({ success: true, data });
    } catch (err) {
      logger.error('analytics.admin', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async vet(req, res) {
    try {
      // Admins may inspect any vet via ?vetId=...; otherwise it's the caller.
      const targetVetId =
        req.user.role === 'admin' && req.query.vetId
          ? req.query.vetId
          : req.user.id;
      const data = await analyticsService.getVetHealthCheck(targetVetId, readFilters(req));
      res.json({ success: true, data });
    } catch (err) {
      logger.error('analytics.vet', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async staff(req, res) {
    try {
      const data = await analyticsService.getStaffHealthCheck(readFilters(req));
      res.json({ success: true, data });
    } catch (err) {
      logger.error('analytics.staff', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async client(req, res) {
    try {
      // Admins/staff may inspect any client via ?clientId=...
      const targetClientId =
        ['admin','staff'].includes(req.user.role) && req.query.clientId
          ? req.query.clientId
          : req.user.id;
      const data = await analyticsService.getClientHealthCheck(targetClientId, readFilters(req));
      res.json({ success: true, data });
    } catch (err) {
      logger.error('analytics.client', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  // Convenience: auto-route to the right report based on the caller's role.
  async me(req, res) {
    try {
      const role = req.user.role;
      let data;
      if (role === 'admin')             data = await analyticsService.getAdminHealthCheck(readFilters(req));
      else if (role === 'veterinarian') data = await analyticsService.getVetHealthCheck(req.user.id, readFilters(req));
      else if (role === 'staff')        data = await analyticsService.getStaffHealthCheck(readFilters(req));
      else                              data = await analyticsService.getClientHealthCheck(req.user.id, readFilters(req));
      res.json({ success: true, data });
    } catch (err) {
      logger.error('analytics.me', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  },
};

module.exports = analyticsController;
