/**
 * confinementController.js
 * Thin HTTP layer for the Pet Confinement / Boarding module.
 */
const svc = require('../services/confinementService');

function errStatus(err) {
  const m = (err.message || '').toLowerCase();
  if (m.includes('access denied'))     return 403;
  if (m.includes('not found'))         return 404;
  if (m.includes('already has an active')) return 409;
  if (m.includes('required') || m.includes('only an active')
      || m.includes('nothing to update')) return 400;
  return 500;
}
const fail = (res, e) => res.status(errStatus(e)).json({ success: false, error: e.message });

const confinementController = {
  async list(req, res) {
    try {
      const data = await svc.list(req.user.id, req.user.role, {
        status: req.query.status || undefined,
        petId:  req.query.petId  || undefined,
      });
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },
  async listForPet(req, res) {
    try { res.json({ success: true, data: await svc.listForPet(req.params.petId, req.user.id, req.user.role) }); }
    catch (e) { fail(res, e); }
  },
  async getById(req, res) {
    try { res.json({ success: true, data: await svc.getById(req.params.id, req.user.id, req.user.role) }); }
    catch (e) { fail(res, e); }
  },
  async admit(req, res) {
    try { res.status(201).json({ success: true, data: await svc.admit(req.user.id, req.user.role, req.body) }); }
    catch (e) { fail(res, e); }
  },
  async update(req, res) {
    try { res.json({ success: true, data: await svc.update(req.user.id, req.user.role, req.params.id, req.body) }); }
    catch (e) { fail(res, e); }
  },
  async discharge(req, res) {
    try { res.json({ success: true, data: await svc.discharge(req.user.id, req.user.role, req.params.id, req.body) }); }
    catch (e) { fail(res, e); }
  },
  async cancel(req, res) {
    try { res.json({ success: true, data: await svc.cancel(req.user.id, req.user.role, req.params.id, req.body) }); }
    catch (e) { fail(res, e); }
  },
  async listLogs(req, res) {
    try { res.json({ success: true, data: await svc.listLogs(req.params.id, req.user.id, req.user.role) }); }
    catch (e) { fail(res, e); }
  },
  async addLog(req, res) {
    try { res.status(201).json({ success: true, data: await svc.addLog(req.user.id, req.user.role, req.params.id, req.body) }); }
    catch (e) { fail(res, e); }
  },
};

module.exports = confinementController;
