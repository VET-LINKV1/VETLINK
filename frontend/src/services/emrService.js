/**
 * emrService.js
 * Frontend client for /api/emr/*.
 * Returns response.data (the inner payload) for ergonomic use in components.
 */
import apiClient from './apiClient';

const unwrap = (res) => res.data?.data;

export const emrService = {

  // ── Navigation ────────────────────────────────────────────
  listClientsWithPets: () =>
    apiClient.get('/emr/clients').then(unwrap),

  getPetChart: (petId) =>
    apiClient.get(`/emr/pets/${petId}/chart`).then(unwrap),

  getPetTimeline: (petId, { kinds, limit = 100, offset = 0 } = {}) =>
    apiClient
      .get(`/emr/pets/${petId}/timeline`, {
        params: {
          kinds: kinds?.length ? kinds.join(',') : undefined,
          limit, offset,
        },
      })
      .then(unwrap),

  // ── SOAP notes ────────────────────────────────────────────
  createSoap: (payload)     => apiClient.post('/emr/soap', payload).then(unwrap),
  updateSoap: (id, payload) => apiClient.put(`/emr/soap/${id}`, payload).then(unwrap),
  deleteSoap: (id)          => apiClient.delete(`/emr/soap/${id}`).then(unwrap),

  // ── Vaccinations ──────────────────────────────────────────
  listVaccinations:    (petId)       => apiClient.get(`/emr/pets/${petId}/vaccinations`).then(unwrap),
  upcomingVaccinations:(days = 30)   => apiClient.get('/emr/vaccinations/upcoming', { params: { days } }).then(unwrap),
  createVaccination:   (payload)     => apiClient.post('/emr/vaccinations', payload).then(unwrap),
  updateVaccination:   (id, payload) => apiClient.put(`/emr/vaccinations/${id}`, payload).then(unwrap),
  deleteVaccination:   (id)          => apiClient.delete(`/emr/vaccinations/${id}`).then(unwrap),

  // ── Prescriptions ─────────────────────────────────────────
  listPrescriptions:   (petId)       => apiClient.get(`/emr/pets/${petId}/prescriptions`).then(unwrap),
  createPrescription:  (payload)     => apiClient.post('/emr/prescriptions', payload).then(unwrap),
  updatePrescription:  (id, payload) => apiClient.put(`/emr/prescriptions/${id}`, payload).then(unwrap),
  refillPrescription:  (id)          => apiClient.post(`/emr/prescriptions/${id}/refill`).then(unwrap),
  deletePrescription:  (id)          => apiClient.delete(`/emr/prescriptions/${id}`).then(unwrap),

  // ── Treatments ────────────────────────────────────────────
  listTreatments:      (petId)       => apiClient.get(`/emr/pets/${petId}/treatments`).then(unwrap),
  createTreatment:     (payload)     => apiClient.post('/emr/treatments', payload).then(unwrap),
  updateTreatment:     (id, payload) => apiClient.put(`/emr/treatments/${id}`, payload).then(unwrap),
  deleteTreatment:     (id)          => apiClient.delete(`/emr/treatments/${id}`).then(unwrap),

  // ── Files ─────────────────────────────────────────────────
  listFiles:   (petId, { kind } = {}) => apiClient.get(`/emr/pets/${petId}/files`, { params: { kind } }).then(unwrap),
  getFileUrl:  (id)                   => apiClient.get(`/emr/files/${id}/url`).then(unwrap),
  updateFile:  (id, payload)          => apiClient.put(`/emr/files/${id}`, payload).then(unwrap),
  deleteFile:  (id, hard = false)     => apiClient.delete(`/emr/files/${id}`, { params: { hard: hard ? 1 : 0 } }).then(unwrap),

  /**
   * Upload a file. `file` is a browser File object; `meta` carries
   * petId, kind, title, description, medicalRecordId.
   */
  uploadFile: async (file, meta, onProgress) => {
    const form = new FormData();
    form.append('file', file);
    Object.entries(meta || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') form.append(k, v);
    });
    const { data } = await apiClient.post('/emr/files', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    });
    return data.data;
  },

  // ── Search ────────────────────────────────────────────────
  search: ({ q, petId, kinds, limit = 25 } = {}) =>
    apiClient.get('/emr/search', {
      params: {
        q, petId, limit,
        kinds: kinds?.length ? kinds.join(',') : undefined,
      },
    }).then(unwrap),

};

export default emrService;
