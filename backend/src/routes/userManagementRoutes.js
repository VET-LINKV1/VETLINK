/**
 * userManagementRoutes.js
 * Admin-only REST API for managing users.
 *
 * Base path: /api/admin/users
 */
const { Router } = require('express');
const ctl  = require('../controllers/userManagementController');
const auth = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');
const { validateBody }   = require('../validations/userManagementValidation');

const router = Router();
router.use(auth);
router.use(roleMiddleware('admin'));   // every endpoint here is admin-only

/* Audit log (mounted before /:id so it doesn't collide) */
router.get('/audit',                      ctl.listAudit);

/* List + CRUD */
router.get('/',                           ctl.listUsers);
router.post('/',
  validateBody('createUser'),             ctl.createUser);

router.post('/bulk-import',
  validateBody('bulkImport'),             ctl.bulkImport);

router.get('/:id',                        ctl.getUser);
router.get('/:id/activity',               ctl.getUserActivity);
router.patch('/:id',
  validateBody('updateUser'),             ctl.updateUser);
router.delete('/:id',                     ctl.deleteUser);

/* Lifecycle actions */
router.post('/:id/suspend',               ctl.suspend);
router.post('/:id/reactivate',            ctl.reactivate);
router.post('/:id/verify',                ctl.verify);
router.post('/:id/reset-password',        ctl.resetPassword);

module.exports = router;
