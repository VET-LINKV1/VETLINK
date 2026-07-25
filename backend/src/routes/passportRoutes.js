/**
 * passportRoutes.js
 * REST API for the Multi-Pet Digital Health Passport.
 *
 * Base path: /api/passport
 *
 * Most routes require auth; the share-token endpoint is intentionally
 * public so external recipients can open the link from an email.
 */
const { Router } = require('express');
const passport      = require('../controllers/passportController');
const auth          = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');
const { validateBody }   = require('../validations/passportValidation');

const router = Router();

const STAFF   = ['admin', 'veterinarian', 'staff'];
const WRITERS = ['admin', 'veterinarian'];

// ── Public (token-gated) ───────────────────────────────────────
// Has to come BEFORE the router.use(auth) below.
router.get('/shared/:token',                          passport.getByShareToken);

// ── Authenticated ──────────────────────────────────────────────
router.use(auth);

router.get('/clients',                                passport.listClientPassports);
router.get('/pets/:petId',                            passport.getPetPassport);

// Weight history
router.get('/pets/:petId/weights',                    passport.listWeights);
router.post('/weights',
  roleMiddleware(STAFF), validateBody('addWeight'),   passport.addWeight);
router.delete('/weights/:id',
  roleMiddleware(WRITERS),                            passport.deleteWeight);

// Shares
router.get('/pets/:petId/shares',                     passport.listSharesForPet);
router.post('/shares',
  validateBody('createShare'),                        passport.createShare);
router.delete('/shares/:id',                          passport.revokeShare);

module.exports = router;
