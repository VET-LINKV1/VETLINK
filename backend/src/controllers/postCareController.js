/**
 * postCareController.js
 * Thin HTTP layer for the Post-Care & Pharmacy Hub.
 */
const svc = require('../services/postCareService');

function errStatus(err) {
  const m = (err.message || '').toLowerCase();
  if (m.includes('access denied'))                                return 403;
  if (m.includes('not found'))                                    return 404;
  if (m.includes('already exists') || m.includes('only pending')) return 409;
  if (m.includes('required') || m.includes('only active')
      || m.includes('no refills') || m.includes('nothing to update')) return 400;
  return 500;
}
const fail = (res, e) => res.status(errStatus(e)).json({ success: false, error: e.message });

const postCareController = {

  // Discharge
  async getDischarge(req, res) {
    try { res.json({ success: true, data: await svc.getDischargeByAppointment(req.params.appointmentId, req.user.id, req.user.role) }); }
    catch (e) { fail(res, e); }
  },
  async listDischarges(req, res) {
    try { res.json({ success: true, data: await svc.listDischargesForPet(req.params.petId, req.user.id, req.user.role) }); }
    catch (e) { fail(res, e); }
  },
  async upsertDischarge(req, res) {
    try { res.status(201).json({ success: true, data: await svc.upsertDischarge(req.user.id, req.user.role, req.body) }); }
    catch (e) { fail(res, e); }
  },
  async attachFile(req, res) {
    try { res.status(201).json({ success: true, data: await svc.attachDischargeFile(req.user.id, req.user.role, req.params.dischargeId, req.body.fileId) }); }
    catch (e) { fail(res, e); }
  },
  async detachFile(req, res) {
    try { res.json({ success: true, data: await svc.detachDischargeFile(req.user.role, req.params.joinId) }); }
    catch (e) { fail(res, e); }
  },

  // Refills
  async requestRefill(req, res) {
    try { res.status(201).json({ success: true, data: await svc.requestRefill(req.user.id, req.user.role, req.body) }); }
    catch (e) { fail(res, e); }
  },
  async myRefills(req, res) {
    try { res.json({ success: true, data: await svc.listMyRefillRequests(req.user.id, req.user.role) }); }
    catch (e) { fail(res, e); }
  },
  async pharmacyQueue(req, res) {
    try {
      const status = req.query.status || 'pending';
      res.json({ success: true, data: await svc.listPharmacyQueue(req.user.role, { status }) });
    } catch (e) { fail(res, e); }
  },
  async approveRefill(req, res) {
    try { res.json({ success: true, data: await svc.approveRefill(req.user.id, req.user.role, req.params.id, { pickupReadyAt: req.body.pickupReadyAt }) }); }
    catch (e) { fail(res, e); }
  },
  async denyRefill(req, res) {
    try { res.json({ success: true, data: await svc.denyRefill(req.user.id, req.user.role, req.params.id, req.body.denialReason) }); }
    catch (e) { fail(res, e); }
  },
  async dispenseRefill(req, res) {
    try { res.json({ success: true, data: await svc.markRefillDispensed(req.user.id, req.user.role, req.params.id) }); }
    catch (e) { fail(res, e); }
  },
  async cancelRefill(req, res) {
    try { res.json({ success: true, data: await svc.cancelRefill(req.user.id, req.user.role, req.params.id) }); }
    catch (e) { fail(res, e); }
  },

  // Reminders
  async listReminders(req, res) {
    try {
      const ownerId = req.query.ownerId || req.user.id;
      res.json({ success: true, data: await svc.listRemindersForOwner(ownerId, req.user.id, req.user.role) });
    } catch (e) { fail(res, e); }
  },
  async createReminder(req, res) {
    try { res.status(201).json({ success: true, data: await svc.createReminder(req.user.id, req.user.role, req.body) }); }
    catch (e) { fail(res, e); }
  },
  async updateReminder(req, res) {
    try { res.json({ success: true, data: await svc.updateReminder(req.params.id, req.user.id, req.user.role, req.body) }); }
    catch (e) { fail(res, e); }
  },
  async deleteReminder(req, res) {
    try { res.json({ success: true, data: await svc.deleteReminder(req.params.id, req.user.id, req.user.role) }); }
    catch (e) { fail(res, e); }
  },
  async dispatchTick(_req, res) {
    try { res.json({ success: true, data: await svc.tickReminders() }); }
    catch (e) { fail(res, e); }
  },
  async dispatchLog(req, res) {
    try { res.json({ success: true, data: await svc.getDispatchLog(req.params.id, req.user.id, req.user.role) }); }
    catch (e) { fail(res, e); }
  },

};

module.exports = postCareController;
