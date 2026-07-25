/**
 * emrController.js
 * Thin HTTP layer over emrService + emrFileService.
 *
 * Every handler:
 *   - assumes authMiddleware has attached req.user (id, role)
 *   - delegates to the service for permission checks
 *   - normalizes error → HTTP status codes
 */
const emrService     = require('../services/emrService');
const emrFileService = require('../services/emrFileService');

function errStatus(err) {
  const m = (err.message || '').toLowerCase();
  if (m.includes('access denied') || m.includes('only')) return 403;
  if (m.includes('not found'))                            return 404;
  if (m.includes('required') || m.includes('unsupported')
      || m.includes('too large') || m.includes('nothing to update')
      || m.includes('at least')) return 400;
  return 500;
}
function fail(res, err) {
  return res.status(errStatus(err)).json({ success: false, error: err.message });
}

const emrController = {

  /* PETS / NAVIGATION */
  async listClientsWithPets(req, res) {
    try {
      const data = await emrService.listClientsWithPets(req.user.id, req.user.role);
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },

  async getPetChart(req, res) {
    try {
      const data = await emrService.getPetChart(req.params.petId, req.user.id, req.user.role);
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },

  async getPetTimeline(req, res) {
    try {
      const kinds = req.query.kinds ? String(req.query.kinds).split(',').map(s => s.trim()).filter(Boolean) : null;
      const limit  = Math.min(parseInt(req.query.limit  || '100', 10) || 100, 500);
      const offset = parseInt(req.query.offset || '0',   10) || 0;
      const data = await emrService.getPetTimeline(req.params.petId, req.user.id, req.user.role, { kinds, limit, offset });
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },

  /* SOAP NOTES */
  async createSoap(req, res) {
    try {
      const data = await emrService.createSoapNote(req.user.id, req.user.role, req.body);
      res.status(201).json({ success: true, data });
    } catch (e) { fail(res, e); }
  },
  async updateSoap(req, res) {
    try {
      const data = await emrService.updateSoapNote(req.params.id, req.user.id, req.user.role, req.body);
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },
  async deleteSoap(req, res) {
    try {
      const data = await emrService.deleteSoapNote(req.params.id, req.user.id, req.user.role);
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },

  /* VACCINATIONS */
  async listVaccinations(req, res) {
    try {
      const data = await emrService.listVaccinationsByPet(req.params.petId, req.user.id, req.user.role);
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },
  async upcomingVaccinations(req, res) {
    try {
      const daysAhead = parseInt(req.query.days || '30', 10) || 30;
      const data = await emrService.listUpcomingVaccinations(req.user.id, req.user.role, { daysAhead });
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },
  async createVaccination(req, res) {
    try {
      const data = await emrService.createVaccination(req.user.id, req.user.role, req.body);
      res.status(201).json({ success: true, data });
    } catch (e) { fail(res, e); }
  },
  async updateVaccination(req, res) {
    try {
      const data = await emrService.updateVaccination(req.params.id, req.user.id, req.user.role, req.body);
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },
  async deleteVaccination(req, res) {
    try {
      const data = await emrService.deleteVaccination(req.params.id, req.user.role);
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },

  /* PRESCRIPTIONS */
  async listPrescriptions(req, res) {
    try {
      const data = await emrService.listPrescriptionsByPet(req.params.petId, req.user.id, req.user.role);
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },
  async createPrescription(req, res) {
    try {
      const data = await emrService.createPrescription(req.user.id, req.user.role, req.body);
      res.status(201).json({ success: true, data });
    } catch (e) { fail(res, e); }
  },
  async updatePrescription(req, res) {
    try {
      const data = await emrService.updatePrescription(req.params.id, req.user.role, req.body);
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },
  async refillPrescription(req, res) {
    try {
      const data = await emrService.refillPrescription(req.params.id, req.user.role);
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },
  async deletePrescription(req, res) {
    try {
      const data = await emrService.deletePrescription(req.params.id, req.user.role);
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },

  /* TREATMENTS */
  async listTreatments(req, res) {
    try {
      const data = await emrService.listTreatmentsByPet(req.params.petId, req.user.id, req.user.role);
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },
  async createTreatment(req, res) {
    try {
      const data = await emrService.createTreatment(req.user.id, req.user.role, req.body);
      res.status(201).json({ success: true, data });
    } catch (e) { fail(res, e); }
  },
  async updateTreatment(req, res) {
    try {
      const data = await emrService.updateTreatment(req.params.id, req.user.role, req.body);
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },
  async deleteTreatment(req, res) {
    try {
      const data = await emrService.deleteTreatment(req.params.id, req.user.role);
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },

  /* FILES */
  async uploadFile(req, res) {
    try {
      if (!req.file) throw new Error('No file provided.');
      const data = await emrFileService.upload(req.user.id, req.user.role, req.file, {
        petId:           req.body.petId,
        medicalRecordId: req.body.medicalRecordId,
        kind:            req.body.kind,
        title:           req.body.title,
        description:     req.body.description,
      });
      res.status(201).json({ success: true, data });
    } catch (e) { fail(res, e); }
  },
  async listFiles(req, res) {
    try {
      const data = await emrFileService.listByPet(req.params.petId, req.user.id, req.user.role, { kind: req.query.kind });
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },
  async getFileUrl(req, res) {
    try {
      const data = await emrFileService.getSignedUrl(req.params.id, req.user.id, req.user.role);
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },
  async updateFile(req, res) {
    try {
      const data = await emrFileService.update(req.params.id, req.user.role, req.body);
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },
  async deleteFile(req, res) {
    try {
      const hard = req.query.hard === '1' || req.query.hard === 'true';
      const data = await emrFileService.remove(req.params.id, req.user.role, { hard });
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },

  /* SEARCH */
  async search(req, res) {
    try {
      const kinds = req.query.kinds ? String(req.query.kinds).split(',').map(s => s.trim()).filter(Boolean) : null;
      const data = await emrService.search(req.user.id, req.user.role, {
        q:      req.query.q,
        petId:  req.query.petId || null,
        kinds,
        limit:  Math.min(parseInt(req.query.limit || '25', 10) || 25, 100),
      });
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },

};

module.exports = emrController;
