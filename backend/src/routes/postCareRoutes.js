/**
 * postCareRoutes.js
 * REST API for the Post-Care & Pharmacy Hub.
 *
 * Base path: /api/postcare
 *
 * Roles:
 *   admin / vet   full read + write
 *   staff         read + approve/deny refills + tick
 *   client        read own + refill request + own reminders
 */
const { Router } = require('express');
const ctl    = require('../controllers/postCareController');
const auth   = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');
const { validateBody }   = require('../validations/postCareValidation');

const router = Router();
router.use(auth);

const STAFF   = ['admin', 'veterinarian', 'staff'];
const WRITERS = ['admin', 'veterinarian'];

/* ──────────── Discharge instructions ──────────── */
router.get('/discharges/by-appointment/:appointmentId', ctl.getDischarge);
router.get('/discharges/pets/:petId',                   ctl.listDischarges);
router.put('/discharges',
  roleMiddleware(WRITERS), validateBody('upsertDischarge'), ctl.upsertDischarge);
router.post('/discharges/:dischargeId/files',
  roleMiddleware(WRITERS), validateBody('attachFile'),       ctl.attachFile);
router.delete('/discharges/files/:joinId',
  roleMiddleware(WRITERS),                                   ctl.detachFile);

/* ──────────── Refill requests ──────────── */
router.post('/refills',
  validateBody('requestRefill'),                             ctl.requestRefill);
router.get('/refills/mine',                                  ctl.myRefills);
router.get('/refills/queue',
  roleMiddleware(STAFF),                                     ctl.pharmacyQueue);
router.patch('/refills/:id/approve',
  roleMiddleware(STAFF), validateBody('approveRefill'),      ctl.approveRefill);
router.patch('/refills/:id/deny',
  roleMiddleware(STAFF), validateBody('denyRefill'),         ctl.denyRefill);
router.patch('/refills/:id/dispense',
  roleMiddleware(STAFF),                                     ctl.dispenseRefill);
router.patch('/refills/:id/cancel',                          ctl.cancelRefill);

/* ──────────── Medication reminders ──────────── */
router.get('/reminders',                                     ctl.listReminders);
router.post('/reminders',
  validateBody('createReminder'),                            ctl.createReminder);
router.patch('/reminders/:id',
  validateBody('updateReminder'),                            ctl.updateReminder);
router.delete('/reminders/:id',                              ctl.deleteReminder);
router.get('/reminders/:id/log',                             ctl.dispatchLog);

// Cron tick — staff/admin only. Wire to pg_cron or an external scheduler.
router.post('/reminders/tick',
  roleMiddleware(STAFF),                                     ctl.dispatchTick);

module.exports = router;
