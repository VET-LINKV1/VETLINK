/**
 * passportController.js
 * Thin HTTP layer for the Multi-Pet Digital Health Passport.
 */
const passportService = require('../services/passportService');
const config = require('../config/env');

function errStatus(err) {
  const m = (err.message || '').toLowerCase();
  if (m.includes('access denied') || m.includes('not your pet')) return 403;
  if (m.includes('not found') || m.includes('invalid share link')) return 404;
  if (m.includes('expired') || m.includes('revoked'))              return 410;
  if (m.includes('required') || m.includes('out of range'))        return 400;
  return 500;
}
const fail = (res, e) => res.status(errStatus(e)).json({ success: false, error: e.message });

function appBaseUrl(req) {
  // Prefer FRONTEND_URL env; otherwise derive from the request.
  return config.cors.frontendUrl || `${req.protocol}://${req.get('host').replace(':5000', ':5173')}`;
}

const passportController = {

  /* Dashboard */
  async listClientPassports(req, res) {
    try {
      const data = await passportService.listClientPassports(req.user.id, req.user.role, {
        clientId: req.query.clientId || null,
      });
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },

  /* Passport */
  async getPetPassport(req, res) {
    try {
      const data = await passportService.getPetPassport(req.params.petId, req.user.id, req.user.role);
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },

  /* Weights */
  async listWeights(req, res) {
    try {
      const data = await passportService.listWeights(req.params.petId, req.user.id, req.user.role);
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },
  async addWeight(req, res) {
    try {
      const data = await passportService.addWeight(req.user.id, req.user.role, req.body);
      res.status(201).json({ success: true, data });
    } catch (e) { fail(res, e); }
  },
  async deleteWeight(req, res) {
    try {
      const data = await passportService.deleteWeight(req.params.id, req.user.role);
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },

  /* Shares */
  async createShare(req, res) {
    try {
      const data = await passportService.createShare(
        req.user.id, req.user.role, req.body,
        { appBaseUrl: appBaseUrl(req) }
      );
      res.status(201).json({ success: true, data });
    } catch (e) { fail(res, e); }
  },
  async listSharesForPet(req, res) {
    try {
      const data = await passportService.listSharesForPet(req.params.petId, req.user.id, req.user.role);
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },
  async revokeShare(req, res) {
    try {
      const data = await passportService.revokeShare(req.params.id, req.user.id, req.user.role);
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },

  /* Public — token-gated, no auth */
  async getByShareToken(req, res) {
    try {
      const data = await passportService.getByShareToken(req.params.token);
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },

};

module.exports = passportController;
