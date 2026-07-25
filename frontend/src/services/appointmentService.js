import apiClient from './apiClient';

export const appointmentService = {
  async book(payload) {
    const { data } = await apiClient.post('/appointments', payload);
    return data.data;
  },
  async getAll(filters = {}) {
    const { data } = await apiClient.get('/appointments', { params: filters });
    return data.data;
  },
  async getById(id) {
    const { data } = await apiClient.get(`/appointments/${id}`);
    return data.data;
  },
  async updateStatus(id, status, reason) {
    const { data } = await apiClient.patch(`/appointments/${id}/status`, { status, reason });
    return data.data;
  },
  async cancel(id, reason) {
    const { data } = await apiClient.patch(`/appointments/${id}/cancel`, { reason });
    return data.data;
  },
  async reschedule(id, payload) {
    const { data } = await apiClient.patch(`/appointments/${id}/reschedule`, payload);
    return data.data;
  },
};

export const notificationService = {
  async getAll() {
    const { data } = await apiClient.get('/notifications');
    return { notifications: data.data, unread: data.unread };
  },
  async markRead(id) {
    await apiClient.patch(`/notifications/${id}/read`);
  },
  async markAllRead() {
    await apiClient.patch('/notifications/read-all');
  },
};
