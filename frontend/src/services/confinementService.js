/**
 * confinementService.js — frontend client for /api/confinements/*
 */
import apiClient from './apiClient';

const unwrap = (res) => res.data?.data;

export const confinementService = {
  list: (params = {}) =>
    apiClient.get('/confinements', { params }).then(unwrap),
  listForPet: (petId) =>
    apiClient.get(`/confinements/pets/${petId}`).then(unwrap),
  get: (id) =>
    apiClient.get(`/confinements/${id}`).then(unwrap),
  admit: (payload) =>
    apiClient.post('/confinements', payload).then(unwrap),
  update: (id, patch) =>
    apiClient.put(`/confinements/${id}`, patch).then(unwrap),
  discharge: (id, dischargeNotes) =>
    apiClient.post(`/confinements/${id}/discharge`, { dischargeNotes }).then(unwrap),
  cancel: (id, reason) =>
    apiClient.post(`/confinements/${id}/cancel`, { reason }).then(unwrap),
  listLogs: (id) =>
    apiClient.get(`/confinements/${id}/logs`).then(unwrap),
  addLog: (id, payload) =>
    apiClient.post(`/confinements/${id}/logs`, payload).then(unwrap),
};

export default confinementService;
