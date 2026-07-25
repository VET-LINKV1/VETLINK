/**
 * predictiveRoutes.js
 * Mounted at /api/predictive  (see backend/src/index.js)
 *
 * Predictive Analytics — ADMIN ONLY.
 *
 *   GET /api/predictive/summary         → all four modules in one payload
 *   GET /api/predictive/churn           → client churn predictions
 *   GET /api/predictive/inventory       → seasonal medicine/supply forecast
 *   GET /api/predictive/appointments    → monthly + density forecast
 *   GET /api/predictive/treatment-risk  → pet treatment-risk predictions
 *
 * Query params:
 *   horizon  — months to forecast (1..12, default 6).
 *   band     — comma-separated risk bands to keep in /churn (e.g. "high,critical").
 */
const { Router } = require('express');
const predictiveController = require('../controllers/predictiveController');
const authMiddleware = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware('admin'));

router.get('/summary',         predictiveController.summary);
router.get('/churn',           predictiveController.churn);
router.get('/inventory',       predictiveController.inventory);
router.get('/appointments',    predictiveController.appointments);
router.get('/treatment-risk',  predictiveController.treatmentRisk);

module.exports = router;
