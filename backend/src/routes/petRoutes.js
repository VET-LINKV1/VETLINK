const { Router } = require('express');
const petController = require('../controllers/petController');
const authMiddleware = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');

const router = Router();
router.use(authMiddleware);

// READ — clients see own; vets/staff/admin see all (service decides)
router.get('/',       petController.getAll);
// CREATE / UPDATE — clients only (their own pets)
router.post('/',      roleMiddleware('client'),                petController.create);
router.put('/:id',    roleMiddleware('client'),                petController.update);

module.exports = router;
