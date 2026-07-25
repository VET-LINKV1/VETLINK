const medicalRecordService = require('../services/medicalRecordService');

const medicalRecordController = {
  async create(req, res) {
    try {
      const record = await medicalRecordService.create(req.user.id, req.body, req.user.role);
      res.status(201).json({ success: true, data: record });
    } catch (err) {
      const code =
        err.message.includes('Access denied') ? 403 :
        err.message.includes('only')          ? 403 :
        err.message.includes('not found')     ? 404 : 400;
      res.status(code).json({ success: false, error: err.message });
    }
  },

  async getByPet(req, res) {
    try {
      const records = await medicalRecordService.getByPet(req.params.petId, req.user.id, req.user.role);
      res.json({ success: true, data: records });
    } catch (err) {
      res.status(err.message === 'Access denied.' ? 403 : 500).json({ success: false, error: err.message });
    }
  },

  async getById(req, res) {
    try {
      const record = await medicalRecordService.getById(req.params.id, req.user.id, req.user.role);
      res.json({ success: true, data: record });
    } catch (err) {
      res.status(err.message === 'Access denied.' ? 403 : 404).json({ success: false, error: err.message });
    }
  },

  async getMyRecords(req, res) {
    try {
      const filters = { petId: req.query.petId, startDate: req.query.startDate, endDate: req.query.endDate };
      const records = await medicalRecordService.getByVet(req.user.id, filters);
      res.json({ success: true, data: records });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async getClientHistory(req, res) {
    try {
      const result = await medicalRecordService.getClientHistory(req.user.id);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async update(req, res) {
    try {
      const updated = await medicalRecordService.update(req.params.id, req.user.id, req.body);
      res.json({ success: true, data: updated });
    } catch (err) {
      const code = err.message.includes('own') ? 403 : 400;
      res.status(code).json({ success: false, error: err.message });
    }
  },

  async getAll(req, res) {
    try {
      const filters = { vetId: req.query.vetId, petId: req.query.petId, startDate: req.query.startDate, endDate: req.query.endDate };
      const records = await medicalRecordService.getAllForAdmin(filters);
      res.json({ success: true, data: records });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
};

module.exports = medicalRecordController;
