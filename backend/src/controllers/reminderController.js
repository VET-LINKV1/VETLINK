/**
 * reminderController.js
 * HTTP layer for vaccination/deworming reminders.
 */
const reminderService = require('../services/reminderService');

const reminderController = {

  /**
   * POST /api/reminders/cron — appointment 24h sweep
   */
  async sendUpcoming(req, res) {
    try {
      const result = await reminderService.sendUpcomingReminders();
      res.json({ success: true, data: result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  },

  /**
   * POST /api/reminders/vaccination-cron — daily vaccination sweep
   */
  async sendVaccination(req, res) {
    try {
      const result = await reminderService.sendVaccinationReminders();
      res.json({ success: true, data: result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  },

  /**
   * GET /api/reminders/owner/:ownerId — client reminders
   * (staff/admin only, or client requesting their own)
   */
  async listForOwner(req, res) {
    try {
      const ownerId = req.params.ownerId || req.user.id;
      const data = await reminderService.listForOwner(
        ownerId, req.user.id, req.user.role,
        { daysAhead: parseInt(req.query.daysAhead || '90', 10) }
      );
      res.json({ success: true, data });
    } catch (e) {
      const code = e.message.includes('Access denied') ? 403 : 500;
      res.status(code).json({ success: false, error: e.message });
    }
  },

  /**
   * GET /api/reminders/mine — client gets their own reminders
   */
  async listMine(req, res) {
    try {
      const data = await reminderService.listForOwner(
        req.user.id, req.user.id, req.user.role,
        { daysAhead: parseInt(req.query.daysAhead || '90', 10) }
      );
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  },

  /**
   * GET /api/reminders/pet/:petId — per-pet reminder history
   */
  async listForPet(req, res) {
    try {
      const data = await reminderService.listForPet(
        req.params.petId, req.user.id, req.user.role
      );
      res.json({ success: true, data });
    } catch (e) {
      const code = e.message.includes('Access denied') ? 403 : 404;
      res.status(code).json({ success: false, error: e.message });
    }
  },

  /**
   * GET /api/reminders/summary — dashboard badge counts
   */
  async getSummary(req, res) {
    try {
      const data = await reminderService.getSummary(req.user.id, req.user.role);
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  },

  /**
   * GET /api/reminders/templates — reminder template list
   */
  async getTemplates(req, res) {
    try {
      const data = await reminderService.getTemplates();
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  },

  /**
   * POST /api/reminders/telehealth-cron — send telehealth SMS reminders
   */
  async sendTelehealth(req, res) {
    try {
      const result = await reminderService.sendTelehealthReminders();
      res.json({ success: true, data: result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  },
};

module.exports = reminderController;
