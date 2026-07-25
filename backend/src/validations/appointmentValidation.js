/**
 * appointmentValidation.js
 * Joi schemas for appointment endpoints including
 * reschedule, status updates, and no-show operations.
 */
const Joi = require('joi');

const uuid = Joi.string().uuid();

const schemas = {

  reschedule: Joi.object({
    appointmentAt: Joi.date().iso().required(),
    appointmentLocalDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null, ''),
    appointmentLocalTime: Joi.string().pattern(/^\d{2}:\d{2}$/).allow(null, ''),
    vetId: uuid.allow(null, ''),
    durationMins: Joi.number().integer().min(10).max(240).optional(),
    notes: Joi.string().max(2000).allow('', null),
  }),

  updateStatus: Joi.object({
    status: Joi.string().valid('confirmed', 'completed', 'cancelled', 'no_show', 'declined').required(),
    reason: Joi.string().max(500).allow('', null),
  }),

  cancel: Joi.object({
    reason: Joi.string().max(500).allow('', null),
  }),

  book: Joi.object({
    petId: uuid.required(),
    vetId: uuid.allow(null, ''),
    type: Joi.string().max(100).required(),
    appointmentAt: Joi.date().iso().required(),
    durationMins: Joi.number().integer().min(10).max(240).optional(),
    notes: Joi.string().max(2000).allow('', null),
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
