const { Router } = require('express');
const medicalRecordController = require('../controllers/medicalRecordController');
const authMiddleware = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');

const router = Router();
router.use(authMiddleware);

// Vet only
router.post('/',             roleMiddleware('veterinarian','admin'), medicalRecordController.create);
router.get('/my-records',    roleMiddleware('veterinarian'),         medicalRecordController.getMyRecords);
router.put('/:id',           roleMiddleware('veterinarian','admin'), medicalRecordController.update);

// Client only
router.get('/history',       roleMiddleware('client'),               medicalRecordController.getClientHistory);

// Admin/Staff
router.get('/',              roleMiddleware('admin','staff'),        medicalRecordController.getAll);

// All authenticated (service enforces per-role access)
router.get('/pet/:petId',    medicalRecordController.getByPet);
router.get('/:id',           medicalRecordController.getById);

module.exports = router;
