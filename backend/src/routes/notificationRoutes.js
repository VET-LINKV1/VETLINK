const { Router } = require('express');
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/authMiddleware');

const router = Router();
router.use(authMiddleware);

router.get('/',               notificationController.getAll);
router.patch('/:id/read',     notificationController.markRead);
router.patch('/read-all',     notificationController.markAllRead);

module.exports = router;
