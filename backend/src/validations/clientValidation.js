/**
 * clientValidation.js
 * Joi schemas for client registration and profile updates.
 */
const Joi = require('joi');

// Same strong password rules as staff — min 8 chars, 1 uppercase, 1 number, 1 symbol
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
    'any.required': 'Password is required',
  });

const schemas = {

  register: Joi.object({
    name: Joi.string().min(2).max(100).required().trim(),
    email: Joi.string().email().required().lowercase().trim(),
    password: passwordSchema,
    contactNumber: Joi.string().allow('', null),
    address: Joi.string().allow('', null),
    pet: Joi.object({
      name: Joi.string().min(1).max(100).trim(),
      species: Joi.string().valid('Dog','Cat','Bird','Rabbit','Hamster','Fish','Reptile','Other'),
      breed: Joi.string().allow('', null).max(100),
      age: Joi.number().integer().min(0).max(50).allow(null),
      gender: Joi.string().valid('male','female','unknown'),
    }).optional().allow(null),
  }),

};

module.exports = schemas;
