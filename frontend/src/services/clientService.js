import apiClient from './apiClient';

export const clientService = {
  async register(payload) {
    const { data } = await apiClient.post('/client/register', payload);
    return data.data;
  },
  async getDashboard() {
    const { data } = await apiClient.get('/client/dashboard');
    return data.data;
  },
  async getPets() {
    const { data } = await apiClient.get('/pets');
    return data.data;
  },
  async addPet(pet) {
    const { data } = await apiClient.post('/pets', pet);
    return data.data;
  },
  async updatePet(id, pet) {
    const { data } = await apiClient.put('/pets/' + id, pet);
    return data.data;
  },
  async getAppointments() {
    const { data } = await apiClient.get('/appointments');
    return data.data;
  },
  async bookAppointment(payload) {
    const { data } = await apiClient.post('/appointments', payload);
    return data.data;
  },
  async cancelAppointment(id, reason) {
    const { data } = await apiClient.patch('/appointments/' + id + '/cancel', { reason });
    return data.data;
  },
  async getAnalytics() {
    const { data } = await apiClient.get('/client/analytics');
    return data.data;
  },
  async updateSmsOptIn(optIn) {
    const { data } = await apiClient.patch('/client/sms-opt-in', { sms_opt_in: optIn });
    return data.data;
  },
};
