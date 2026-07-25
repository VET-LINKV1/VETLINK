const vetScheduleService = require('../services/vetScheduleService');

const vetScheduleController = {
  /**
   * GET /api/vet-schedule/vets
   * Get all vets with their weekly schedules (for booking form)
   */
  async getAllVets(req, res) {
    try {
      const vets = await vetScheduleService.getAllVetsWithSchedules();
      res.json({ success: true, data: vets });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * GET /api/vet-schedule/:vetId
   * Get a specific vet's weekly schedule
   */
  async getSchedule(req, res) {
    try {
      const schedule = await vetScheduleService.getSchedule(req.params.vetId);
      res.json({ success: true, data: schedule });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * GET /api/vet-schedule/:vetId/slots?date=YYYY-MM-DD
   * Get available time slots for a vet on a specific date
   */
  async getAvailableSlots(req, res) {
    try {
      const { vetId } = req.params;
      const { date }  = req.query;

      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ success: false, error: 'date query param required (YYYY-MM-DD)' });
      }

      const result = await vetScheduleService.getAvailableSlots(vetId, date);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * POST /api/vet-schedule
   * Set/update vet's schedule (vet or admin only)
   */
  async setSchedule(req, res) {
    try {
      // Vets can only set their own schedule; admins can set any
      const vetId = req.user.role === 'admin' ? (req.body.vetId || req.user.id) : req.user.id;
      const schedule = await vetScheduleService.setSchedule(vetId, req.body);
      res.status(201).json({ success: true, data: schedule });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  },

  /**
   * POST /api/vet-schedule/weekly
   * Set full weekly schedule at once
   */
  async setWeeklySchedule(req, res) {
    try {
      const vetId = req.user.role === 'admin' ? (req.body.vetId || req.user.id) : req.user.id;
      const { days } = req.body;

      if (!Array.isArray(days) || days.length === 0) {
        return res.status(400).json({ success: false, error: 'days array is required' });
      }

      const schedule = await vetScheduleService.setWeeklySchedule(vetId, days);
      res.status(201).json({ success: true, data: schedule });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  },
};

module.exports = vetScheduleController;
