/**
 * noShowService.js
 *
 * No-Show Policy & Auto-Cancellation Engine.
 *
 * Responsibilities:
 *   1. Run the auto-cancel sweep that marks past confirmed/pending
 *      appointments as no_show after the configured grace period.
 *   2. Get/set the no-show policy configuration.
 *   3. Expose per-client no-show stats for dashboards.
 *
 * Cron runs via POST /api/admin/no-show/sweep (admin only).
 * An admin can also configure the grace period.
 */
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

let notificationService = null;
try { notificationService = require('./notificationService'); } catch (_) {}

const noShowService = {

  /**
   * Auto-cancel sweep — marks past appointments as no_show.
   * Uses the configured grace period from no_show_policy, or
   * falls back to the default of 30 minutes.
   *
   * After marking, notifies the client (and optionally the vet).
   *
   * Returns { marked, notified, errors }
   */
  async runSweep() {
    let marked = 0;
    let errors = 0;

    // 1. Get active policy
    const graceMins = await this.getGracePeriod();

    // 2. Try the SQL function first
    let updatedAppointments = [];
    try {
      const { data } = await supabaseAdmin.rpc('auto_cancel_no_shows', {
        p_grace_mins: graceMins,
      });
      const count = data || 0;

      if (count === 0) {
        logger.info('noshow', 'sweep — nothing to mark');
        return { marked: 0, notified: 0, errors: 0 };
      }

      marked = count;
      logger.info('noshow', 'sweep marked', { count });

      // 3. Fetch the newly-marked appointments to send notifications
      const cutoff = new Date(Date.now() - graceMins * 60000).toISOString();
      const { data: appts } = await supabaseAdmin
        .from('appointments')
        .select(`
          id, appointment_at, status_updated_at,
          pets(id, name),
          client:users!appointments_client_id_fkey(id, name, phone_number),
          vet:users!appointments_vet_id_fkey(id, name)
        `)
        .eq('status', 'no_show')
        .gte('status_updated_at', cutoff);

      updatedAppointments = appts || [];

    } catch (e) {
      // SQL function doesn't exist yet — JS fallback
      logger.warn('noshow', 'SQL function unavailable, using JS fallback', { msg: e.message });
      updatedAppointments = await this._sweepFallback(graceMins);
      marked = updatedAppointments.length;
    }

    // 4. Send notifications
    let notified = 0;
    for (const appt of updatedAppointments) {
      try {
        const petName  = appt.pets?.name || 'your pet';
        const apptDate = appt.appointment_at
          ? new Date(appt.appointment_at).toLocaleString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            })
          : 'scheduled time';

        // Notify client
        if (appt.client?.id && notificationService) {
          await notificationService.createWithSMS(appt.client.id, {
            title:   'Missed Appointment — No Show',
            message: `Your appointment for ${petName} on ${apptDate} has been marked as no-show. Please reschedule if you still need care.`,
            type:    'warning',
            link:    '/client/appointments',
            smsBody: `PHVC: Your appointment for ${petName} on ${apptDate} was marked as no-show. Please reschedule if you still need care.`,
          });
          notified++;
        }

        // Notify vet
        if (appt.vet?.id && notificationService) {
          await notificationService.create(appt.vet.id, {
            title:   'Patient No-Show',
            message: `${petName} did not show for their appointment on ${apptDate}.`,
            type:    'info',
            link:    '/dashboard',
          });
        }
      } catch (nErr) {
        logger.warn('noshow', 'notification failed', { apptId: appt.id, msg: nErr.message });
        errors++;
      }
    }

    logger.info('noshow', 'sweep done', { marked, notified, errors });
    return { marked, notified, errors };
  },

  /**
   * JS fallback when the SQL function isn't available.
   */
  async _sweepFallback(graceMins) {
    const cutoff = new Date(Date.now() - graceMins * 60000).toISOString();

    // Find past confirmed/pending appointments
    const { data: past, error } = await supabaseAdmin
      .from('appointments')
      .select(`
        id, pet_id, client_id, vet_id, appointment_at, status, status_history,
        pets(id, name),
        client:users!appointments_client_id_fkey(id, name, phone_number),
        vet:users!appointments_vet_id_fkey(id, name)
      `)
      .in('status', ['confirmed', 'pending'])
      .not('appointment_at', 'is', null)
      .lt('appointment_at', cutoff);

    if (error || !past || past.length === 0) return [];

    const ids = past.map(a => a.id);

    // Batch update to no_show
    const historyEntry = {
      from:    '{{status}}',
      to:      'no_show',
      at:      new Date().toISOString(),
      by:      null,
      byRole:  'system',
      reason:  `Auto no-show: appointment time + ${graceMins}min grace period elapsed`,
    };

    for (const appt of past) {
      const entry = { ...historyEntry, from: appt.status };
      const h = Array.isArray(appt.status_history) ? [...appt.status_history, entry] : [entry];

      await supabaseAdmin
        .from('appointments')
        .update({
          status: 'no_show',
          status_updated_at: new Date().toISOString(),
          status_history: h,
        })
        .eq('id', appt.id);
    }

    return past;
  },

  /**
   * Get the configured grace period from the DB (in minutes).
   * Defaults to 30 if no policy row exists.
   */
  async getGracePeriod() {
    try {
      const { data } = await supabaseAdmin
        .from('no_show_policy')
        .select('grace_period_mins')
        .eq('is_active', true)
        .maybeSingle();

      return data?.grace_period_mins ?? 30;
    } catch (_) {
      return 30;
    }
  },

  /**
   * Get the current no-show policy config.
   */
  async getPolicy() {
    const { data, error } = await supabaseAdmin
      .from('no_show_policy')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data || { grace_period_mins: 30, notify_client: true, notify_vet: true };
  },

  /**
   * Update no-show policy (admin only).
   */
  async updatePolicy(payload) {
    const allowed = ['grace_period_mins', 'notify_client', 'notify_vet', 'is_active'];
    const update = {};
    for (const k of allowed) {
      if (k in payload) update[k] = payload[k];
    }
    if (Object.keys(update).length === 0) throw new Error('Nothing to update.');

    // Upsert: there should only be one active policy row
    const { data: existing } = await supabaseAdmin
      .from('no_show_policy')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();

    let result;
    if (existing) {
      const { data, error } = await supabaseAdmin
        .from('no_show_policy')
        .update(update)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      result = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from('no_show_policy')
        .insert({ ...update, grace_period_mins: update.grace_period_mins || 30 })
        .select()
        .single();
      if (error) throw new Error(error.message);
      result = data;
    }

    logger.info('noshow', 'policy updated', { update });
    return result;
  },

  /**
   * No-show analytics for a client.
   */
  async getClientStats(clientId) {
    const { data, error } = await supabaseAdmin
      .from('appointments')
      .select('id, status')
      .eq('client_id', clientId);

    if (error) throw new Error(error.message);

    const total = (data || []).length;
    const noShowCount = (data || []).filter(a => a.status === 'no_show').length;
    const cancelledCount = (data || []).filter(a => a.status === 'cancelled').length;

    return {
      client_id: clientId,
      total_appointments: total,
      no_show_count: noShowCount,
      cancelled_count: cancelledCount,
      no_show_rate: total > 0 ? Math.round((noShowCount / total) * 100) : 0,
    };
  },

  /**
   * List all clients with no-show stats (staff view).
   */
  async listAllStats() {
    const { data, error } = await supabaseAdmin
      .from('client_no_show_summary')
      .select('*')
      .order('no_show_count', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },
};

module.exports = noShowService;
