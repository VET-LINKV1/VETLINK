/**
 * predictiveService.js
 * Thin wrapper around /api/predictive/* endpoints (admin only).
 */
import apiClient from './apiClient';

function buildParams({ horizon, band } = {}) {
  const p = new URLSearchParams();
  if (horizon) p.set('horizon', horizon);
  if (band)    p.set('band',    band);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const predictiveService = {
  async getChurn(filters = {}) {
    const { data } = await apiClient.get(`/predictive/churn${buildParams(filters)}`);
    return data?.data;
  },
  async getInventory(filters = {}) {
    const { data } = await apiClient.get(`/predictive/inventory${buildParams(filters)}`);
    return data?.data;
  },
  async getAppointments(filters = {}) {
    const { data } = await apiClient.get(`/predictive/appointments${buildParams(filters)}`);
    return data?.data;
  },
  async getTreatmentRisk(filters = {}) {
    const { data } = await apiClient.get(`/predictive/treatment-risk${buildParams(filters)}`);
    return data?.data;
  },
  async getSummary(filters = {}) {
    const { data } = await apiClient.get(`/predictive/summary${buildParams(filters)}`);
    return data?.data;
  },
};

export default predictiveService;
