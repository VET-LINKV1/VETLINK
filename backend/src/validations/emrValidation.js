/**
 * emrValidation.js
 * Joi schemas + a small validator middleware for the EMR routes.
 * Validation runs BEFORE the controller — bad payloads never reach the service.
 */
const Joi = require('joi');

const uuid = Joi.string().uuid();

const schemas = {

  // SOAP notes
  createSoap: Joi.object({
    medicalRecordId: uuid.required(),
    subjective:      Joi.string().allow('', null).max(5000),
    objective:       Joi.string().allow('', null).max(5000),
    assessment:      Joi.string().allow('', null).max(5000),
    plan:            Joi.string().allow('', null).max(5000),
  }),
  updateSoap: Joi.object({
    subjective: Joi.string().allow('', null).max(5000),
    objective:  Joi.string().allow('', null).max(5000),
    assessment: Joi.string().allow('', null).max(5000),
    plan:       Joi.string().allow('', null).max(5000),
  }).min(1),

  // Vaccinations
  createVaccination: Joi.object({
    petId:            uuid.required(),
    medicalRecordId:  uuid.optional(),
    vaccineName:      Joi.string().min(2).max(120).required(),
    manufacturer:     Joi.string().max(120).allow('', null),
    batchNumber:      Joi.string().max(80).allow('', null),
    dose:             Joi.string().max(80).allow('', null),
    administeredDate: Joi.date().iso().allow(null),
    dueDate:          Joi.date().iso().allow(null),
    status:           Joi.string().valid('scheduled', 'administered', 'overdue', 'cancelled'),
    notes:            Joi.string().max(2000).allow('', null),
  }),
  updateVaccination: Joi.object({
    vaccineName:      Joi.string().min(2).max(120),
    manufacturer:     Joi.string().max(120).allow('', null),
    batchNumber:      Joi.string().max(80).allow('', null),
    dose:             Joi.string().max(80).allow('', null),
    administeredDate: Joi.date().iso().allow(null),
    dueDate:          Joi.date().iso().allow(null),
    status:           Joi.string().valid('scheduled', 'administered', 'overdue', 'cancelled'),
    notes:            Joi.string().max(2000).allow('', null),
  }).min(1),

  // Prescriptions
  createPrescription: Joi.object({
    petId:            uuid.required(),
    medicalRecordId:  uuid.optional(),
    medicationName:   Joi.string().min(2).max(150).required(),
    dosage:           Joi.string().min(1).max(80).required(),
    frequency:        Joi.string().min(1).max(80).required(),
    route:            Joi.string().max(50).allow('', null),
    durationDays:     Joi.number().integer().min(0).max(3650).allow(null),
    refillsAllowed:   Joi.number().integer().min(0).max(50).default(0),
    startDate:        Joi.date().iso(),
    endDate:          Joi.date().iso().allow(null),
    status:           Joi.string().valid('active', 'completed', 'discontinued', 'expired'),
    instructions:     Joi.string().max(2000).allow('', null),
  }),
  updatePrescription: Joi.object({
    medicationName:   Joi.string().min(2).max(150),
    dosage:           Joi.string().min(1).max(80),
    frequency:        Joi.string().min(1).max(80),
    route:            Joi.string().max(50).allow('', null),
    durationDays:     Joi.number().integer().min(0).max(3650).allow(null),
    refillsAllowed:   Joi.number().integer().min(0).max(50),
    refillsUsed:      Joi.number().integer().min(0).max(50),
    startDate:        Joi.date().iso(),
    endDate:          Joi.date().iso().allow(null),
    status:           Joi.string().valid('active', 'completed', 'discontinued', 'expired'),
    instructions:     Joi.string().max(2000).allow('', null),
  }).min(1),

  // Treatments
  createTreatment: Joi.object({
    petId:           uuid.required(),
    medicalRecordId: uuid.optional(),
    name:            Joi.string().min(2).max(150).required(),
    description:     Joi.string().max(2000).allow('', null),
    performedDate:   Joi.date().iso().allow(null),
    scheduledDate:   Joi.date().iso().allow(null),
    status:          Joi.string().valid('planned', 'in_progress', 'completed', 'cancelled'),
    outcome:         Joi.string().max(2000).allow('', null),
    costEstimate:    Joi.number().min(0).max(1e9).allow(null),
  }),
  updateTreatment: Joi.object({
    name:            Joi.string().min(2).max(150),
    description:     Joi.string().max(2000).allow('', null),
    performedDate:   Joi.date().iso().allow(null),
    scheduledDate:   Joi.date().iso().allow(null),
    status:          Joi.string().valid('planned', 'in_progress', 'completed', 'cancelled'),
    outcome:         Joi.string().max(2000).allow('', null),
    costEstimate:    Joi.number().min(0).max(1e9).allow(null),
  }).min(1),

  // Files (metadata-only; the file itself comes through multer)
  uploadFile: Joi.object({
    petId:           uuid.required(),
    medicalRecordId: uuid.optional(),
    kind:            Joi.string().valid('xray', 'lab_result', 'prescription_doc', 'document', 'photo', 'other').default('document'),
    title:           Joi.string().min(1).max(150).required(),
    description:     Joi.string().max(1000).allow('', null),
  }),
  updateFile: Joi.object({
    title:       Joi.string().min(1).max(150),
    description: Joi.string().max(1000).allow('', null),
    kind:        Joi.string().valid('xray', 'lab_result', 'prescription_doc', 'document', 'photo', 'other'),
    is_archived: Joi.boolean(),
  }).min(1),

};

/**
 * Returns an Express middleware that validates req.body against
 * the named schema, replacing req.body with the cleaned value.
 */
function validateBody(name) {
  const schema = schemas[name];
  if (!schema) throw new Error('Unknown validation schema: ' + name);
  return (req, res, next) => {
    const { value, error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
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
