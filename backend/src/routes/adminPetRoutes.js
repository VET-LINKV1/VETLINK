const { Router } = require('express');
const adminPetController = require('../controllers/adminPetController');
const authMiddleware = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');

const router = Router();
router.use(authMiddleware);

// Staff (admin/vet/staff) read access
router.get('/stats',       roleMiddleware(['admin', 'veterinarian', 'staff']), adminPetController.stats);
router.get('/owners',      roleMiddleware(['admin', 'veterinarian', 'staff']), adminPetController.listOwners);
router.get('/',            roleMiddleware(['admin', 'veterinarian', 'staff']), adminPetController.list);
router.get('/:petId/record', roleMiddleware(['admin', 'veterinarian', 'staff']), adminPetController.getRecord);

// Admin write access
router.post('/',           roleMiddleware('admin'), adminPetController.create);
router.put('/:petId',      roleMiddleware('admin'), adminPetController.update);

module.exports = router;