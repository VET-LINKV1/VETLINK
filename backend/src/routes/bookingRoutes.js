/**
 * bookingRoutes.js
 * REST API for the Smart Frictionless Booking & Intake module.
 *
 * Base path: /api/booking
 *
 * Roles:
 *   client          book + submit intake (own pets only)
 *   admin / staff   book on behalf, view all, re-triage
 *   vet             view upcoming + intake (their assigned only)
 */
const { Router } = require('express');
const booking = require('../controllers/bookingController');
const auth    = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');
const { validateBody }   = require('../validations/bookingValidation');

const router = Router();
router.use(auth);

// ── Reference data ─────────────────────────────────────────────
router.get('/reasons',                          booking.listReasons);
router.get('/slots',                            booking.getAvailableSlots);
router.get('/suggest-vets',                     booking.suggestVets);

// ── Bookings ───────────────────────────────────────────────────
router.post('/',
  roleMiddleware('client', 'admin', 'staff'),
  validateBody('createBooking'),                 booking.createBooking);

router.patch('/:appointmentId/triage',
  roleMiddleware('admin', 'staff', 'veterinarian'),
  validateBody('retriage'),                      booking.retriage);

// ── Intake forms ──────────────────────────────────────────────
router.post('/intake',
  validateBody('submitIntake'),                  booking.submitIntake);
router.get('/intake/:appointmentId',             booking.getIntake);

// ── Vet pre-visit dashboard ───────────────────────────────────
router.get('/vet/upcoming',
  roleMiddleware('veterinarian', 'admin', 'staff'), booking.vetUpcoming);

module.exports = router;
