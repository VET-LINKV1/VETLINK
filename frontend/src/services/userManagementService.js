/**
 * userManagementService.js — frontend client for /api/admin/users/*
 */
import apiClient from './apiClient';

const unwrap = (res) => res.data?.data;

export const userManagementService = {
  // List + read
  list: (params = {}) =>
    apiClient.get('/admin/users', { params }).then(unwrap),
  get: (id) =>
    apiClient.get(`/admin/users/${id}`).then(unwrap),
  activity: (id) =>
    apiClient.get(`/admin/users/${id}/activity`).then(unwrap),
  audit: (params = {}) =>
    apiClient.get('/admin/users/audit', { params }).then(unwrap),

  // Mutations
  create: (payload) =>
    apiClient.post('/admin/users', payload).then(unwrap),
  update: (id, patch) =>
    apiClient.patch(`/admin/users/${id}`, patch).then(unwrap),
  remove: (id) =>
    apiClient.delete(`/admin/users/${id}`).then(unwrap),

  // Lifecycle
  suspend:    (id) => apiClient.post(`/admin/users/${id}/suspend`).then(unwrap),
  reactivate: (id) => apiClient.post(`/admin/users/${id}/reactivate`).then(unwrap),
  verify:     (id) => apiClient.post(`/admin/users/${id}/verify`).then(unwrap),
  resetPassword: (id) => apiClient.post(`/admin/users/${id}/reset-password`).then(unwrap),

  bulkImport: (users, opts = {}) =>
    apiClient.post('/admin/users/bulk-import', { users, send_invite: opts.send_invite !== false }).then(unwrap),
};

export default userManagementService;
