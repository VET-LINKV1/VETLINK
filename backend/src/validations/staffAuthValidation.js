/**
 * staffAuthValidation.js
 * Joi schemas for staff registration endpoints.
 */
const Joi = require('joi');

// Password rules: min 8 chars, 1 uppercase, 1 number, 1 symbol
const passwordSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(/[A-Z]/, 'uppercase letter')
  .pattern(/[0-9]/, 'number')
  .pattern(/[^A-Za-z0-9]/, 'symbol')
  .required()
  .messages({
    'string.pattern.name': 'Password must contain at least one {#name}',
    'string.min': 'Password must be at least 8 characters',
  });

// Phone: E.164 format (e.g. +639123456789)
const phoneSchema = Joi.string()
  .pattern(/^\+[1-9]\d{7,14}$/)
  .required()
  .messages({
    'string.pattern.base': 'Phone number must be in international format (e.g. +639123456789)',
  });

const schemas = {
  register: Joi.object({
    fullName:       Joi.string().min(2).max(100).required().trim(),
    email:          Joi.string().email().required().lowercase().trim(),
    password:       passwordSchema,
    phoneNumber:    phoneSchema,
    role:           Joi.string().valid('admin', 'veterinarian', 'staff').required(),

    // Veterinarian-specific (required if role = veterinarian)
    licenseNumber:  Joi.when('role', {
      is: 'veterinarian',
      then: Joi.string().min(3).max(50).required()
        .messages({ 'any.required': 'License number is required for veterinarians' }),
      otherwise: Joi.string().optional().allow('', null),
    }),
    specialization: Joi.when('role', {
      is: 'veterinarian',
      then: Joi.string().min(2).max(100).required()
        .messages({ 'any.required': 'Specialization is required for veterinarians' }),
      otherwise: Joi.string().optional().allow('', null),
    }),

    // Staff-specific (required if role = staff)
    position: Joi.when('role', {
      is: 'staff',
      then: Joi.string().valid('assistant', 'technician').required()
        .messages({ 'any.required': 'Position is required for clinical staff' }),
      otherwise: Joi.string().optional().allow('', null),
    }),
  }),

  verifyOTP: Joi.object({
    phoneNumber: phoneSchema,
    otp: Joi.string().length(6).pattern(/^[0-9]+$/).required()
      .messages({
        'string.length': 'OTP must be exactly 6 digits',
        'string.pattern.base': 'OTP must contain only numbers',
      }),
  }),

  resendOTP: Joi.object({
    phoneNumber: phoneSchema,
  }),
};

module.exports = schemas;
