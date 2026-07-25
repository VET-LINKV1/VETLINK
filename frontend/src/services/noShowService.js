/**
 * noShowService.js — frontend client for /api/no-show/*
 */
import apiClient from './apiClient';

const unwrap = (res) => res.data?.data;

export const noShowService = {

  /**
   * Trigger the auto-cancel sweep (admin only)
   */
  runSweep: () =>
    apiClient.post('/no-show/sweep').then(unwrap),

  /**
   * Get the current no-show policy
   */
  getPolicy: () =>
    apiClient.get('/no-show/policy').then(unwrap),

  /**
   * Update no-show policy (admin only)
   */
  updatePolicy: (payload) =>
    apiClient.put('/no-show/policy', payload).then(unwrap),

  /**
   * All clients' no-show stats (staff/admin)
   */
  listClientStats: () =>
    apiClient.get('/no-show/clients').then(unwrap),

  /**
   * Per-client no-show stats
   */
  getClientStats: (clientId) =>
    apiClient.get(`/no-show/client/${clientId}`).then(unwrap),
};

export default noShowService;
