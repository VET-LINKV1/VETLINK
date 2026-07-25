/**
 * postCareValidation.js
 * Joi schemas + validateBody() middleware for the post-care module.
 */
const Joi = require('joi');

const uuid    = Joi.string().uuid();
const timeStr = Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/);   // HH:MM

const stepSchema = Joi.object({
  title:   Joi.string().max(120).required(),
  detail:  Joi.string().max(2000).allow('', null),
  when:    Joi.string().max(120).allow('', null),
});

const feedingSchema = Joi.object({
  food:      Joi.string().max(120).required(),
  amount:    Joi.string().max(80).allow('', null),
  frequency: Joi.string().max(120).allow('', null),
  notes:     Joi.string().max(500).allow('', null),
});

const videoSchema = Joi.object({
  title: Joi.string().max(120).required(),
  url:   Joi.string().uri().required(),
  kind:  Joi.string().valid('youtube', 'vimeo', 'other'),
});

const schemas = {

  upsertDischarge: Joi.object({
    appointmentId: uuid.required(),
    title:         Joi.string().max(200).allow('', null),
    body:          Joi.string().max(20000).allow('', null),
    steps:         Joi.array().items(stepSchema).max(50).default([]),
    feeding:       Joi.array().items(feedingSchema).max(20).default([]),
    videos:        Joi.array().items(videoSchema).max(20).default([]),
    followUpDate:  Joi.date().iso().allow(null),
    isPublished:   Joi.boolean().default(false),
  }),

  attachFile: Joi.object({
    fileId: uuid.required(),
  }),

  // Refill workflow
  requestRefill: Joi.object({
    prescriptionId: uuid.required(),
    notes:          Joi.string().max(1000).allow('', null),
  }),

  approveRefill: Joi.object({
    pickupReadyAt: Joi.date().iso().allow(null),
  }),

  denyRefill: Joi.object({
    denialReason: Joi.string().min(2).max(500).required(),
  }),

  // Reminders
  createReminder: Joi.object({
    prescriptionId:   uuid.required(),
    timesOfDay:       Joi.array().items(timeStr).min(1).max(8).required(),
    foodInstruction:  Joi.string().max(120).allow('', null),
    messageOverride:  Joi.string().max(500).allow('', null),
    channels:         Joi.array().items(Joi.string().valid('in_app','sms','email')).min(1).max(3),
    startDate:        Joi.date().iso(),
    endDate:          Joi.date().iso().allow(null),
  }),

  updateReminder: Joi.object({
    timesOfDay:       Joi.array().items(timeStr).min(1).max(8),
    foodInstruction:  Joi.string().max(120).allow('', null),
    messageOverride:  Joi.string().max(500).allow('', null),
    channels:         Joi.array().items(Joi.string().valid('in_app','sms','email')).min(1).max(3),
    startDate:        Joi.date().iso(),
    endDate:          Joi.date().iso().allow(null),
    isActive:         Joi.boolean(),
  }).min(1),

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
