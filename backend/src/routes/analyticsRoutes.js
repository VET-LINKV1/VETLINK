/**
 * analyticsRoutes.js
 * Mounted at /api/analytics  (see backend/src/index.js)
 *
 * GET /api/analytics/health-check          → role-appropriate report (auto)
 * GET /api/analytics/health-check/admin    → admin only
 * GET /api/analytics/health-check/vet      → vet  (admin can pass ?vetId=)
 * GET /api/analytics/health-check/staff    → staff/admin
 * GET /api/analytics/health-check/client   → client (staff/admin can pass ?clientId=)
 *
 * All endpoints accept optional ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD.
 * Defaults: trailing 90 days.
 */
const { Router } = require('express');
const analyticsController = require('../controllers/analyticsController');
const authMiddleware = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');

const router = Router();
router.use(authMiddleware);

// Auto-routed by caller's role
router.get('/health-check',          analyticsController.me);

router.get('/health-check/admin',    roleMiddleware('admin'),                                analyticsController.admin);
router.get('/health-check/vet',      roleMiddleware('veterinarian','admin'),                 analyticsController.vet);
router.get('/health-check/staff',    roleMiddleware('staff','admin'),                        analyticsController.staff);
router.get('/health-check/client',   roleMiddleware('client','admin','staff'),               analyticsController.client);

module.exports = router;
