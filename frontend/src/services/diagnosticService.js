/**
 * diagnosticService.js
 * Thin wrapper around /api/diagnostic/* endpoints (admin only).
 */
import apiClient from './apiClient';

function buildParams({ startDate, endDate, minCohort } = {}) {
  const p = new URLSearchParams();
  if (startDate) p.set('startDate', startDate);
  if (endDate)   p.set('endDate',   endDate);
  if (minCohort) p.set('minCohort', minCohort);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const diagnosticService = {
  async getChurn(filters = {}) {
    const { data } = await apiClient.get(`/diagnostic/churn${buildParams(filters)}`);
    return data?.data;
  },
  async getTreatment(filters = {}) {
    const { data } = await apiClient.get(`/diagnostic/treatment${buildParams(filters)}`);
    return data?.data;
  },
  async getShrinkage(filters = {}) {
    const { data } = await apiClient.get(`/diagnostic/shrinkage${buildParams(filters)}`);
    return data?.data;
  },
  async getSummary(filters = {}) {
    const { data } = await apiClient.get(`/diagnostic/summary${buildParams(filters)}`);
    return data?.data;
  },
};

export default diagnosticService;
