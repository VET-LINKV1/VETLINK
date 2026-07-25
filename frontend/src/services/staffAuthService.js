import apiClient from './apiClient';

export const staffAuthService = {
  /**
   * Submit registration form — triggers OTP send
   */
  async register(formData) {
    const { data } = await apiClient.post('/staff/register', formData);
    return data; // { success, message, data: { phone } }
  },

  /**
   * Verify OTP — creates account on success
   */
  async verifyOTP(phoneNumber, otp) {
    const { data } = await apiClient.post('/staff/verify-otp', { phoneNumber, otp });
    return data;
  },

  /**
   * Resend OTP
   */
  async resendOTP(phoneNumber) {
    const { data } = await apiClient.post('/staff/resend-otp', { phoneNumber });
    return data;
  },
};
