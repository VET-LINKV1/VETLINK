/**
 * confinementRoutes.js
 * REST API for Pet Confinement / Boarding & Hospitalization.
 *
 * Base path: /api/confinements
 *
 * Roles:
 *   admin / vet / staff   full read + write (admit, log, discharge)
 *   client                read own pets' confinements + logs only
 */
const { Router } = require('express');
const ctl  = require('../controllers/confinementController');
const auth = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');
const { validateBody }   = require('../validations/confinementValidation');

const router = Router();
router.use(auth);

const STAFF = ['admin', 'veterinarian', 'staff'];

router.get('/',                 ctl.list);
router.get('/pets/:petId',      ctl.listForPet);
router.get('/:id',              ctl.getById);
router.post('/',
  roleMiddleware(STAFF), validateBody('admit'),      ctl.admit);
router.put('/:id',
  roleMiddleware(STAFF), validateBody('update'),     ctl.update);
router.post('/:id/discharge',
  roleMiddleware(STAFF), validateBody('discharge'),  ctl.discharge);
router.post('/:id/cancel',
  roleMiddleware(STAFF), validateBody('cancel'),     ctl.cancel);

router.get('/:id/logs',         ctl.listLogs);
router.post('/:id/logs',
  roleMiddleware(STAFF), validateBody('addLog'),     ctl.addLog);

module.exports = router;
