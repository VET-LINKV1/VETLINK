const petService = require('../services/petService');

const petController = {
  async getAll(req, res) {
    try {
      const pets = await petService.getAll(req.user.id, req.user.role);
      res.json({ success: true, data: pets });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async create(req, res) {
    try {
      const pet = await petService.create(req.user.id, req.body);
      res.status(201).json({ success: true, data: pet });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  },

  async update(req, res) {
    try {
      const pet = await petService.update(req.user.id, req.params.id, req.body);
      res.json({ success: true, data: pet });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  },
};

module.exports = petController;
