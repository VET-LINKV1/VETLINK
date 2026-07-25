/**
 * passportService.js
 * Frontend client for /api/passport/*.
 */
import apiClient from './apiClient';
import axios from 'axios';

const unwrap = (res) => res.data?.data;

// A separate axios instance is used for the public token endpoint
// so the request interceptor in apiClient doesn't try to attach a
// (possibly absent) Bearer token.
const publicClient = axios.create({
  // Relative '/api' keeps requests on the same origin the page was loaded
  // from — works on laptop (localhost:5173) and on phone via the LAN IP.
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
});

export const passportService = {

  // Dashboard
  listClientPassports: (clientId) =>
    apiClient.get('/passport/clients', { params: { clientId } }).then(unwrap),

  // Single pet
  getPetPassport: (petId) =>
    apiClient.get(`/passport/pets/${petId}`).then(unwrap),

  // Weights
  listWeights:  (petId)         => apiClient.get(`/passport/pets/${petId}/weights`).then(unwrap),
  addWeight:    (payload)       => apiClient.post('/passport/weights', payload).then(unwrap),
  deleteWeight: (id)            => apiClient.delete(`/passport/weights/${id}`).then(unwrap),

  // Shares
  listSharesForPet: (petId)     => apiClient.get(`/passport/pets/${petId}/shares`).then(unwrap),
  createShare:      (payload)   => apiClient.post('/passport/shares', payload).then(unwrap),
  revokeShare:      (id)        => apiClient.delete(`/passport/shares/${id}`).then(unwrap),

  // Public, token-gated
  getByShareToken:  (token)     => publicClient.get(`/passport/shared/${token}`).then(unwrap),
};

export default passportService;
