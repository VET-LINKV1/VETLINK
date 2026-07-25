/**
 * bookingValidation.js
 * Joi schemas + validateBody() middleware for booking & intake.
 */
const Joi = require('joi');

const uuid = Joi.string().uuid();

const schemas = {

  createBooking: Joi.object({
    petId:         uuid.required(),
    clientId:      uuid.optional(),
    vetId:         uuid.optional().allow(null),
    reasonCode:    Joi.string().valid('annual_checkup','vaccination','grooming','injury','emergency','other').required(),
    appointmentAt: Joi.date().iso().required(),
    durationMins:  Joi.number().integer().min(10).max(240),
    notes:         Joi.string().max(2000).allow('', null),
  }),

  submitIntake: Joi.object({
    appointmentId:      uuid.required(),
    symptoms:           Joi.string().max(3000).allow('', null),
    symptomOnset:       Joi.string().max(120).allow('', null),
    symptomSeverity:    Joi.number().integer().min(1).max(10).allow(null),
    dietInfo:           Joi.string().max(2000).allow('', null),
    currentMedications: Joi.string().max(2000).allow('', null),
    allergies:          Joi.string().max(2000).allow('', null),
    behavioralNotes:    Joi.string().max(2000).allow('', null),
    recentChanges:      Joi.string().max(2000).allow('', null),
    fastingStatus:      Joi.string().max(120).allow('', null),
    consentGiven:       Joi.boolean(),
  }),

  retriage: Joi.object({
    urgency: Joi.string().valid('routine','standard','urgent','emergency').required(),
  }),

};

function validateBody(name) {
  const schema = schemas[name];
  if (!schema) throw new Error('Unknown validation schema: ' + name);
  return (req, res, next) => {
    const { value, error } = schema.validate(req.body, {
      abortEarly: false, stripUnknown: true, convert: true,
    });
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payload',
        details: error.details.map(d => ({ path: d.path, msg: d.message })),
      });
    }
    req.body = value;
    next();
  };
}

module.exports = { schemas, validateBody };
