/**
 * reminderRoutes.js
 *
 * Vaccination/Deworming reminder API.
 * Base path: /api/reminders
 */
const { Router } = require('express');
const ctrl = require('../controllers/reminderController');
const auth = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');

const router = Router();
router.use(auth);

// ── Cron (admin only) ───────────────────────────────────────────
router.post('/cron',              roleMiddleware('admin'),           ctrl.sendUpcoming);
router.post('/vaccination-cron',  roleMiddleware('admin'),           ctrl.sendVaccination);
router.post('/telehealth-cron',   roleMiddleware('admin'),           ctrl.sendTelehealth);

// ── Client-facing ───────────────────────────────────────────────
router.get('/mine',               roleMiddleware('client'),          ctrl.listMine);
router.get('/summary',            roleMiddleware('client','admin','staff'), ctrl.getSummary);

// ── Staff / Admin ───────────────────────────────────────────────
router.get('/owner/:ownerId',     roleMiddleware('admin','staff'),   ctrl.listForOwner);
router.get('/pet/:petId',                                            ctrl.listForPet);
router.get('/templates',          roleMiddleware('admin'),           ctrl.getTemplates);

module.exports = router;
