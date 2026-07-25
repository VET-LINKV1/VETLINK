/**
 * noShowRoutes.js
 * No-show policy & auto-cancellation API.
 * Base path: /api/no-show
 */
const { Router } = require('express');
const ctrl = require('../controllers/noShowController');
const auth = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');
const { validateBody } = require('../validations/adminValidation');

const router = Router();
router.use(auth);

// Admin-only: sweep + policy management
router.post('/sweep',      roleMiddleware('admin'),           ctrl.runSweep);
router.get('/policy',      roleMiddleware('admin','staff'),   ctrl.getPolicy);
router.put('/policy',      roleMiddleware('admin'),           validateBody('noShowPolicy'), ctrl.updatePolicy);

// Staff/Admin: client no-show stats
router.get('/clients',     roleMiddleware('admin','staff'),   ctrl.listClientStats);
router.get('/client/:clientId', roleMiddleware('admin','staff'), ctrl.getClientStats);

module.exports = router;
