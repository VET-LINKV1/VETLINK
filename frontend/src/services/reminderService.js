/**
 * reminderService.js — frontend client for /api/reminders/*
 */
import apiClient from './apiClient';

const unwrap = (res) => res.data?.data;

export const reminderService = {

  /**
   * Client: get own vaccination/deworming reminders grouped by pet
   */
  getMine: (daysAhead = 90) =>
    apiClient.get('/reminders/mine', { params: { daysAhead } }).then(unwrap),

  /**
   * Summary badge counts (upcoming + overdue)
   */
  getSummary: () =>
    apiClient.get('/reminders/summary').then(unwrap),

  /**
   * Per-pet reminder history
   */
  getForPet: (petId) =>
    apiClient.get(`/reminders/pet/${petId}`).then(unwrap),

  /**
   * Reminder templates (admin only)
   */
  getTemplates: () =>
    apiClient.get('/reminders/templates').then(unwrap),
};

export default reminderService;
