/**
 * notificationService.js
 * Create + read in-app notifications. Optionally fires SMS too.
 */
const { supabaseAdmin } = require('../config/supabase');
const smsService = require('./smsService');
const logger = require('../utils/logger');

const notificationService = {
  /** In-app only. */
  async create(userId, { title, message, type = 'info', link }) {
    if (!userId) return;
    const { error } = await supabaseAdmin
      .from('notifications')
      .insert({ user_id: userId, title, message, type, link: link || null });
    if (error) logger.warn('notification', 'create failed', { msg: error.message, userId });
  },

  /**
   * In-app + SMS. The SMS body defaults to "{title}: {message}" but can
   * be overridden with `smsBody`. Respects user's sms_opt_in preference.
   */
  async createWithSMS(userId, { title, message, type = 'info', link, smsBody }) {
    if (!userId) return;
    // Insert in-app notification first
    await notificationService.create(userId, { title, message, type, link });
    // Then check opt-in and send SMS
    try {
      const { data: user } = await supabaseAdmin
        .from('users').select('phone_number, sms_opt_in').eq('id', userId).single();
      if (user?.phone_number && user.sms_opt_in !== false) {
        const body = smsBody || `${title}: ${message}`;
        await smsService.sendNotification(user.phone_number, body);
      }
    } catch (e) {
      logger.warn('notification', 'SMS lookup failed', { msg: e.message, userId });
    }
  },

  async getForUser(userId, { limit = 50 } = {}) {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
  },

  async markRead(notificationId, userId) {
    const { data: existing } = await supabaseAdmin
      .from('notifications').select('id, user_id').eq('id', notificationId).single();
    if (!existing) throw new Error('Notification not found');
    if (existing.user_id !== userId) throw new Error('Access denied');

    const { error } = await supabaseAdmin
      .from('notifications').update({ is_read: true }).eq('id', notificationId);
    if (error) throw new Error(error.message);
    return true;
  },

  async markAllRead(userId) {
    const { error } = await supabaseAdmin
      .from('notifications').update({ is_read: true })
      .eq('user_id', userId).eq('is_read', false);
    if (error) throw new Error(error.message);
    return true;
  },
};

module.exports = notificationService;
