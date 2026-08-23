const petService = require('../services/petService');
const { supabaseAdmin } = require('../config/supabase');

/**
 * Admin Pet Records controller.
 * All handlers require admin/staff/vet (enforced by roleMiddleware at the route).
 */
const adminPetController = {
  async listOwners(req, res) {
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('id, name, phone_number, email')
        .eq('role', 'client')
        .order('name', { ascending: true });
      if (error) throw new Error(error.message);
      res.json({ success: true, data: data || [] });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async list(req, res) {
    try {
      const {
        q, species, breed, gender, vaccinationStatus, vetName, branch,
        registeredFrom, registeredTo, active,
        sort = 'created_at', dir = 'desc', limit = 25, offset = 0,
      } = req.query;

      const data = await petService.listForAdmin({
        q: q || undefined,
        species: species || undefined,
        breed: breed || undefined,
        gender: gender || undefined,
        vaccinationStatus: vaccinationStatus || undefined,
        vetName: vetName || undefined,
        branch: branch || undefined,
        registeredFrom: registeredFrom || undefined,
        registeredTo: registeredTo || undefined,
        active: active === undefined ? undefined : active === 'true',
        sort, dir,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      });
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async stats(req, res) {
    try {
      const data = await petService.adminStats();
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async getRecord(req, res) {
    try {
      const data = await petService.getRecordForStaff(req.params.petId);
      res.json({ success: true, data });
    } catch (err) {
      res.status(err.message.includes('not found') ? 404 : 500)
        .json({ success: false, error: err.message });
    }
  },

  async create(req, res) {
    try {
      const pet = await petService.adminCreate(req.body);
      res.status(201).json({ success: true, data: pet });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  },

  async update(req, res) {
    try {
      const pet = await petService.adminUpdate(req.params.petId, req.body);
      res.json({ success: true, data: pet });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  },
};

module.exports = adminPetController;
