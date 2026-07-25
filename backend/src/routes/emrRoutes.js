/**
 * emrRoutes.js
 * REST API for the advanced EMR module.
 *
 * Base path:  /api/emr
 *
 * Routes are grouped by resource. Every route is auth-gated,
 * and write operations are further gated by role.
 *
 * Roles:
 *   admin, veterinarian   →  full read/write
 *   staff                 →  read + file upload
 *   client                →  read-only, restricted to own pets
 */
const { Router } = require('express');
const emr           = require('../controllers/emrController');
const auth          = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');
const { singleEmrFile }  = require('../middleware/uploadMiddleware');
const { validateBody }   = require('../validations/emrValidation');

const router = Router();
router.use(auth);

const STAFF   = ['admin', 'veterinarian', 'staff'];
const WRITERS = ['admin', 'veterinarian'];
const UPLOAD  = ['admin', 'veterinarian', 'staff']; // staff may upload paperwork

// ── Navigation: clients & their pets ───────────────────────────
router.get('/clients',                                emr.listClientsWithPets);

// ── Per-pet chart + timeline ───────────────────────────────────
router.get('/pets/:petId/chart',                      emr.getPetChart);
router.get('/pets/:petId/timeline',                   emr.getPetTimeline);

// ── SOAP notes ────────────────────────────────────────────────
router.post('/soap',         roleMiddleware(WRITERS), validateBody('createSoap'),    emr.createSoap);
router.put('/soap/:id',      roleMiddleware(WRITERS), validateBody('updateSoap'),    emr.updateSoap);
router.delete('/soap/:id',   roleMiddleware(WRITERS),                                emr.deleteSoap);

// ── Vaccinations ──────────────────────────────────────────────
router.get('/pets/:petId/vaccinations',               emr.listVaccinations);
router.get('/vaccinations/upcoming',
  roleMiddleware(STAFF),                              emr.upcomingVaccinations);
router.post('/vaccinations',
  roleMiddleware(WRITERS), validateBody('createVaccination'), emr.createVaccination);
router.put('/vaccinations/:id',
  roleMiddleware(WRITERS), validateBody('updateVaccination'), emr.updateVaccination);
router.delete('/vaccinations/:id',
  roleMiddleware(WRITERS),                            emr.deleteVaccination);

// ── Prescriptions ─────────────────────────────────────────────
router.get('/pets/:petId/prescriptions',              emr.listPrescriptions);
router.post('/prescriptions',
  roleMiddleware(WRITERS), validateBody('createPrescription'), emr.createPrescription);
router.put('/prescriptions/:id',
  roleMiddleware(WRITERS), validateBody('updatePrescription'), emr.updatePrescription);
router.post('/prescriptions/:id/refill',
  roleMiddleware(WRITERS),                            emr.refillPrescription);
router.delete('/prescriptions/:id',
  roleMiddleware(WRITERS),                            emr.deletePrescription);

// ── Treatments ────────────────────────────────────────────────
router.get('/pets/:petId/treatments',                 emr.listTreatments);
router.post('/treatments',
  roleMiddleware(WRITERS), validateBody('createTreatment'),    emr.createTreatment);
router.put('/treatments/:id',
  roleMiddleware(WRITERS), validateBody('updateTreatment'),    emr.updateTreatment);
router.delete('/treatments/:id',
  roleMiddleware(WRITERS),                            emr.deleteTreatment);

// ── Files (multipart) ─────────────────────────────────────────
router.get('/pets/:petId/files',                      emr.listFiles);
router.get('/files/:id/url',                          emr.getFileUrl);
router.post('/files',
  roleMiddleware(UPLOAD),
  singleEmrFile('file'),
  // We validate the multipart text fields *after* multer parses them.
  (req, res, next) => validateBody('uploadFile')(req, res, next),
  emr.uploadFile);
router.put('/files/:id',
  roleMiddleware(WRITERS), validateBody('updateFile'),         emr.updateFile);
router.delete('/files/:id',
  roleMiddleware(WRITERS),                            emr.deleteFile);

// ── Cross-record search ───────────────────────────────────────
router.get('/search',                                 emr.search);

module.exports = router;
