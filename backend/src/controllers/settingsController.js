/**
 * settingsController.js
 * Handlers for the admin Settings module. Thin wrappers around settingsService.
 * All routes are admin-only (enforced by roleMiddleware('admin') in the router).
 */
const svc = require('../services/settingsService');

function errStatus(msg = '') {
  const m = msg.toLowerCase();
  if (m.includes('not found')) return 404;
  if (m.includes('invalid'))   return 400;
  if (m.includes('required'))  return 400;
  if (m.includes('forbidden')) return 403;
  return 400;
}

function wrap(handler) {
  return async (req, res) => {
    try {
      const data = await handler(req, res);
      res.json({ success: true, data });
    } catch (e) {
      res.status(errStatus(e.message)).json({ success: false, error: e.message });
    }
  };
}

const settingsController = {
  // Single config section (GET /:section)
  getSection: wrap(async (req) => svc.getSection(req.params.section)),

  // Update a config section (PUT /:section)
  updateSection: wrap(async (req) => svc.updateSection(req.params.section, req.body, req.user.id)),

  // Reset section to defaults (POST /:section/reset)
  resetSection: wrap(async (req) => svc.resetSection(req.params.section, req.user.id)),

  // ── Roles & Permissions ──
  getRoles: wrap(async () => svc.getRolesAndPermissions()),
  updatePermission: wrap(async (req) => {
    const { role, module, perm, value } = req.body;
    if (role === undefined || module === undefined || perm === undefined || value === undefined) {
      throw new Error('role, module, perm, and value are required');
    }
    return svc.updatePermission(req.user.id, role, module, perm, value);
  }),
  setRolePermissions: wrap(async (req) => {
    const { role, permissions } = req.body; // permissions: { [module]: { perm: bool } }
    if (!role || !permissions) throw new Error('role and permissions are required');
    return svc.setRolePermissions(req.user.id, role, permissions);
  }),

  // ── Branches & Rooms ──
  getBranches: wrap(async () => svc.getBranches()),
  createBranch: wrap(async (req) => svc.createBranch(req.user.id, req.body)),
  updateBranch: wrap(async (req) => svc.updateBranch(req.user.id, req.params.id, req.body)),
  deleteBranch: wrap(async (req) => { await svc.deleteBranch(req.user.id, req.params.id); return { ok: true }; }),
  createRoom: wrap(async (req) => svc.createRoom(req.user.id, req.body)),
  updateRoom: wrap(async (req) => svc.updateRoom(req.user.id, req.params.id, req.body)),
  deleteRoom: wrap(async (req) => { await svc.deleteRoom(req.user.id, req.params.id); return { ok: true }; }),

  // ── Audit log ──
  listAudit: wrap(async (req) => svc.listAuditLog({
    limit:  Number(req.query.limit)  || 100,
    offset: Number(req.query.offset) || 0,
    action: req.query.action || null,
    q:      req.query.q || null,
  })),

  // ── Connection tests ──
  testSms: wrap(async (req) => {
    const { phone, message } = req.body;
    return svc.testSms(phone, message);
  }),
  paymongoStatus: wrap(async () => svc.getPaymongoStatus()),
};

module.exports = settingsController;
