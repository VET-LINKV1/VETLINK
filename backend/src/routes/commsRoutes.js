/**
 * commsRoutes.js
 * REST API for the Direct Support & Communication Channels module.
 *
 * Base path: /api/comms
 */
const { Router } = require('express');
const ctl  = require('../controllers/commsController');
const auth = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');
const { validateBody }   = require('../validations/commsValidation');
const { singleEmrFile }  = require('../middleware/uploadMiddleware');

const router = Router();
router.use(auth);

/* Conversations */
router.get('/conversations',                        ctl.listConversations);
router.get('/conversations/:id',                    ctl.getConversation);
router.post('/conversations/:id/read',              ctl.markRead);
router.put('/conversations/:id/messaging',
  roleMiddleware('admin','veterinarian','staff'),
  validateBody('setMessagingStatus'),                ctl.setMessagingStatus);

/* Messages */
router.post('/messages',
  validateBody('sendMessage'),                      ctl.sendMessage);
router.delete('/messages/:id',                      ctl.deleteMessage);

/* Attachments — multipart */
router.post('/attachments',
  singleEmrFile('file'),                            ctl.uploadAttachment);
router.get('/attachments/:id/url',                  ctl.getAttachmentUrl);

/* Video consultations */
router.get('/consultations',                        ctl.listConsultations);
router.get('/consultations/:id',                    ctl.getConsultation);
router.post('/consultations',
  validateBody('createConsultation'),               ctl.createConsultation);
router.post('/consultations/:id/join',              ctl.joinConsultation);
router.post('/consultations/:id/end',
  validateBody('endConsultation'),                  ctl.endConsultation);

/* Consultation notes */
router.put('/consultations/:id/notes',
  roleMiddleware('admin','veterinarian','staff'),
  validateBody('upsertNote'),                       ctl.upsertNote);

module.exports = router;
