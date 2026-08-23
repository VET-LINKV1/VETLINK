/**
 * settingsRoutes.js
 * Admin Settings module REST API. Mounted at /api/admin/settings.
 *
 * All endpoints require an authenticated admin (authMiddleware + roleMiddleware).
 */
const { Router } = require('express');
const ctl  = require('../controllers/settingsController');
const auth = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');

const router = Router();
router.use(auth);
router.use(roleMiddleware('admin'));   // every endpoint here is admin-only

/* ── Config sections (single-row each) ──────────────────────────────────────
 * Valid sections: clinic, appointments, pets, prescriptions, laboratory,
 * billing, notifications, security, system.
 */
router.get('/:section',          ctl.getSection);
router.put('/:section',          ctl.updateSection);
router.post('/:section/reset',   ctl.resetSection);

/* ── Roles & Permissions ─────────────────────────────────────────────────── */
router.get('/roles/list',        ctl.getRoles);
router.post('/roles/permission', ctl.updatePermission);
router.post('/roles/permissions',ctl.setRolePermissions);

/* ── Branches & Rooms ────────────────────────────────────────────────────── */
router.get('/branches/list',     ctl.getBranches);
router.post('/branches',         ctl.createBranch);
router.put('/branches/:id',      ctl.updateBranch);
router.delete('/branches/:id',   ctl.deleteBranch);
router.post('/rooms',            ctl.createRoom);
router.put('/rooms/:id',         ctl.updateRoom);
router.delete('/rooms/:id',      ctl.deleteRoom);

/* ── Audit log (read-only) ───────────────────────────────────────────────── */
router.get('/audit/list',        ctl.listAudit);

/* ── Connection tests ────────────────────────────────────────────────────── */
router.post('/test/sms',         ctl.testSms);
router.get('/billing/paymongo',  ctl.paymongoStatus);

module.exports = router;
