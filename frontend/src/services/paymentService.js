import apiClient from './apiClient';

export const paymentService = {
  /** Public catalogue — no auth needed. Returns [{ name, centavos, displayPrice }]. */
  async listServices() {
    const { data } = await apiClient.get('/payments/services');
    return data.data;
  },

  /** Create a PayMongo checkout session for an appointment, returns { checkoutUrl, transactionId, amount, displayPrice, free? }. */
  async createCheckoutSession(appointmentId) {
    const { data } = await apiClient.post('/payments/create-checkout-session', { appointmentId });
    return data.data;
  },

  /**
   * Get current payment + appointment status.
   * Pass reconcile=true to ask PayMongo for the latest (polling fallback).
   */
  async getStatus(appointmentId, { reconcile = false } = {}) {
    const url = `/payments/status/${appointmentId}` + (reconcile ? '?reconcile=true' : '');
    const { data } = await apiClient.get(url);
    return data.data;
  },
};
