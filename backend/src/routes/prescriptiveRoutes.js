/**
 * prescriptiveRoutes.js
 * Mounted at /api/prescriptive  (see backend/src/index.js)
 *
 * Prescriptive Analytics — ADMIN or VETERINARIAN.
 *
 *   GET  /api/prescriptive/summary       → all three modules in one payload
 *   GET  /api/prescriptive/scheduling    → conflicts + equipment + vet load
 *   GET  /api/prescriptive/wellness      → per-pet wellness plans
 *   GET  /api/prescriptive/ordering      → purchase-order recommendations
 *   POST /api/prescriptive/recommendations  → persist a snapshot of recommendations
 *
 * Query params:
 *   horizonDays — days of demand to cover (7..180, default 30). /ordering and /summary.
 *   petId / ownerId / species — filter /wellness.
 */
const { Router } = require('express');
const prescriptiveController = require('../controllers/prescriptiveController');
const authMiddleware = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware('admin'));

router.get('/summary',       prescriptiveController.summary);
router.get('/scheduling',    prescriptiveController.scheduling);
router.get('/wellness',      prescriptiveController.wellness);
router.get('/ordering',      prescriptiveController.ordering);

router.post('/recommendations', prescriptiveController.save);

module.exports = router;
