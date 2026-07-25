/**
 * reminderService.js
 *
 * Two reminder systems:
 *   1. APPOINTMENT REMINDERS — find appointments coming up in the next 24h
 *      and send SMS/in-app reminders.
 *   2. VACCINATION / DEWORMING REMINDERS — daily cron that marks overdue
 *      vaccinations and dispatches notifications based on configurable
 *      reminder templates.
 *
 * Tracks "already reminded" via a marker in status_history JSONB (appointments)
 * and reminder_sent_at on the vaccinations table (no schema change needed).
 *
 * Run appointment sweep via POST /api/admin/send-reminders (hourly is reasonable).
 * Run vaccination sweep via POST /api/admin/send-vaccination-reminders (daily).
 */
const { supabaseAdmin } = require('../config/supabase');
const smsService = require('./smsService');
const notificationService = require('./notificationService');
const logger = require('../utils/logger');

const REMINDER_MARKER = 'reminder_24h_sent';
const STAFF_ROLES = ['admin', 'veterinarian', 'staff'];

const reminderService = {

  /* ──────────────────── APPOINTMENT REMINDERS ───────────────── */

  async sendUpcomingReminders() {
    const now      = new Date();
    const in24h    = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in25h    = new Date(now.getTime() + 25 * 60 * 60 * 1000); // 1h window so we don't miss any

    const { data: appts, error } = await supabaseAdmin
      .from('appointments')
      .select(`
        id, status, appointment_at, status_history,
        pets(name),
        client:users!appointments_client_id_fkey(id, name, phone_number),
        vet:users!appointments_vet_id_fkey(name)
      `)
      .in('status', ['confirmed','pending'])
      .gte('appointment_at', in24h.toISOString())
      .lte('appointment_at', in25h.toISOString());

    if (error) throw new Error(error.message);

    let sent = 0, skipped = 0;
    for (const appt of appts || []) {
      // Skip if already reminded
      const history = Array.isArray(appt.status_history) ? appt.status_history : [];
      if (history.some(h => h.event === REMINDER_MARKER)) { skipped++; continue; }

      const apptDate = new Date(appt.appointment_at);
      const dateStr  = apptDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const timeStr  = apptDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const petName  = appt.pets?.name || 'your pet';
      const vetName  = appt.vet?.name  || 'the vet';

      if (appt.client?.id) {
        await notificationService.createWithSMS(appt.client.id, {
          title:   'Appointment Reminder',
          message: `Reminder: ${petName}'s appointment is tomorrow, ${dateStr} at ${timeStr} with ${vetName}.`,
          type:    'reminder',
          link:    '/client/appointments',
          smsBody: `PHVC: Reminder — ${petName}'s appointment is tomorrow ${dateStr} at ${timeStr} with ${vetName}.`,
        });
      }

      // Mark as reminded by appending to status_history
      const newHistory = [...history, { event: REMINDER_MARKER, at: new Date().toISOString() }];
      await supabaseAdmin.from('appointments')
        .update({ status_history: newHistory })
        .eq('id', appt.id);

      sent++;
    }

    logger.info('reminder', 'sweep complete', { sent, skipped, windowStart: in24h.toISOString(), windowEnd: in25h.toISOString() });
    return { sent, skipped, found: (appts || []).length };
  },

  /* ──────────────────── VACCINATION / DEWORMING REMINDERS ────── */

  /**
   * Daily cron — marks overdue vaccinations, then finds reminders
   * that need to be dispatched. Tries the SQL function first; falls
   * back to a JS-based approach if the migration hasn't been run yet.
   */
  async sendVaccinationReminders() {
    let sentCount = 0;

    // Step 1: Mark overdue
    try {
      const { data: overdueCount } = await supabaseAdmin
        .rpc('mark_overdue_vaccinations');
      if (overdueCount > 0) {
        logger.info('reminders', 'marked overdue', { count: overdueCount });
      }
    } catch (e) {
      logger.warn('reminders', 'mark_overdue_vaccinations failed', { msg: e.message });
    }

    // Step 2: Try SQL function first
    let reminders = [];
    try {
      const { data } = await supabaseAdmin.rpc('send_vaccination_reminders');
      reminders = data || [];
    } catch (e) {
      // SQL function doesn't exist yet — fall back to JS-based approach
      logger.warn('reminders', 'SQL function unavailable, using JS fallback', { msg: e.message });
      reminders = await this._getRemindersFallback();
    }

    if (reminders.length === 0) {
      logger.info('reminders', 'vaccination sweep — nothing to send');
      return { sent: 0 };
    }

    logger.info('reminders', 'processing', { count: reminders.length });

    // Dedupe: don't send the same vaccination_id + days_before_due twice in 24h
    for (const r of reminders) {
      try {
        await notificationService.createWithSMS(r.owner_id, {
          title:   r.title,
          message: r.message,
          type:    r.days_until < 0 ? 'warning' : 'info',
          link:    '/client/pets/' + r.pet_id,
          smsBody: `PHVC Reminder: ${r.message}`,
        });
        sentCount++;
      } catch (nErr) {
        logger.warn('reminders', 'notification failed', {
          vaccinationId: r.vaccination_id,
          msg: nErr.message,
        });
      }
    }

    logger.info('reminders', 'vaccination sweep done', { sent: sentCount });
    return { sent: sentCount };
  },

  /**
   * JS fallback for reminder generation when the SQL function
   * hasn't been created yet. Replicates the logic of
   * send_vaccination_reminders() using the Supabase client.
   */
  async _getRemindersFallback() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const horizon = new Date(today.getTime() + 14 * 86400000);

    // Fetch all scheduled/overdue vaccinations due within 14 days or overdue
    const { data: vaxes, error } = await supabaseAdmin
      .from('vaccinations')
      .select(`
        id, pet_id, vaccine_name, due_date, status, reminder_sent_at,
        pets!inner(id, name, owner_id)
      `)
      .or('status.eq.scheduled,status.eq.overdue')
      .not('due_date', 'is', null)
      .lte('due_date', horizon.toISOString().slice(0, 10));

    if (error || !vaxes) return [];

    const DEWORM_KEYWORDS = ['deworm', 'wormer', 'anthelmintic', 'praziquantel', 'fenbendazole',
      'pyrantel', 'milbemycin', 'ivermectin', 'heartworm'];

    const reminders = [];
    for (const v of vaxes) {
      const due = new Date(v.due_date + 'T00:00:00');
      const daysDiff = Math.round((due - today) / (86400000));
      const category = v.category || (DEWORM_KEYWORDS.some(k => (v.vaccine_name || '').toLowerCase().includes(k)) ? 'deworming' : 'vaccination');

      // Determine which reminder interval this falls into
      let matchedDays = null;
      if (daysDiff >= -1 && daysDiff <= 0) matchedDays = daysDiff;
      else if (daysDiff >= 1 && daysDiff <= 3) matchedDays = 1;
      else if (daysDiff >= 4 && daysDiff <= 10) matchedDays = 7;
      else if (daysDiff >= 11 && daysDiff <= 14) matchedDays = 14;

      if (matchedDays === null) continue;

      // Guard: skip if already sent recently (within 24h)
      if (v.reminder_sent_at) {
        const lastSent = new Date(v.reminder_sent_at);
        const hoursSince = (today.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
        if (hoursSince < 24) continue;
      }

      const petName = v.pets?.name || 'your pet';
      const catLabel = category === 'deworming' ? 'deworming' : 'vaccination';

      let title, message;
      if (daysDiff < 0) {
        title = `OVERDUE: ${v.vaccine_name} for ${petName}`;
        message = `${petName}'s ${catLabel} (${v.vaccine_name}) was due on ${v.due_date} and is now overdue. Please schedule as soon as possible.`;
      } else if (daysDiff === 0) {
        title = `${catLabel.charAt(0).toUpperCase() + catLabel.slice(1)} due today for ${petName}`;
        message = `${petName} is due for ${v.vaccine_name} today (${v.due_date}). Please visit your vet.`;
      } else if (daysDiff === 1) {
        title = `Tomorrow: ${v.vaccine_name} for ${petName}`;
        message = `${petName} is due for ${v.vaccine_name} tomorrow (${v.due_date}). Please confirm your appointment.`;
      } else if (daysDiff <= 7) {
        title = `Upcoming ${catLabel} for ${petName}`;
        message = `${petName}'s ${v.vaccine_name} is due in ${daysDiff} days on ${v.due_date}. Book an appointment.`;
      } else {
        title = `Upcoming ${catLabel} for ${petName}`;
        message = `${petName} is due for ${v.vaccine_name} on ${v.due_date}. Please schedule a visit.`;
      }

      reminders.push({
        vaccination_id: v.id,
        pet_id: v.pet_id,
        owner_id: v.pets.owner_id,
        pet_name: petName,
        vaccine_name: v.vaccine_name,
        due_date: v.due_date,
        category,
        days_until: daysDiff,
        title,
        message,
      });

      // Mark as sent
      await supabaseAdmin
        .from('vaccinations')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', v.id);
    }

    return reminders;
  },

  /* ──────────────────── CLIENT REMINDER VIEWS ────────────────── */

  /**
   * List all upcoming/due vaccination & deworming reminders for a client.
   * Grouped by pet.
   *
   * NOTE: category column is added via phase16_reminders.sql. If the migration
   * hasn't been run yet, `category` won't be in the result and all items will
   * show as 'vaccination'. Run the migration to get full deworming support.
   */
  async listForOwner(ownerId, requesterId, role, { daysAhead = 90 } = {}) {
    if (role === 'client' && ownerId !== requesterId) {
      throw new Error('Access denied.');
    }

    try { await supabaseAdmin.rpc('mark_overdue_vaccinations'); } catch (_) {}

    const today = new Date();
    const horizon = new Date(today.getTime() + daysAhead * 86400000);
    const horizonStr = horizon.toISOString().slice(0, 10);

    const { data, error } = await supabaseAdmin
      .from('vaccinations')
      .select(`
        id, pet_id, vaccine_name, manufacturer, dose, administered_date,
        due_date, status, notes, reminder_sent_at,
        created_at, updated_at,
        pets!inner(id, name, species, breed, owner_id)
      `)
      .eq('pets.owner_id', ownerId)
      .or('status.eq.scheduled,status.eq.overdue')
      .not('due_date', 'is', null)
      .lte('due_date', horizonStr)
      .order('due_date', { ascending: true });

    if (error) throw new Error(error.message);

    // Detect deworming from vaccine_name (works before/after category column migration)
    const DEWORM_KEYWORDS = ['deworm', 'wormer', 'anthelmintic', 'praziquantel', 'fenbendazole',
      'pyrantel', 'milbemycin', 'ivermectin', 'heartworm'];

    // Group by pet
    const byPet = {};
    for (const v of (data || [])) {
      const petId = v.pet_id;
      if (!byPet[petId]) {
        byPet[petId] = {
          pet: { id: v.pets.id, name: v.pets.name, species: v.pets.species, breed: v.pets.breed },
          reminders: [],
        };
      }
      // Infer category from name (column may or may not exist yet)
      const nameLower = (v.vaccine_name || '').toLowerCase();
      v.category = v.category || (DEWORM_KEYWORDS.some(k => nameLower.includes(k)) ? 'deworming' : 'vaccination');
      delete v.pets;
      byPet[petId].reminders.push(v);
    }

    return Object.values(byPet);
  },

  /**
   * All vaccinations + dewormings for a single pet (history + scheduled).
   */
  async listForPet(petId, userId, role) {
    if (role === 'client') {
      const { data: pet } = await supabaseAdmin
        .from('pets').select('owner_id').eq('id', petId).single();
      if (!pet || pet.owner_id !== userId) throw new Error('Access denied.');
    } else if (!STAFF_ROLES.includes(role)) {
      throw new Error('Access denied.');
    }

    const { data, error } = await supabaseAdmin
      .from('vaccinations')
      .select('*')
      .eq('pet_id', petId)
      .order('due_date', { ascending: false, nullsFirst: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  /**
   * Summary counts for dashboard badges.
   */
  async getSummary(userId, role) {
    if (role === 'veterinarian') return { upcoming: 0, overdue: 0 };

    try { await supabaseAdmin.rpc('mark_overdue_vaccinations'); } catch (_) {}

    const today = new Date().toISOString().slice(0, 10);

    let query = supabaseAdmin
      .from('vaccinations')
      .select('id, status, due_date, pets!inner(owner_id)')
      .or('status.eq.scheduled,status.eq.overdue');

    if (role === 'client') {
      query = query.eq('pets.owner_id', userId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const upcoming = (data || []).filter(v =>
      v.status === 'scheduled' && v.due_date >= today
    ).length;

    const overdue = (data || []).filter(v =>
      v.status === 'overdue' || (v.status === 'scheduled' && v.due_date < today)
    ).length;

    return { upcoming, overdue };
  },

  /**
   * Reminder templates for management UI.
   */
  async getTemplates() {
    const { data, error } = await supabaseAdmin
      .from('reminder_templates')
      .select('*')
      .order('category', { ascending: true })
      .order('days_before_due', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  },

  /**
   * Telehealth SMS reminders — send reminders for consultations
   * scheduled in the next 24 hours.
   * Run daily or hourly via cron.
   */
  async sendTelehealthReminders() {
    let sent = 0;
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    try {
      const { data: consults } = await supabaseAdmin
        .from('video_consultations')
        .select(`
          id, scheduled_at, subject, status,
          client:users!video_consultations_client_id_fkey(id, name, phone_number, sms_opt_in),
          vet:users!video_consultations_vet_id_fkey(id, name),
          pet:pets(name, species)
        `)
        .eq('status', 'scheduled')
        .not('scheduled_at', 'is', null)
        .gte('scheduled_at', now.toISOString())
        .lte('scheduled_at', in24h.toISOString());

      if (!consults || consults.length === 0) {
        logger.info('reminders', 'telehealth sweep — nothing to send');
        return { sent: 0 };
      }

      for (const c of consults) {
        try {
          const petName = c.pet?.name || 'your pet';
          const vetName = c.vet?.name || 'the vet';
          const timeStr = new Date(c.scheduled_at).toLocaleString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
          });

          // Notify client — in-app + SMS
          if (c.client?.id) {
            await notificationService.createWithSMS(c.client.id, {
              title:   '📹 Telehealth Reminder',
              message: `Your video consultation for ${petName} with ${vetName} is scheduled for ${timeStr}.`,
              type:    'reminder',
              link:    `/telehealth/${c.id}`,
              smsBody: `PHVC: Reminder — Your video consultation for ${petName} with ${vetName} is on ${timeStr}. Join from your dashboard.`,
            }).catch(() => null);
          }

          // Notify vet — in-app only
          if (c.vet?.id) {
            await notificationService.create(c.vet.id, {
              title:   '📹 Telehealth Reminder',
              message: `Video consultation for ${petName} scheduled for ${timeStr}.`,
              type:    'reminder',
              link:    `/telehealth/${c.id}`,
            }).catch(() => null);
          }

          sent++;
        } catch (e) {
          logger.warn('reminders', 'telehealth notify failed', { consultId: c.id, msg: e.message });
        }
      }
    } catch (e) {
      logger.error('reminders', 'telehealth sweep failed', { msg: e.message });
    }

    logger.info('reminders', 'telehealth sweep done', { sent });
    return { sent };
  },
};

module.exports = reminderService;
