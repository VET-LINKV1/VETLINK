/**
 * commsValidation.js — Joi + validateBody() for the comms module.
 */
const Joi = require('joi');
const uuid = Joi.string().uuid();

const schemas = {
  sendMessage: Joi.object({
    conversationId: uuid.optional(),                    // omitted for clients (derived)
    body:           Joi.string().max(8000).allow('', null),
    kind:           Joi.string().valid('text','image','video','file','system').default('text'),
    petId:          uuid.optional().allow(null),
    appointmentId:  uuid.optional().allow(null),
    replyToId:      uuid.optional().allow(null),
  }),

  createConsultation: Joi.object({
    clientId:      uuid.optional(),
    petId:         uuid.optional().allow(null),
    appointmentId: uuid.optional().allow(null),
    vetId:         uuid.optional().allow(null),
    scheduledAt:   Joi.date().iso().allow(null),
  }),

  setMessagingStatus: Joi.object({
    disabled: Joi.boolean().required(),
    reason:   Joi.string().max(500).allow('', null),
  }),

  endConsultation: Joi.object({
    cancel:        Joi.boolean(),
    cancelReason:  Joi.string().max(500).allow('', null),
  }),

  upsertNote: Joi.object({
    subjective:        Joi.string().max(5000).allow('', null),
    objective:         Joi.string().max(5000).allow('', null),
    assessment:        Joi.string().max(5000).allow('', null),
    plan:              Joi.string().max(5000).allow('', null),
    followUpRequired:  Joi.boolean(),
    followUpDate:      Joi.date().iso().allow(null),
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
