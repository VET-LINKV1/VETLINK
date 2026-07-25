/**
 * noShowController.js
 * HTTP layer for no-show auto-cancellation.
 */
const noShowService = require('../services/noShowService');

const noShowController = {

  /**
   * POST /api/no-show/sweep — trigger auto-cancel sweep
   */
  async runSweep(req, res) {
    try {
      const result = await noShowService.runSweep();
      res.json({ success: true, data: result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  },

  /**
   * GET /api/no-show/policy — get current policy
   */
  async getPolicy(req, res) {
    try {
      const policy = await noShowService.getPolicy();
      res.json({ success: true, data: policy });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  },

  /**
   * PUT /api/no-show/policy — update policy (admin)
   */
  async updatePolicy(req, res) {
    try {
      const policy = await noShowService.updatePolicy(req.body);
      res.json({ success: true, data: policy });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  },

  /**
   * GET /api/no-show/clients — all client no-show stats (staff only)
   */
  async listClientStats(req, res) {
    try {
      const data = await noShowService.listAllStats();
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  },

  /**
   * GET /api/no-show/client/:clientId — per-client stats
   */
  async getClientStats(req, res) {
    try {
      const data = await noShowService.getClientStats(req.params.clientId);
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  },
};

module.exports = noShowController;
