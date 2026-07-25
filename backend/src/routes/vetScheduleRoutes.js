const { Router } = require('express');
const vetScheduleController = require('../controllers/vetScheduleController');
const authMiddleware = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');

const router = Router();

// ── Public (authenticated) ──────────────────────────────────────
// Anyone logged in can read vet schedules and availability for booking
router.get('/vets',                authMiddleware, vetScheduleController.getAllVets);
router.get('/:vetId',              authMiddleware, vetScheduleController.getSchedule);
router.get('/:vetId/slots',        authMiddleware, vetScheduleController.getAvailableSlots);

// ── Vet/Admin only ──────────────────────────────────────────────
router.post('/',        authMiddleware, roleMiddleware('veterinarian', 'admin'), vetScheduleController.setSchedule);
router.post('/weekly',  authMiddleware, roleMiddleware('veterinarian', 'admin'), vetScheduleController.setWeeklySchedule);

module.exports = router;
