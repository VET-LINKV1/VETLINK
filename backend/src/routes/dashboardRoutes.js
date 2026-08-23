const { Router } = require('express');
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');

const router = Router();
router.use(authMiddleware, roleMiddleware('admin'));

// Single aggregate payload — frontend calls this once and distributes.
router.get('/overview', dashboardController.overview);

module.exports = router;
