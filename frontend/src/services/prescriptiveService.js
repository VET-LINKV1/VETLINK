/**
 * prescriptiveService.js
 * Thin wrapper around /api/prescriptive/* endpoints (admin / vet).
 */
import apiClient from './apiClient';

function buildParams({ horizonDays, petId, ownerId, species } = {}) {
  const p = new URLSearchParams();
  if (horizonDays) p.set('horizonDays', horizonDays);
  if (petId)       p.set('petId',       petId);
  if (ownerId)     p.set('ownerId',     ownerId);
  if (species)     p.set('species',     species);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const prescriptiveService = {
  async getScheduling() {
    const { data } = await apiClient.get('/prescriptive/scheduling');
    return data?.data;
  },
  async getWellness(filters = {}) {
    const { data } = await apiClient.get(`/prescriptive/wellness${buildParams(filters)}`);
    return data?.data;
  },
  async getOrdering(filters = {}) {
    const { data } = await apiClient.get(`/prescriptive/ordering${buildParams(filters)}`);
    return data?.data;
  },
  async getSummary(filters = {}) {
    const { data } = await apiClient.get(`/prescriptive/summary${buildParams(filters)}`);
    return data?.data;
  },
  async saveRecommendations(recommendations = []) {
    const { data } = await apiClient.post('/prescriptive/recommendations', { recommendations });
    return data?.data;
  },
};

export default prescriptiveService;
