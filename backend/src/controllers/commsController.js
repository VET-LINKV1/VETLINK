/**
 * commsController.js
 * Thin HTTP layer for the comms module.
 */
const svc = require('../services/commsService');

function errStatus(err) {
  const m = (err.message || '').toLowerCase();
  if (m.includes('access denied'))      return 403;
  if (m.includes('not found'))          return 404;
  if (m.includes('too large'))          return 413;
  if (m.includes('unsupported'))        return 415;
  if (m.includes('required') || m.includes('no longer active')) return 400;
  return 500;
}
const fail = (res, e) => res.status(errStatus(e)).json({ success: false, error: e.message });

const commsController = {
  // Conversations
  async listConversations(req, res) {
    try { res.json({ success: true, data: await svc.listConversations(req.user.id, req.user.role) }); }
    catch (e) { fail(res, e); }
  },
  async getConversation(req, res) {
    try {
      const data = await svc.getConversation(req.params.id, req.user.id, req.user.role, {
        limit: parseInt(req.query.limit || '50', 10),
        before: req.query.before || null,
      });
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },
  async markRead(req, res) {
    try { res.json({ success: true, data: await svc.markRead(req.params.id, req.user.id, req.user.role) }); }
    catch (e) { fail(res, e); }
  },
  async setMessagingStatus(req, res) {
    try {
      const data = await svc.setMessagingStatus(req.user.id, req.user.role, req.params.id, {
        disabled: req.body.disabled,
        reason:   req.body.reason,
      });
      res.json({ success: true, data });
    } catch (e) { fail(res, e); }
  },

  // Messages
  async sendMessage(req, res) {
    try { res.status(201).json({ success: true, data: await svc.sendMessage(req.user.id, req.user.role, req.body) }); }
    catch (e) { fail(res, e); }
  },
  async deleteMessage(req, res) {
    try { res.json({ success: true, data: await svc.deleteMessage(req.params.id, req.user.id, req.user.role) }); }
    catch (e) { fail(res, e); }
  },

  // Attachments
  async uploadAttachment(req, res) {
    try {
      if (!req.file) throw new Error('No file provided.');
      const data = await svc.uploadAttachment(req.user.id, req.user.role, req.file, {
        conversationId: req.body.conversationId,
        messageId:      req.body.messageId,
        petId:          req.body.petId,
        appointmentId:  req.body.appointmentId,
        caption:        req.body.caption,
      });
      res.status(201).json({ success: true, data });
    } catch (e) { fail(res, e); }
  },
  async getAttachmentUrl(req, res) {
    try { res.json({ success: true, data: await svc.getAttachmentUrl(req.params.id, req.user.id, req.user.role) }); }
    catch (e) { fail(res, e); }
  },

  // Video consultations
  async listConsultations(req, res) {
    try {
      res.json({ success: true, data: await svc.listConsultations(req.user.id, req.user.role, {
        status: req.query.status || null,
        days:   parseInt(req.query.days || '30', 10),
      }) });
    } catch (e) { fail(res, e); }
  },
  async getConsultation(req, res) {
    try { res.json({ success: true, data: await svc.getConsultation(req.params.id, req.user.id, req.user.role) }); }
    catch (e) { fail(res, e); }
  },
  async createConsultation(req, res) {
    try { res.status(201).json({ success: true, data: await svc.createConsultation(req.user.id, req.user.role, req.body) }); }
    catch (e) { fail(res, e); }
  },
  async joinConsultation(req, res) {
    try { res.json({ success: true, data: await svc.joinConsultation(req.params.id, req.user.id, req.user.role) }); }
    catch (e) { fail(res, e); }
  },
  async endConsultation(req, res) {
    try {
      res.json({ success: true, data: await svc.endConsultation(req.params.id, req.user.id, req.user.role, {
        cancel:       req.body?.cancel === true,
        cancelReason: req.body?.cancelReason || null,
      }) });
    } catch (e) { fail(res, e); }
  },

  // Consultation notes
  async upsertNote(req, res) {
    try { res.json({ success: true, data: await svc.upsertConsultNote(req.user.id, req.user.role, req.params.id, req.body) }); }
    catch (e) { fail(res, e); }
  },
};

module.exports = commsController;
