/**
 * profileValidation.js
 * Joi schemas for the profile endpoints (self-service account management).
 */
const Joi = require('joi');

// Same password rules used at registration: min 8 chars, 1 uppercase, 1 number, 1 symbol
const newPasswordSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(/[A-Z]/, 'uppercase letter')
  .pattern(/[0-9]/, 'number')
  .pattern(/[^A-Za-z0-9]/, 'symbol')
  .required()
  .messages({
    'string.pattern.name': 'New password must contain at least one {#name}',
    'string.min': 'New password must be at least 8 characters',
  });

const schemas = {
  changePassword: Joi.object({
    currentPassword: Joi.string().required().messages({
      'any.required': 'Current password is required',
      'string.empty': 'Current password is required',
    }),
    newPassword: newPasswordSchema,
  }),
};

module.exports = schemas;
