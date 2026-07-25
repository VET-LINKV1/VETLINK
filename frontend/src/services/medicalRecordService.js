import apiClient from './apiClient';

export const medicalRecordService = {
  async create(payload) {
    const { data } = await apiClient.post('/medical-records', payload);
    return data.data;
  },
  async getByPet(petId) {
    const { data } = await apiClient.get(`/medical-records/pet/${petId}`);
    return data.data;
  },
  async getById(id) {
    const { data } = await apiClient.get(`/medical-records/${id}`);
    return data.data;
  },
  async getMyRecords(filters = {}) {
    const { data } = await apiClient.get('/medical-records/my-records', { params: filters });
    return data.data;
  },
  async getAll(filters = {}) {
    // Admin / staff endpoint — returns every record in the clinic.
    const { data } = await apiClient.get('/medical-records', { params: filters });
    return data.data;
  },
  async getClientHistory() {
    const { data } = await apiClient.get('/medical-records/history');
    return data.data;
  },
  async update(id, payload) {
    const { data } = await apiClient.put(`/medical-records/${id}`, payload);
    return data.data;
  },
};
