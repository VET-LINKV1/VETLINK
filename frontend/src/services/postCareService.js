/**
 * postCareService.js — frontend client for /api/postcare/*.
 */
import apiClient from './apiClient';

const unwrap = (res) => res.data?.data;

export const postCareService = {

  // ── Discharge instructions ───────────────────────────────
  getDischargeByAppointment: (appointmentId) =>
    apiClient.get(`/postcare/discharges/by-appointment/${appointmentId}`).then(unwrap),
  listDischargesForPet: (petId) =>
    apiClient.get(`/postcare/discharges/pets/${petId}`).then(unwrap),
  upsertDischarge: (payload) =>
    apiClient.put('/postcare/discharges', payload).then(unwrap),
  attachDischargeFile: (dischargeId, fileId) =>
    apiClient.post(`/postcare/discharges/${dischargeId}/files`, { fileId }).then(unwrap),
  detachDischargeFile: (joinId) =>
    apiClient.delete(`/postcare/discharges/files/${joinId}`).then(unwrap),

  // ── Refill requests ──────────────────────────────────────
  requestRefill: (prescriptionId, notes) =>
    apiClient.post('/postcare/refills', { prescriptionId, notes }).then(unwrap),
  listMyRefills: () =>
    apiClient.get('/postcare/refills/mine').then(unwrap),
  listPharmacyQueue: (status = 'pending') =>
    apiClient.get('/postcare/refills/queue', { params: { status } }).then(unwrap),
  approveRefill: (id, pickupReadyAt) =>
    apiClient.patch(`/postcare/refills/${id}/approve`, { pickupReadyAt }).then(unwrap),
  denyRefill: (id, denialReason) =>
    apiClient.patch(`/postcare/refills/${id}/deny`, { denialReason }).then(unwrap),
  dispenseRefill: (id) =>
    apiClient.patch(`/postcare/refills/${id}/dispense`).then(unwrap),
  cancelRefill: (id) =>
    apiClient.patch(`/postcare/refills/${id}/cancel`).then(unwrap),

  // ── Medication reminders ─────────────────────────────────
  listReminders: (ownerId) =>
    apiClient.get('/postcare/reminders', { params: ownerId ? { ownerId } : {} }).then(unwrap),
  createReminder: (payload) =>
    apiClient.post('/postcare/reminders', payload).then(unwrap),
  updateReminder: (id, payload) =>
    apiClient.patch(`/postcare/reminders/${id}`, payload).then(unwrap),
  deleteReminder: (id) =>
    apiClient.delete(`/postcare/reminders/${id}`).then(unwrap),
  getDispatchLog: (id) =>
    apiClient.get(`/postcare/reminders/${id}/log`).then(unwrap),

  tickReminders: () =>
    apiClient.post('/postcare/reminders/tick').then(unwrap),

};

export default postCareService;
