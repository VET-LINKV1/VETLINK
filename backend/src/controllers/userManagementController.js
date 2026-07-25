/**
 * userManagementController.js
 * Thin handlers around userManagementService. All routes are admin-only.
 */
const svc = require('../services/userManagementService');

function errStatus(msg = '') {
  const m = msg.toLowerCase();
  if (m.includes('not found'))    return 404;
  if (m.includes('invalid'))      return 400;
  if (m.includes('forbidden'))    return 403;
  if (m.includes('already'))      return 409;
  return 400;
}

const userManagementController = {
  listUsers: async (req, res) => {
    try {
      const { q, role, status, limit, offset, sort, dir } = req.query;
      const data = await svc.listUsers({
        q: q || '',
        role: role || null,
        status: status || 'all',
        limit: Number(limit)  || 50,
        offset: Number(offset) || 0,
        sort: sort || 'created_at',
        dir:  dir  || 'desc',
      });
      res.json({ success: true, data });
    } catch (e) { res.status(errStatus(e.message)).json({ success: false, error: e.message }); }
  },

  getUser: async (req, res) => {
    try {
      const data = await svc.getUser(req.params.id);
      res.json({ success: true, data });
    } catch (e) { res.status(errStatus(e.message)).json({ success: false, error: e.message }); }
  },

  getUserActivity: async (req, res) => {
    try {
      const data = await svc.getUserActivity(req.params.id);
      res.json({ success: true, data });
    } catch (e) { res.status(errStatus(e.message)).json({ success: false, error: e.message }); }
  },

  listAudit: async (req, res) => {
    try {
      const data = await svc.listAuditLog({
        limit: Number(req.query.limit)  || 100,
        offset: Number(req.query.offset) || 0,
      });
      res.json({ success: true, data });
    } catch (e) { res.status(errStatus(e.message)).json({ success: false, error: e.message }); }
  },

  createUser: async (req, res) => {
    try {
      const data = await svc.createUser(req.user.id, req.body);
      res.status(201).json({ success: true, data });
    } catch (e) { res.status(errStatus(e.message)).json({ success: false, error: e.message }); }
  },

  updateUser: async (req, res) => {
    try {
      const data = await svc.updateUser(req.user.id, req.params.id, req.body);
      res.json({ success: true, data });
    } catch (e) { res.status(errStatus(e.message)).json({ success: false, error: e.message }); }
  },

  suspend: async (req, res) => {
    try {
      const data = await svc.setActive(req.user.id, req.params.id, false);
      res.json({ success: true, data });
    } catch (e) { res.status(errStatus(e.message)).json({ success: false, error: e.message }); }
  },

  reactivate: async (req, res) => {
    try {
      const data = await svc.setActive(req.user.id, req.params.id, true);
      res.json({ success: true, data });
    } catch (e) { res.status(errStatus(e.message)).json({ success: false, error: e.message }); }
  },

  verify: async (req, res) => {
    try {
      const data = await svc.forceVerify(req.user.id, req.params.id);
      res.json({ success: true, data });
    } catch (e) { res.status(errStatus(e.message)).json({ success: false, error: e.message }); }
  },

  resetPassword: async (req, res) => {
    try {
      const data = await svc.sendPasswordReset(req.user.id, req.params.id);
      res.json({ success: true, data });
    } catch (e) { res.status(errStatus(e.message)).json({ success: false, error: e.message }); }
  },

  deleteUser: async (req, res) => {
    try {
      // Safety: an admin cannot delete themselves.
      if (req.params.id === req.user.id) {
        return res.status(400).json({ success: false, error: 'You cannot delete your own account.' });
      }
      const data = await svc.deleteUser(req.user.id, req.params.id);
      res.json({ success: true, data });
    } catch (e) { res.status(errStatus(e.message)).json({ success: false, error: e.message }); }
  },

  bulkImport: async (req, res) => {
    try {
      const { users, send_invite } = req.body;
      if (!Array.isArray(users) || !users.length) {
        return res.status(400).json({ success: false, error: 'No users to import.' });
      }
      const data = await svc.bulkImport(req.user.id, users, { send_invite });
      res.json({ success: true, data });
    } catch (e) { res.status(errStatus(e.message)).json({ success: false, error: e.message }); }
  },
};

module.exports = userManagementController;
