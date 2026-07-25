/**
 * passportService.js
 *
 * Backend for the Multi-Pet Digital Health Passport module.
 *
 * Domain model:
 *   - The "passport" of a pet is an aggregate of everything we know
 *     about them: profile, vaccinations (with color-coded status),
 *     weight history, recent visits, prescriptions, and files.
 *   - Color-coded vaccination status comes from the
 *     passport_vaccination_status_v view (protected / expiring_soon
 *     / overdue / scheduled / cancelled).
 *   - The "share" feature mints a one-shot token that an unauth'd
 *     client can use to fetch a read-only snapshot via
 *     getByShareToken().
 *
 * Roles:
 *   admin / vet           full read + write
 *   staff                 read + add weight points + create shares
 *   client                read own pets' passports + create shares
 *                         scoped to their own pets
 */
const { supabaseAdmin } = require('../config/supabase');
const emailService = require('./emailService');
const logger = require('../utils/logger');

const STAFF_ROLES = ['admin', 'veterinarian', 'staff'];
const WRITE_ROLES = ['admin', 'veterinarian'];

function assertReadable(role) {
  if (![...STAFF_ROLES, 'client'].includes(role)) throw new Error('Access denied.');
}

async function assertPetVisible(petId, userId, role) {
  assertReadable(role);
  const { data: pet, error } = await supabaseAdmin
    .from('pets').select('id, owner_id, name, species, breed, age, gender, weight_kg, color, notes, created_at')
    .eq('id', petId).single();
  if (error || !pet) throw new Error('Pet not found.');
  if (role === 'client' && pet.owner_id !== userId) throw new Error('Access denied: not your pet.');
  return pet;
}

