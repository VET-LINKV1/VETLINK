import apiClient from './apiClient';

export const profileService = {
  async getProfile() {
    const { data } = await apiClient.get('/profile');
    return data.data;
  },
  async updateProfile(payload) {
    const { data } = await apiClient.put('/profile', payload);
    return data.data;
  },
  async uploadAvatar(file) {
    const formData = new FormData();
    formData.append('avatar', file);
    const { data } = await apiClient.post('/profile/avatar', formData);
    return data.data;
  },
  async changePassword(currentPassword, newPassword) {
    const { data } = await apiClient.put('/profile/password', { currentPassword, newPassword });
    return data.data;
  },
};
