const adminService = require('../services/adminService');
const reminderService = require('../services/reminderService');
const smsService = require('../services/smsService');

const adminController = {
  async getStats(req, res) {
    try {
      const stats = await adminService.getStats();
      res.json({ success: true, data: stats });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
  async getStaff(req, res) {
    try {
      const staff = await adminService.getStaff();
      res.json({ success: true, data: staff });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
  async sendReminders(req, res) {
    try {
      const result = await reminderService.sendUpcomingReminders();
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
  async smsStatus(req, res) {
    res.json({
      success: true,
      data: {
        live: smsService.isLive(),
        provider: smsService.provider(),
      },
    });
  },
};

module.exports = adminController;
