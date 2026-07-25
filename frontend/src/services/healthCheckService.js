/**
 * healthCheckService.js
 * Thin wrapper around /api/analytics/health-check endpoints.
 */
import apiClient from './apiClient';

function buildParams({ startDate, endDate, vetId, clientId } = {}) {
  const p = new URLSearchParams();
  if (startDate) p.set('startDate', startDate);
  if (endDate)   p.set('endDate',   endDate);
  if (vetId)     p.set('vetId',     vetId);
  if (clientId)  p.set('clientId',  clientId);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const healthCheckService = {
  /** Auto-routed by caller's role (recommended for the generic page). */
  async getMine(filters = {}) {
    const { data } = await apiClient.get(`/analytics/health-check${buildParams(filters)}`);
    return data?.data;
  },
  async getAdmin(filters = {}) {
    const { data } = await apiClient.get(`/analytics/health-check/admin${buildParams(filters)}`);
    return data?.data;
  },
  async getVet(filters = {}) {
    const { data } = await apiClient.get(`/analytics/health-check/vet${buildParams(filters)}`);
    return data?.data;
  },
  async getStaff(filters = {}) {
    const { data } = await apiClient.get(`/analytics/health-check/staff${buildParams(filters)}`);
    return data?.data;
  },
  async getClient(filters = {}) {
    const { data } = await apiClient.get(`/analytics/health-check/client${buildParams(filters)}`);
    return data?.data;
  },
};

export default healthCheckService;
