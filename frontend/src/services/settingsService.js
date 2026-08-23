/**
 * settingsService.js (frontend)
 * Thin client for the admin Settings module. Every call returns the `data`
 * payload from the backend's { success, data } envelope.
 *
 * Base path: /api/admin/settings
 */
import apiClient from './apiClient';

const unwrap = (res) => res.data.data;

export const settingsService = {
  // ── Config sections ──
  async getSection(section) {
    const { data } = await apiClient.get('/admin/settings/' + section);
    return data.data;
  },
  async updateSection(section, patch) {
    const { data } = await apiClient.put('/admin/settings/' + section, patch);
    return data.data;
  },
  async resetSection(section) {
    const { data } = await apiClient.post('/admin/settings/' + section + '/reset');
    return data.data;
  },

  // ── Roles & Permissions ──
  async getRoles() {
    const { data } = await apiClient.get('/admin/settings/roles/list');
    return data.data;
  },
  async updatePermission(payload) {
    const { data } = await apiClient.post('/admin/settings/roles/permission', payload);
    return data.data;
  },
  async setRolePermissions(role, permissions) {
    const { data } = await apiClient.post('/admin/settings/roles/permissions', { role, permissions });
    return data.data;
  },

  // ── Branches & Rooms ──
  async getBranches() {
    const { data } = await apiClient.get('/admin/settings/branches/list');
    return data.data;
  },
  async createBranch(payload) {
    const { data } = await apiClient.post('/admin/settings/branches', payload);
    return data.data;
  },
  async updateBranch(id, payload) {
    const { data } = await apiClient.put('/admin/settings/branches/' + id, payload);
    return data.data;
  },
  async deleteBranch(id) {
    const { data } = await apiClient.delete('/admin/settings/branches/' + id);
    return data.data;
  },
  async createRoom(payload) {
    const { data } = await apiClient.post('/admin/settings/rooms', payload);
    return data.data;
  },
  async updateRoom(id, payload) {
    const { data } = await apiClient.put('/admin/settings/rooms/' + id, payload);
    return data.data;
  },
  async deleteRoom(id) {
    const { data } = await apiClient.delete('/admin/settings/rooms/' + id);
    return data.data;
  },

  // ── Audit log ──
  async getAuditLog({ limit = 100, offset = 0, action = 'all', q = '' } = {}) {
    const params = new URLSearchParams({ limit, offset });
    if (action && action !== 'all') params.set('action', action);
    if (q) params.set('q', q);
    const { data } = await apiClient.get('/admin/settings/audit/list?' + params.toString());
    return data.data;
  },

  // ── Connection tests ──
  async testSms(phone, message) {
    const { data } = await apiClient.post('/admin/settings/test/sms', { phone, message });
    return data.data;
  },
  async getPaymongoStatus() {
    const { data } = await apiClient.get('/admin/settings/billing/paymongo');
    return data.data;
  },
};

export default settingsService;
