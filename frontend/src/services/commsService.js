/**
 * commsService.js — frontend client for /api/comms/*
 */
import apiClient from './apiClient';

const unwrap = (res) => res.data?.data;

export const commsService = {

  // Conversations
  listConversations: () =>
    apiClient.get('/comms/conversations').then(unwrap),
  getConversation: (id, { limit = 50, before = null } = {}) =>
    apiClient.get(`/comms/conversations/${id}`, { params: { limit, before } }).then(unwrap),
  markRead: (id) =>
    apiClient.post(`/comms/conversations/${id}/read`).then(unwrap),

  // Messages
  sendMessage: (payload) =>
    apiClient.post('/comms/messages', payload).then(unwrap),
  deleteMessage: (id) =>
    apiClient.delete(`/comms/messages/${id}`).then(unwrap),

  // Attachments
  uploadAttachment: async (file, meta = {}, onProgress) => {
    const form = new FormData();
    form.append('file', file);
    Object.entries(meta).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') form.append(k, v);
    });
    const { data } = await apiClient.post('/comms/attachments', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    });
    return data.data;
  },
  getAttachmentUrl: (id) =>
    apiClient.get(`/comms/attachments/${id}/url`).then(unwrap),

  // Consultations
  listConsultations: ({ status, days = 30 } = {}) =>
    apiClient.get('/comms/consultations', { params: { status, days } }).then(unwrap),
  getConsultation: (id) =>
    apiClient.get(`/comms/consultations/${id}`).then(unwrap),
  createConsultation: (payload) =>
    apiClient.post('/comms/consultations', payload).then(unwrap),
  joinConsultation: (id) =>
    apiClient.post(`/comms/consultations/${id}/join`).then(unwrap),
  endConsultation: (id, payload = {}) =>
    apiClient.post(`/comms/consultations/${id}/end`, payload).then(unwrap),

  // Consultation notes
  upsertNote: (id, payload) =>
    apiClient.put(`/comms/consultations/${id}/notes`, payload).then(unwrap),
};

export default commsService;
