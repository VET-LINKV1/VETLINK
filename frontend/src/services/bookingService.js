/**
 * bookingService.js — frontend client for /api/booking/*
 */
import apiClient from './apiClient';

const unwrap = (res) => res.data?.data;

export const bookingService = {

  listReasons: () =>
    apiClient.get('/booking/reasons').then(unwrap),

  getAvailableSlots: (vetId, date, slotMins) =>
    apiClient.get('/booking/slots', { params: { vetId, date, slotMins } }).then(unwrap),

  suggestVets: ({ reasonCode, date, preferredTime, limit = 5 }) =>
    apiClient.get('/booking/suggest-vets', {
      params: { reasonCode, date, preferredTime, limit },
    }).then(unwrap),

  createBooking: (payload) =>
    apiClient.post('/booking', payload).then(unwrap),

  submitIntake: (payload) =>
    apiClient.post('/booking/intake', payload).then(unwrap),

  getIntake: (appointmentId) =>
    apiClient.get(`/booking/intake/${appointmentId}`).then(unwrap),

  vetUpcoming: (days = 7) =>
    apiClient.get('/booking/vet/upcoming', { params: { days } }).then(unwrap),

  retriage: (appointmentId, urgency) =>
    apiClient.patch(`/booking/${appointmentId}/triage`, { urgency }).then(unwrap),

};

export default bookingService;
