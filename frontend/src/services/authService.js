import apiClient from './apiClient';
import { supabase } from './supabaseClient';

export const authService = {
  async login(email, password) {
    const { data } = await apiClient.post('/auth/login', { email, password });
    return data.data;
  },
  async getMe() {
    const { data } = await apiClient.get('/auth/me');
    return data.data.user;
  },
  async logout() {
    try { await apiClient.post('/auth/logout'); } catch (_) {}
    await supabase.auth.signOut();
  },
};
