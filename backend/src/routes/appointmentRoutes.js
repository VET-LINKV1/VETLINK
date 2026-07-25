const { Router } = require('express');
const appointmentController = require('../controllers/appointmentController');
const authMiddleware = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');
const { validateBody } = require('../validations/appointmentValidation');

const router = Router();
router.use(authMiddleware);

// Book — clients only
router.post('/',     roleMiddleware('client'), validateBody('book'), appointmentController.book);

// Read — all roles (service filters by role)
router.get('/',      appointmentController.getAll);
router.get('/:id',   appointmentController.getById);

// Status updates
router.patch('/:id/status', roleMiddleware('admin','staff','veterinarian'), validateBody('updateStatus'), appointmentController.updateStatus);
router.patch('/:id/cancel', validateBody('cancel'), appointmentController.cancel);
router.patch('/:id/reschedule', validateBody('reschedule'), appointmentController.reschedule);

module.exports = router;
