/**
 * bookingController.js
 * Thin HTTP layer for the Smart Frictionless Booking & Intake module.
 */
const bookingService = require('../services/bookingService');

function errStatus(err) {
  const m = (err.message || '').toLowerCase();
  if (m.includes('access denied') || m.includes('cannot')) return 403;
  if (m.includes('not found'))                              return 404;
  if (m.includes('required') || m.includes('invalid') || m.includes('unknown')) return 400;
  return 500;
}
const fail = (res, e) => res.status(errStatus(e)).json({ success: false, error: e.message });

const bookingController = {

  async listReasons(_req, res) {
    try {
      const data = await bookingService.listReasons();
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },

  async getAvailableSlots(req, res) {
    try {
      const data = await bookingService.getAvailableSlots(req.query.vetId, req.query.date, {
        slotMins: req.query.slotMins ? parseInt(req.query.slotMins, 10) : null,
      });
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },

  async suggestVets(req, res) {
    try {
      const data = await bookingService.suggestVets({
        reasonCode:    req.query.reasonCode,
        date:          req.query.date,
        preferredTime: req.query.preferredTime || null,
        limit:         parseInt(req.query.limit || '5', 10),
      });
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },

  async createBooking(req, res) {
    try {
      const data = await bookingService.createBooking(req.user.id, req.user.role, req.body);
      res.status(201).json({ success: true, data });
    } catch (e) { fail(res, e); }
  },

  async submitIntake(req, res) {
    try {
      const data = await bookingService.submitIntake(req.user.id, req.user.role, req.body);
      res.status(201).json({ success: true, data });
    } catch (e) { fail(res, e); }
  },

  async getIntake(req, res) {
    try {
      const data = await bookingService.getIntakeByAppointment(req.params.appointmentId, req.user.id, req.user.role);
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },

  async vetUpcoming(req, res) {
    try {
      const data = await bookingService.vetUpcoming(req.user.id, req.user.role, {
        days: parseInt(req.query.days || '7', 10),
      });
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },

  async retriage(req, res) {
    try {
      const data = await bookingService.retriage(req.params.appointmentId, req.user.id, req.user.role, req.body.urgency);
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },

};

module.exports = bookingController;
