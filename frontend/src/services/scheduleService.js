import apiClient from './apiClient';

export const scheduleService = {
  async getAllVets() {
    const { data } = await apiClient.get('/vet-schedule/vets');
    return data.data;
  },
  async getVetSchedule(vetId) {
    const { data } = await apiClient.get('/vet-schedule/' + vetId);
    return data.data;
  },
  async getAvailableSlots(vetId, date) {
    const { data } = await apiClient.get('/vet-schedule/' + vetId + '/slots', { params: { date } });
    return data.data;
  },
  async setWeeklySchedule(days, vetId) {
    const { data } = await apiClient.post('/vet-schedule/weekly', { days, vetId });
    return data.data;
  },
};