const passportService = {

  /* ─────────────────────── DASHBOARD ───────────────────────── */

  /**
   * Per-client passport summary used by the multi-pet dashboard.
   * Staff/admin: pass `clientId` to scope, or null for everyone.
   * Client role: ignored and forced to their own user id.
   */
  async listClientPassports(userId, role, { clientId = null } = {}) {
    assertReadable(role);
    const owner = role === 'client' ? userId : clientId;

    let q = supabaseAdmin.from('passport_summary_v').select('*').order('name', { ascending: true });
    if (owner) q = q.eq('owner_id', owner);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
  },

  /* ─────────────────────── PASSPORT ────────────────────────── */

  /**
   * Full passport payload for one pet.
   */
  async getPetPassport(petId, userId, role) {
    const pet = await assertPetVisible(petId, userId, role);

    const owner = await supabaseAdmin
      .from('users').select('id, name, email, phone_number')
      .eq('id', pet.owner_id).single();

    const [vax, weights, records, files, prescriptions, summary] = await Promise.all([
      supabaseAdmin.from('passport_vaccination_status_v')
        .select('*').eq('pet_id', petId)
        .order('due_date', { ascending: true, nullsFirst: false }),

      supabaseAdmin.from('pet_weights')
        .select('id, weight_kg, body_condition_score, recorded_at, notes, recorded_by')
        .eq('pet_id', petId).order('recorded_at', { ascending: true }),

      supabaseAdmin.from('medical_records')
        .select('id, visit_date, diagnosis, treatment, notes, follow_up_date')
        .eq('pet_id', petId).order('visit_date', { ascending: false }).limit(10),

      supabaseAdmin.from('emr_files')
        .select('id, kind, title, description, mime_type, size_bytes, storage_path, created_at')
        .eq('pet_id', petId).eq('is_archived', false)
        .order('created_at', { ascending: false }),

      supabaseAdmin.from('prescriptions')
        .select('id, medication_name, dosage, frequency, route, start_date, end_date, status')
        .eq('pet_id', petId).order('start_date', { ascending: false }),

      supabaseAdmin.from('passport_summary_v')
        .select('overall_vax_status, vax_protected, vax_expiring, vax_overdue, current_weight_kg, current_bcs, weight_last_at, visits_total, files_total')
        .eq('pet_id', petId).single(),
    ]);

    return {
      pet,
      owner: owner?.data || null,
      summary: summary?.data || null,
      vaccinations: vax?.data || [],
      weightSeries: weights?.data || [],
      recentVisits: records?.data || [],
      files:        files?.data || [],
      prescriptions: prescriptions?.data || [],
    };
  },

  /* ─────────────────────── WEIGHT TRACKER ──────────────────── */

  async listWeights(petId, userId, role) {
    await assertPetVisible(petId, userId, role);
    const { data, error } = await supabaseAdmin
      .from('pet_weights')
      .select('id, weight_kg, body_condition_score, recorded_at, notes, recorded_by')
      .eq('pet_id', petId).order('recorded_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async addWeight(actorId, role, payload) {
    if (![...STAFF_ROLES].includes(role)) throw new Error('Access denied.');
    const { petId, weightKg, bodyConditionScore, recordedAt, notes } = payload;
    if (!petId)             throw new Error('petId is required.');
    if (weightKg == null)   throw new Error('weightKg is required.');
    if (Number(weightKg) <= 0 || Number(weightKg) >= 500) throw new Error('weightKg out of range.');

    await assertPetVisible(petId, actorId, role);

    const insert = {
      pet_id:        petId,
      recorded_by:   actorId,
      weight_kg:     Number(weightKg),
      body_condition_score: bodyConditionScore || null,
      recorded_at:   recordedAt ? new Date(recordedAt).toISOString() : new Date().toISOString(),
      notes:         notes || null,
    };
    const { data, error } = await supabaseAdmin
      .from('pet_weights').insert(insert).select().single();
    if (error) throw new Error(error.message);

    // Also keep the snapshot column on `pets.weight_kg` in sync, for
    // backwards-compat with existing UI that reads from pets.
    await supabaseAdmin.from('pets').update({ weight_kg: insert.weight_kg }).eq('id', petId);

    return data;
  },

  async deleteWeight(id, role) {
    if (!WRITE_ROLES.includes(role)) throw new Error('Access denied.');
    const { error } = await supabaseAdmin.from('pet_weights').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { deleted: true };
  },

  /* ─────────────────────── SHARING ─────────────────────────── */

  /**
   * Mint a tokenized share and (optionally) email it to a recipient.
   * Always returns the share URL; `emailed` indicates whether SMTP
   * was actually able to deliver.
   */
  async createShare(actorId, role, payload, { appBaseUrl = '' } = {}) {
    assertReadable(role);
    const { petId, recipientEmail, message, ttlDays } = payload;
    if (!petId)          throw new Error('petId is required.');
    if (!recipientEmail) throw new Error('recipientEmail is required.');

    const pet = await assertPetVisible(petId, actorId, role);

    const ttl = Math.min(Math.max(parseInt(ttlDays || 30, 10), 1), 365);
    const expiresAt = new Date(Date.now() + ttl * 86400000).toISOString();

    const { data: share, error } = await supabaseAdmin
      .from('passport_shares')
      .insert({
        pet_id:          petId,
        created_by:      actorId,
        recipient_email: recipientEmail,
        message:         message || null,
        expires_at:      expiresAt,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const url = `${appBaseUrl || ''}/passport/share/${share.token}`;
    let emailed = false;
    let emailReason = 'not attempted';

    if (emailService.isConfigured()) {
      const html = `
        <p>Hello,</p>
        <p>You have been invited to view the digital health passport for
        <strong>${pet.name}</strong> on VETLINK.</p>
        ${message ? `<blockquote style="border-left:3px solid #2563eb;margin:12px 0;padding:6px 12px;color:#475569;">${escapeHtml(message)}</blockquote>` : ''}
        <p>
          <a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;">
            View health passport
          </a>
        </p>
        <p style="color:#94a3b8;font-size:12px;">This link expires on ${new Date(expiresAt).toUTCString()}.</p>
        <p style="color:#94a3b8;font-size:12px;">If the button doesn't work, copy and paste this URL: ${url}</p>
      `;
      const res = await emailService.send({
        to: recipientEmail,
        subject: `Health passport for ${pet.name}`,
        html,
      });
      emailed = res.delivered;
      emailReason = res.reason || 'sent';
      if (emailed) {
        await supabaseAdmin.from('passport_shares')
          .update({ emailed_at: new Date().toISOString() }).eq('id', share.id);
      }
    } else {
      emailReason = 'SMTP not configured';
    }

    logger.info('passport', 'share.created', { id: share.id, petId, emailed });

    return { share, url, emailed, emailReason };
  },

  async listSharesForPet(petId, userId, role) {
    await assertPetVisible(petId, userId, role);
    const { data, error } = await supabaseAdmin
      .from('passport_shares')
      .select('id, recipient_email, status, view_count, last_viewed_at, emailed_at, expires_at, created_at, message')
      .eq('pet_id', petId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async revokeShare(id, actorId, role) {
    assertReadable(role);
    const { data: existing } = await supabaseAdmin
      .from('passport_shares').select('id, pet_id, created_by').eq('id', id).single();
    if (!existing) throw new Error('Share not found.');
    // Clients can only revoke their own shares; staff can revoke any.
    if (role === 'client' && existing.created_by !== actorId) {
      throw new Error('Access denied.');
    }
    const { error } = await supabaseAdmin
      .from('passport_shares').update({ status: 'revoked' }).eq('id', id);
    if (error) throw new Error(error.message);
    return { revoked: true };
  },

  /**
   * Public endpoint reader — no auth. Token is the secret.
   * Returns the same shape as getPetPassport, minus owner PII.
   */
  async getByShareToken(token) {
    if (!token) throw new Error('Token required.');

    const { data: share, error } = await supabaseAdmin
      .from('passport_shares').select('*').eq('token', token).single();
    if (error || !share) throw new Error('Invalid share link.');
    if (share.status !== 'active')   throw new Error('This share link has been revoked.');
    if (new Date(share.expires_at) <= new Date()) {
      await supabaseAdmin.from('passport_shares')
        .update({ status: 'expired' }).eq('id', share.id);
      throw new Error('This share link has expired.');
    }

    // Bump the view counter & timestamp (don't await — fire and forget).
    supabaseAdmin.from('passport_shares').update({
      view_count: share.view_count + 1,
      last_viewed_at: new Date().toISOString(),
    }).eq('id', share.id).then(() => {});

    const petId = share.pet_id;
    const [pet, vax, weights, records, prescriptions, summary] = await Promise.all([
      supabaseAdmin.from('pets')
        .select('id, name, species, breed, age, gender, color, weight_kg').eq('id', petId).single(),
      supabaseAdmin.from('passport_vaccination_status_v')
        .select('*').eq('pet_id', petId).order('due_date', { ascending: true, nullsFirst: false }),
      supabaseAdmin.from('pet_weights')
        .select('weight_kg, body_condition_score, recorded_at')
        .eq('pet_id', petId).order('recorded_at', { ascending: true }),
      supabaseAdmin.from('medical_records')
        .select('id, visit_date, diagnosis, treatment, notes').eq('pet_id', petId)
        .order('visit_date', { ascending: false }).limit(10),
      supabaseAdmin.from('prescriptions')
        .select('id, medication_name, dosage, frequency, route, start_date, end_date, status')
        .eq('pet_id', petId).order('start_date', { ascending: false }).limit(10),
      supabaseAdmin.from('passport_summary_v')
        .select('overall_vax_status, vax_protected, vax_expiring, vax_overdue, current_weight_kg, current_bcs, weight_last_at, visits_total')
        .eq('pet_id', petId).single(),
    ]);

    return {
      shareInfo: {
        id:         share.id,
        recipient:  share.recipient_email,
        expiresAt:  share.expires_at,
        viewCount:  share.view_count + 1,
        sharedAt:   share.created_at,
      },
      pet:           pet?.data || null,
      summary:       summary?.data || null,
      vaccinations:  vax?.data || [],
      weightSeries:  weights?.data || [],
      recentVisits:  records?.data || [],
      prescriptions: prescriptions?.data || [],
    };
  },

};

// ── tiny helper: escape user-supplied HTML to prevent injection
//   inside the share email body
function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

module.exports = passportService;
