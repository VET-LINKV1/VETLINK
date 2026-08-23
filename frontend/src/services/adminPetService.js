/**
 * adminPetService.js — frontend client for /api/admin/pets/*
 * Admin/staff/vet endpoints for clinic-wide pet management.
 */
import apiClient from './apiClient';

const unwrap = (res) => res.data?.data;

export const adminPetService = {
  // Owner dropdown for registration
  listOwners: () =>
    apiClient.get('/admin/pets/owners').then(unwrap),

  // List with filters/pagination/sort
  list: (params = {}) =>
    apiClient.get('/admin/pets', { params }).then(unwrap),

  // KPI summary cards
  stats: () =>
    apiClient.get('/admin/pets/stats').then(unwrap),

  // Full 11-section record (no owner scoping)
  getRecord: (petId) =>
    apiClient.get(`/admin/pets/${petId}/record`).then(unwrap),

  // Admin create (assigns owner)
  create: (payload) =>
    apiClient.post('/admin/pets', payload).then(unwrap),

  // Admin update (any field, no owner check)
  update: (petId, patch) =>
    apiClient.put(`/admin/pets/${petId}`, patch).then(unwrap),
};

export default adminPetService;