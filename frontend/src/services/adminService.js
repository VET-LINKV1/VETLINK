import apiClient from './apiClient';

export const adminService = {
  async getStats() {
    const { data } = await apiClient.get('/admin/stats');
    return data.data;
  },
  async getStaff() {
    const { data } = await apiClient.get('/admin/staff');
    return data.data;
  },
};
