/**
 * appointmentController.js
 * HTTP layer for appointment operations.
 */
const appointmentService = require('../services/appointmentService');

const appointmentController = {
  /**
   * POST /api/appointments
   * Book a new appointment (client only)
   */
  async book(req, res) {
    try {
      const appt = await appointmentService.book(req.user.id, req.body);
      res.status(201).json({ success: true, data: appt });
    } catch (err) {
      const isConflict = err.message.includes('already booked') || err.message.includes('slot was just taken');
      res.status(isConflict ? 409 : 400).json({ success: false, error: err.message });
    }
  },

  /**
   * GET /api/appointments
   * Get appointments (filtered by role automatically)
   */
  async getAll(req, res) {
    try {
      const filters = {
        status: req.query.status || null,
        vetId:  req.query.vetId  || null,
        date:   req.query.date   || null,
      };
      const appointments = await appointmentService.getAll(req.user.id, req.user.role, filters);
      res.json({ success: true, data: appointments });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * GET /api/appointments/:id
   * Get single appointment detail
   */
  async getById(req, res) {
    try {
      const appt = await appointmentService.getById(req.params.id, req.user.id, req.user.role);
      res.json({ success: true, data: appt });
    } catch (err) {
      res.status(err.message === 'Access denied.' ? 403 : 404).json({ success: false, error: err.message });
    }
  },

  /**
   * PATCH /api/appointments/:id/status
   * Update appointment status (role-restricted)
   */
  async updateStatus(req, res) {
    try {
      const { status, reason } = req.body;
      if (!status) return res.status(400).json({ success: false, error: 'status is required' });
      const updated = await appointmentService.updateStatus(
        req.params.id, status, req.user.id, req.user.role, reason
      );
      res.json({ success: true, data: updated });
    } catch (err) {
      const code = err.message.includes('Access denied') ? 403
        : err.message.includes('Cannot change') ? 422 : 400;
      res.status(code).json({ success: false, error: err.message });
    }
  },

  /**
   * PATCH /api/appointments/:id/reschedule
   * Reschedule an appointment to a new date/time (optionally different vet)
   */
  async reschedule(req, res) {
    try {
      const updated = await appointmentService.reschedule(
        req.params.id, req.body, req.user.id, req.user.role
      );
      res.json({ success: true, data: updated });
    } catch (err) {
      const code = err.message.includes('Access denied') ? 403
        : err.message.includes('not found') ? 404
        : err.message.includes('Cannot reschedule') ? 422 : 400;
      res.status(code).json({ success: false, error: err.message });
    }
  },

  /**
   * PATCH /api/appointments/:id/cancel
   * Client cancels their own appointment
   */
  async cancel(req, res) {
    try {
      const { reason } = req.body;
      const updated = await appointmentService.updateStatus(
        req.params.id, 'cancelled', req.user.id, req.user.role, reason
      );
      res.json({ success: true, data: updated });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  },
};

module.exports = appointmentController;
