const clientService = require('../services/clientService');

const clientController = {
  async register(req, res) {
    try {
      const { name, email, password, contactNumber, address, pet } = req.body;
      const result = await clientService.register({ name, email, password, contactNumber, address, pet });
      return res.status(201).json({ success: true, message: 'Registration successful', data: result });
    } catch (err) {
      console.error('[clientController.register]', err.message);
      const isDuplicate = err.message.toLowerCase().includes('already registered') ||
                          err.message.toLowerCase().includes('already exists');
      return res.status(isDuplicate ? 409 : 400).json({
        success: false,
        error: isDuplicate ? 'An account with this email already exists.' : err.message,
      });
    }
  },

  async getDashboard(req, res) {
    try {
      const data = await clientService.getDashboard(req.user.id);
      return res.status(200).json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  async getPets(req, res) {
    try {
      const pets = await clientService.getPets(req.user.id);
      return res.status(200).json({ success: true, data: pets });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  async getPetRecord(req, res) {
    try {
      const data = await clientService.getPetRecord(req.user.id, req.params.petId);
      return res.status(200).json({ success: true, data });
    } catch (err) {
      return res.status(err.message.includes('not found') ? 404 : 500).json({ success: false, error: err.message });
    }
  },

  async getAnalytics(req, res) {
    try {
      const data = await clientService.getAnalytics(req.user.id);
      return res.status(200).json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  async addPet(req, res) {
    try {
      const pet = await clientService.addPet(req.user.id, req.body);
      return res.status(201).json({ success: true, data: pet });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  },

  async getAppointments(req, res) {
    try {
      const appointments = await clientService.getAppointments(req.user.id);
      return res.status(200).json({ success: true, data: appointments });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  async bookAppointment(req, res) {
    try {
      const appointment = await clientService.bookAppointment(req.user.id, req.body);
      return res.status(201).json({ success: true, data: appointment });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  },

  async updateSmsOptIn(req, res) {
    try {
      const data = await clientService.updateSmsOptIn(req.user.id, req.body.sms_opt_in);
      return res.json({ success: true, data });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  },
};

module.exports = clientController;
