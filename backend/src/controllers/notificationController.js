const notificationService = require('../services/notificationService');

const notificationController = {
  async getAll(req, res) {
    try {
      const notifications = await notificationService.getForUser(req.user.id);
      const unread = notifications.filter(n => !n.is_read).length;
      res.json({ success: true, data: notifications, unread });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async markRead(req, res) {
    try {
      await notificationService.markRead(req.params.id, req.user.id);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  },

  async markAllRead(req, res) {
    try {
      await notificationService.markAllRead(req.user.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
};

module.exports = notificationController;
