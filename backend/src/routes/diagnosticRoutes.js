/**
 * diagnosticRoutes.js
 * Mounted at /api/diagnostic  (see backend/src/index.js)
 *
 * Diagnostic Analytics (Root Cause) — ADMIN ONLY.
 *
 *   GET /api/diagnostic/summary           → all three modules in one payload
 *   GET /api/diagnostic/churn             → churn analysis with root-cause attribution
 *   GET /api/diagnostic/treatment         → treatment-effectiveness comparison
 *   GET /api/diagnostic/shrinkage         → inventory shrinkage / expiry / low-stock
 *
 * All endpoints accept optional ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD.
 * /treatment also accepts ?minCohort=N (default 2) to gate small cohorts.
 * Defaults: trailing 90 days.
 */
const { Router } = require('express');
const diagnosticController = require('../controllers/diagnosticController');
const authMiddleware = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');

const router = Router();

// Every route requires auth + admin role.
router.use(authMiddleware);
router.use(roleMiddleware('admin'));

router.get('/summary',    diagnosticController.summary);
router.get('/churn',      diagnosticController.churn);
router.get('/treatment',  diagnosticController.treatment);
router.get('/shrinkage',  diagnosticController.shrinkage);

module.exports = router;
