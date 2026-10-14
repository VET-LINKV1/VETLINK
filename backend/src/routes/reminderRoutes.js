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

/**
 * Vercel Cron calls these URLs with `Authorization: Bearer <CRON_SECRET>`
 * (set CRON_SECRET in the Vercel project's environment variables) — there is
 * no logged-in user, so accept the secret instead. Logged-in admins can still
 * trigger the same endpoints manually.
 */
function cronOrAdmin(req, res, next) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.get('authorization') === `Bearer ${secret}`) return next();
  return auth(req, res, (err) => (err ? next(err) : roleMiddleware('admin')(req, res, next)));
}

// ── Cron (Vercel cron secret OR admin) ──────────────────────────
// Vercel cron uses GET; manual/admin triggers use POST.
router.all('/cron',              cronOrAdmin, ctrl.sendUpcoming);
router.all('/vaccination-cron',  cronOrAdmin, ctrl.sendVaccination);
router.all('/telehealth-cron',   cronOrAdmin, ctrl.sendTelehealth);

router.use(auth);

// ── Client-facing ───────────────────────────────────────────────
router.get('/mine',               roleMiddleware('client'),          ctrl.listMine);
router.get('/summary',            roleMiddleware('client','admin','staff'), ctrl.getSummary);

// ── Staff / Admin ───────────────────────────────────────────────
router.get('/owner/:ownerId',     roleMiddleware('admin','staff'),   ctrl.listForOwner);
router.get('/pet/:petId',                                            ctrl.listForPet);
router.get('/templates',          roleMiddleware('admin'),           ctrl.getTemplates);

module.exports = router;
