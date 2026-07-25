const profileService = require('../services/profileService');

const profileController = {
  async getProfile(req, res) {
    try {
      const profile = await profileService.getProfile(req.user.id);
      res.json({ success: true, data: profile });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
  async updateProfile(req, res) {
    try {
      const updated = await profileService.updateProfile(req.user.id, req.body);
      res.json({ success: true, data: updated });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  },
  async uploadAvatar(req, res) {
    try {
      if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
      const result = await profileService.uploadAvatar(req.user.id, req.file);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
};

module.exports = profileController;
