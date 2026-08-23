const { Router } = require('express');
const clientController = require('../controllers/clientController');
const authMiddleware = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');
const { validateMiddleware } = require('../middleware/validateMiddleware');
const Joi = require('joi');

const router = Router();

// Validation schemas
const registerSchema = Joi.object({
  name:          Joi.string().min(2).max(100).required().trim(),
  email:         Joi.string().email().required().lowercase().trim(),
  password:      Joi.string().min(8).max(128)
                   .pattern(/[A-Z]/, 'uppercase')
                   .pattern(/[0-9]/, 'number')
                   .required()
                   .messages({
                     'string.pattern.name': 'Password must contain at least one uppercase letter and one number',
                     'string.min': 'Password must be at least 8 characters',
                   }),
  contactNumber: Joi.string().max(20).optional().allow(''),
  address:       Joi.string().max(255).optional().allow(''),
  pet: Joi.object({
    name:    Joi.string().min(1).max(100).required(),
    species: Joi.string().required(),
    breed:   Joi.string().max(100).optional().allow(''),
    age:     Joi.number().integer().min(0).max(50).optional().allow('', null),
    gender:  Joi.string().valid('male', 'female', 'unknown').default('unknown'),
  }).optional(),
});

const petSchema = Joi.object({
  name:      Joi.string().min(1).max(100).required(),
  species:   Joi.string().required(),
  breed:     Joi.string().max(100).optional().allow(''),
  age:       Joi.number().integer().min(0).max(50).optional().allow('', null),
  gender:    Joi.string().valid('male', 'female', 'unknown').default('unknown'),
  weight_kg: Joi.number().min(0).max(500).optional().allow('', null),
  notes:     Joi.string().max(500).optional().allow(''),
});

// Public
router.post('/register', validateMiddleware(registerSchema), clientController.register);

// Protected — client only
router.use(authMiddleware, roleMiddleware('client'));
router.get('/dashboard',          clientController.getDashboard);
router.get('/pets',               clientController.getPets);
router.get('/pets/:petId/record',  clientController.getPetRecord);
router.get('/analytics',             clientController.getAnalytics);
router.post('/pets',              validateMiddleware(petSchema), clientController.addPet);
router.get('/appointments',       clientController.getAppointments);
router.post('/appointments',      clientController.bookAppointment);

// SMS preferences
router.patch('/sms-opt-in',       clientController.updateSmsOptIn);

module.exports = router;
