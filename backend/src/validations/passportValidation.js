/**
 * passportValidation.js
 * Joi schemas + validateBody() middleware for the passport routes.
 */
const Joi = require('joi');

const uuid = Joi.string().uuid();

const schemas = {

  addWeight: Joi.object({
    petId:               uuid.required(),
    weightKg:            Joi.number().positive().max(500).required(),
    bodyConditionScore:  Joi.number().integer().min(1).max(9).allow(null),
    recordedAt:          Joi.date().iso(),
    notes:               Joi.string().max(500).allow('', null),
  }),

  createShare: Joi.object({
    petId:          uuid.required(),
    recipientEmail: Joi.string().email().required(),
    message:        Joi.string().max(2000).allow('', null),
    ttlDays:        Joi.number().integer().min(1).max(365),
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
