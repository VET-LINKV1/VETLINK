const Joi = require('joi');

/**
 * Validates req.body against a Joi schema.
 * Usage: validateMiddleware(schema)
 */
const validateMiddleware = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const messages = error.details.map((d) => d.message);
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: messages,
    });
  }

  req.body = value; // use sanitized value
  next();
};

// Reusable schemas
const schemas = {
  login: Joi.object({
    email: Joi.string().email().required().lowercase().trim(),
    password: Joi.string().min(6).max(128).required(),
  }),
};

module.exports = { validateMiddleware, schemas };
