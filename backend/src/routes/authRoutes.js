const { Router } = require('express');
const authController = require('../controllers/authController');
const clientController = require('../controllers/clientController');
const staffAuthController = require('../controllers/staffAuthController');
const authMiddleware = require('../middleware/authMiddleware');
const { validateMiddleware, schemas } = require('../middleware/validateMiddleware');
const staffSchemas = require('../validations/staffAuthValidation');
const clientSchemas = require('../validations/clientValidation');
const Joi = require('joi');

const router = Router();

router.post('/login', validateMiddleware(schemas.login), authController.login);

/**
 * POST /api/auth/register
 * Unified registration — branches on role.
 */
const unifiedRegisterSchema = Joi.object({
  role: Joi.string().valid('client', 'veterinarian', 'staff').required(),
}).unknown(true);

router.post('/register', validateMiddleware(unifiedRegisterSchema), (req, res, next) => {
  if (req.body.role === 'client') {
    // Apply client-specific validation before passing to the controller
    const { error, value } = clientSchemas.register.validate(req.body, {
      abortEarly: false, stripUnknown: true, convert: true,
    });
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(d => ({ path: d.path, msg: d.message })),
      });
    }
    req.body = value;
    return clientController.register(req, res, next);
  }
  return staffAuthController.register(req, res, next);
});

/**
 * POST /api/auth/verify-otp
 * Alias for staff OTP verification (brief-required path).
 */
router.post(
  '/verify-otp',
  validateMiddleware(staffSchemas.verifyOTP),
  staffAuthController.verifyOTP
);

router.get('/me', authMiddleware, authController.getMe);
router.post('/logout', authMiddleware, authController.logout);

module.exports = router;
