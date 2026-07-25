/**
 * userManagementValidation.js
 * Joi schemas for the admin user-management endpoints.
 */
const Joi = require('joi');

const role = Joi.string().valid('admin', 'veterinarian', 'staff', 'client');

const baseUserFields = {
  email:           Joi.string().email().required(),
  name:            Joi.string().min(2).max(120).required(),
  role:            role.required(),
  phone_number:    Joi.string().allow('', null),
  address:         Joi.string().allow('', null),
  // staff_profile fields (optional for vet/staff)
  license_number:  Joi.string().allow('', null),
  specialization:  Joi.string().allow('', null),
  position:        Joi.string().valid('assistant', 'technician').allow(null, ''),
  department:      Joi.string().allow('', null),
  send_invite:     Joi.boolean().default(true),
};

const schemas = {
  createUser: Joi.object(baseUserFields),

  updateUser: Joi.object({
    name:           Joi.string().min(2).max(120),
    email:          Joi.string().email(),
    role,
    phone_number:   Joi.string().allow('', null),
    address:        Joi.string().allow('', null),
    avatar_url:     Joi.string().uri().allow('', null),
    license_number: Joi.string().allow('', null),
    specialization: Joi.string().allow('', null),
    position:       Joi.string().valid('assistant', 'technician').allow(null, ''),
    department:     Joi.string().allow('', null),
  }).min(1),

  bulkImport: Joi.object({
    users:       Joi.array().items(Joi.object(baseUserFields)).min(1).max(500).required(),
    send_invite: Joi.boolean().default(true),
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
