/**
 * confinementValidation.js — Joi + validateBody() for the
 * Pet Confinement / Boarding module.
 */
const Joi = require('joi');
const uuid = Joi.string().uuid();

const schemas = {
  admit: Joi.object({
    petId:               uuid.required(),
    vetId:                uuid.optional().allow(null),
    appointmentId:        uuid.optional().allow(null),
    location:             Joi.string().max(120).allow('', null),
    reason:               Joi.string().min(2).max(2000).required(),
    expectedDischargeAt:  Joi.date().iso().allow(null),
  }),

  update: Joi.object({
    vetId:                uuid.optional().allow(null),
    location:              Joi.string().max(120).allow('', null),
    reason:                Joi.string().min(2).max(2000),
    expectedDischargeAt:   Joi.date().iso().allow(null),
  }),

  addLog: Joi.object({
    note:             Joi.string().max(3000).allow('', null),
    temperatureC:     Joi.number().min(20).max(45).allow(null),
    heartRateBpm:     Joi.number().integer().min(0).max(400).allow(null),
    respirationRate:  Joi.number().integer().min(0).max(200).allow(null),
    weightKg:         Joi.number().min(0).max(200).allow(null),
  }).custom((value, helpers) => {
    const hasSomething = value.note || value.temperatureC != null || value.heartRateBpm != null
      || value.respirationRate != null || value.weightKg != null;
    if (!hasSomething) return helpers.error('any.custom');
    return value;
  }, 'at least one field required').messages({
    'any.custom': 'Add a note or at least one vital sign.',
  }),

  discharge: Joi.object({
    dischargeNotes: Joi.string().max(3000).allow('', null),
  }),

  cancel: Joi.object({
    reason: Joi.string().max(500).allow('', null),
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
