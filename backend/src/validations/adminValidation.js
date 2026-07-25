/**
 * adminValidation.js
 * Joi schemas for admin endpoints — no-show policy,
 * reminder cron triggers, etc.
 */
const Joi = require('joi');

const schemas = {

  noShowPolicy: Joi.object({
    grace_period_mins: Joi.number().integer().min(1).max(1440).optional(),
    notify_client: Joi.boolean().optional(),
    notify_vet: Joi.boolean().optional(),
    is_active: Joi.boolean().optional(),
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
