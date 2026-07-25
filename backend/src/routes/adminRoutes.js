const { Router } = require('express');
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');

const router = Router();
router.use(authMiddleware, roleMiddleware('admin'));

router.get('/stats',           adminController.getStats);
router.get('/staff',           adminController.getStaff);
router.get('/sms-status',      adminController.smsStatus);
router.post('/send-reminders', adminController.sendReminders);

module.exports = router;
