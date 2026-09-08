/**
 * userManagementService.js
 * Admin-only user management: CRUD + audit log + password reset + CSV import.
 *
 * Notes:
 *   - All mutating ops record an entry in admin_audit_log.
 *   - Creating a user provisions a Supabase Auth identity (service role)
 *     then upserts the corresponding public.users row.
 *   - Suspending sets users.is_active=false and disables sign-ins by signing
 *     the user out of any active sessions.
 */
const { supabaseAdmin } = require('../config/supabase');
const crypto = require('crypto');
const logger = require('../utils/logger');

const ROLES = ['admin', 'veterinarian', 'staff', 'client'];

function genPassword() {
  // 16-char random password (URL-safe). The actual long-lived password is
  // chosen by the user when they accept the reset link.
  return crypto.randomBytes(12).toString('base64url');
}

async function log(actorId, targetId, action, { summary = null, before = null, after = null, meta = null } = {}) {
  try {
    await supabaseAdmin.from('admin_audit_log').insert({
      actor_id: actorId,
      target_id: targetId,
      action,
      summary,
      before_json: before,
      after_json: after,
      meta,
    });
  } catch (e) {
    // Audit failures must not block the primary action.
    console.error('[audit] failed to log', action, e?.message);
  }
}

const userManagementService = {

  // ──────────────────────────────────────────────────────────
  // Read
  // ──────────────────────────────────────────────────────────
  async listUsers({ q = '', role = null, status = 'all', limit = 50, offset = 0, sort = 'created_at', dir = 'desc' } = {}) {
    let query = supabaseAdmin
      .from('users')
      .select('id, email, name, role, phone_number, address, avatar_url, is_active, is_verified, created_at, updated_at, staff_profiles(license_number, specialization, position, department)', { count: 'exact' });

    if (role && ROLES.includes(role)) query = query.eq('role', role);
    if (status === 'active')    query = query.eq('is_active', true);
    if (status === 'suspended') query = query.eq('is_active', false);

    if (q && q.trim()) {
      const t = q.trim();
      // OR across name/email/phone using ilike.
      query = query.or(`name.ilike.%${t}%,email.ilike.%${t}%,phone_number.ilike.%${t}%`);
    }

    const validSort = ['created_at', 'name', 'email', 'role', 'is_active'].includes(sort) ? sort : 'created_at';
    query = query.order(validSort, { ascending: dir === 'asc' });
    query = query.range(offset, offset + Math.max(1, Math.min(200, limit)) - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    return { items: data || [], total: count || 0, limit, offset };
  },

  async getUser(id) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, role, phone_number, address, avatar_url, is_active, is_verified, created_at, updated_at, staff_profiles(*)')
      .eq('id', id)
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async getUserActivity(id) {
    // Returns a small bundle of recent activity for the user.
    const [pets, appts, msgs, audits] = await Promise.all([
      supabaseAdmin.from('pets').select('id, name, species, breed, created_at').eq('owner_id', id).order('created_at', { ascending: false }).limit(20),
      supabaseAdmin.from('appointments').select('id, appointment_at, status, reason').or(`client_id.eq.${id},vet_id.eq.${id}`).order('appointment_at', { ascending: false }).limit(20),
      supabaseAdmin.from('messages').select('id, kind, created_at, conversation_id').eq('sender_id', id).order('created_at', { ascending: false }).limit(20),
      supabaseAdmin.from('admin_audit_log').select('id, action, summary, created_at, actor_id').eq('target_id', id).order('created_at', { ascending: false }).limit(50),
    ]);

    return {
      pets:        pets.data || [],
      appointments: appts.data || [],
      messages:    msgs.data || [],
      audit:       audits.data || [],
    };
  },

  async listAuditLog({ limit = 100, offset = 0 } = {}) {
    const { data, error, count } = await supabaseAdmin
      .from('admin_audit_log')
      .select('id, actor_id, target_id, action, summary, created_at, before_json, after_json, meta', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(error.message);

    // Attach actor + target names for display
    const ids = new Set();
    (data || []).forEach(r => { if (r.actor_id) ids.add(r.actor_id); if (r.target_id) ids.add(r.target_id); });
    let usersById = {};
    if (ids.size) {
      const { data: u } = await supabaseAdmin
        .from('users').select('id, name, email, role')
        .in('id', Array.from(ids));
      (u || []).forEach(x => { usersById[x.id] = x; });
    }
    const rows = (data || []).map(r => ({
      ...r,
      actor:  usersById[r.actor_id]  || null,
      target: usersById[r.target_id] || null,
    }));
    return { items: rows, total: count || 0, limit, offset };
  },

  // ──────────────────────────────────────────────────────────
  // Create
  // ──────────────────────────────────────────────────────────
  async createUser(actorId, payload) {
    const {
      email, name, role,
      phone_number = null, address = null,
      license_number = null, specialization = null,
      position = null, department = null,
      send_invite = true,
    } = payload;

    if (!email || !name || !role) throw new Error('email, name, and role are required');
    if (!ROLES.includes(role))    throw new Error('Invalid role');

    // 1) Create the Supabase Auth user.
    const password = genPassword();
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,                // mark verified — they'll reset password via invite
      user_metadata: { name, role },
    });
    if (createErr) throw new Error(createErr.message);
    const newId = created.user.id;

    // 2) Insert/upsert the public.users row.
    const { data: row, error: upErr } = await supabaseAdmin
      .from('users')
      .upsert({
        id: newId,
        email,
        name,
        role,
        phone_number,
        address,
        is_active:   true,
        is_verified: true,
      })
      .select()
      .single();
    if (upErr) {
      // Best-effort cleanup if the auth user was made but profile failed
      try { await supabaseAdmin.auth.admin.deleteUser(newId); } catch (_) {}
      throw new Error(upErr.message);
    }

    // 3) Optional staff profile for vet/staff
    if (role === 'veterinarian' || role === 'staff') {
      const sp = {
        user_id: newId,
        license_number: role === 'veterinarian' ? license_number : null,
        specialization: role === 'veterinarian' ? specialization : null,
        position:       role === 'staff'        ? position       : null,
        department,
      };
      await supabaseAdmin.from('staff_profiles').upsert(sp, { onConflict: 'user_id' });
    }

    // 4) Optionally send a password-reset/invite email
    let invite_link = null;
    if (send_invite) {
      try {
        const { data: link } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email,
        });
        invite_link = link?.properties?.action_link || null;
      } catch (e) {
        console.error('[user-mgmt] generateLink failed', e?.message);
      }
    }

    await log(actorId, newId, 'create_user', {
      summary: `Created ${role} account for ${email}`,
      after:   row,
      meta:    { sent_invite: send_invite },
    });

    return { user: row, invite_link };
  },

  // ──────────────────────────────────────────────────────────
  // Update
  // ──────────────────────────────────────────────────────────
  async updateUser(actorId, id, patch) {
    const before = await this.getUser(id);

    const cols = ['name', 'email', 'phone_number', 'address', 'avatar_url'];
    const updates = {};
    for (const c of cols) {
      if (patch[c] !== undefined) updates[c] = patch[c];
    }
    if (Object.keys(updates).length === 0 && patch.role === undefined) {
      return before;
    }

    if (updates.email && updates.email !== before.email) {
      // Mirror the change into Supabase auth.
      try { await supabaseAdmin.auth.admin.updateUserById(id, { email: updates.email }); } catch (e) {
        throw new Error('Could not update email: ' + e.message);
      }
    }

    if (Object.keys(updates).length) {
      const { error } = await supabaseAdmin.from('users').update(updates).eq('id', id);
      if (error) throw new Error(error.message);
    }

    let action = 'update_user';
    let summary = 'Updated profile';
    if (patch.role && patch.role !== before.role) {
      if (!ROLES.includes(patch.role)) throw new Error('Invalid role');
      const { error } = await supabaseAdmin.from('users').update({ role: patch.role }).eq('id', id);
      if (error) throw new Error(error.message);
      // Drop staff_profile if role moved off staff/vet
      if (patch.role === 'client' || patch.role === 'admin') {
        await supabaseAdmin.from('staff_profiles').delete().eq('user_id', id);
      }
      action = 'change_role';
      summary = `Changed role: ${before.role} → ${patch.role}`;
    }

    // Update staff_profiles fields if vet/staff
    const sp = {};
    ['license_number','specialization','position','department'].forEach(k => {
      if (patch[k] !== undefined) sp[k] = patch[k];
    });
    const finalRole = patch.role || before.role;
    if (Object.keys(sp).length && (finalRole === 'veterinarian' || finalRole === 'staff')) {
      sp.user_id = id;
      await supabaseAdmin.from('staff_profiles').upsert(sp, { onConflict: 'user_id' });
    }

    const after = await this.getUser(id);
    await log(actorId, id, action, { summary, before, after });
    return after;
  },

  // ──────────────────────────────────────────────────────────
  // Suspend / Reactivate
  // ──────────────────────────────────────────────────────────
  async setActive(actorId, id, active) {
    const before = await this.getUser(id);
    if (before.is_active === active) return before;

    const { error } = await supabaseAdmin
      .from('users')
      .update({ is_active: active })
      .eq('id', id);
    if (error) throw new Error(error.message);

    if (!active) {
      // Force any active sessions to be invalidated.
      try { await supabaseAdmin.auth.admin.signOut(id); } catch (_) {}
    }

    const after = await this.getUser(id);
    await log(actorId, id, active ? 'reactivate' : 'suspend', {
      summary: active ? 'Reactivated account' : 'Suspended account',
      before, after,
    });
    return after;
  },

  // ──────────────────────────────────────────────────────────
  // Force verify
  // ──────────────────────────────────────────────────────────
  async forceVerify(actorId, id) {
    const before = await this.getUser(id);
    const { error } = await supabaseAdmin
      .from('users').update({ is_verified: true }).eq('id', id);
    if (error) throw new Error(error.message);
    const after = await this.getUser(id);
    await log(actorId, id, 'verify_user', { summary: 'Marked account as verified', before, after });
    return after;
  },

  // ──────────────────────────────────────────────────────────
  // Password reset / invite link
  // ──────────────────────────────────────────────────────────
  async sendPasswordReset(actorId, id) {
    const user = await this.getUser(id);
    if (!user) throw new Error('User not found');
    let link = null;
    try {
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: user.email,
      });
      if (error) throw error;
      link = data?.properties?.action_link || null;
    } catch (e) {
      throw new Error('Could not generate reset link: ' + e.message);
    }
    await log(actorId, id, 'reset_password', { summary: `Generated password reset for ${user.email}` });
    return { link };
  },

  // ──────────────────────────────────────────────────────────
  // Delete (hard)
  // ──────────────────────────────────────────────────────────
  async deleteUser(actorId, id) {
    const before = await this.getUser(id).catch(() => null);
    if (!before) return { ok: true };

    // Remove/detach every record that references public.users(id), so the
    // auth user can always be deleted regardless of whether the DB-level
    // CASCADE/SET NULL migrations (phase15_user_delete_cascade.sql and
    // later fix-ups) have actually been applied on this project. Each
    // operation is independently fault-tolerant — a table that doesn't
    // exist yet, or one that already cascades at the DB level, must never
    // block the others.
    // Collect (rather than just log) any pre-cleanup failure that ISN'T
    // "this table doesn't exist" — those are almost always a real
    // constraint violation (e.g. trying to null out a NOT NULL column)
    // and are exactly what we need to see if the final delete still fails.
    const cleanupIssues = [];
    const safe = (label, p) => Promise.resolve(p).then(({ error } = {}) => {
      if (error && !/relation .* does not exist|schema cache/i.test(error.message)) {
        cleanupIssues.push(`${label}: ${error.message}`);
      }
    }).catch((e) => {
      if (!/relation .* does not exist|schema cache/i.test(e.message || '')) {
        cleanupIssues.push(`${label}: ${e.message}`);
      }
    });

    // "Owner" columns — the record only makes sense tied to this user, so
    // it's deleted outright (mirrors ON DELETE CASCADE). appointments is
    // handled separately below since both client_id and vet_id qualify.
    // NOTE: any column that is NOT NULL must go here, not in nullOuts —
    // you can't null out a NOT NULL column (emr_files.uploaded_by was
    // wrongly treated as nullable before, which is exactly what kept
    // blocking deletes even after the previous fix).
    const deletes = [
      ['medical_records',         'vet_id'],
      ['payments',                'user_id'],
      ['soap_notes',              'vet_id'],
      ['prescriptions',           'vet_id'],
      ['treatments',              'vet_id'],
      ['refill_requests',         'requested_by'],
      ['discharge_instructions',  'vet_id'],
      ['passport_shares',         'created_by'],
      ['messages',                'sender_id'],
      ['emr_files',               'uploaded_by'],  // NOT NULL — must delete, not null out
    ];

    // "Who performed this action" columns — nullable, so the record
    // belongs to someone else and survives; only the reference to this
    // user is cleared (mirrors ON DELETE SET NULL).
    const nullOuts = [
      ['appointments',                 'triaged_by'],
      ['appointments',                 'approved_by'],
      ['appointments',                 'cancelled_by'],
      ['appointments',                 'declined_by'],
      ['conversations',                'assigned_vet_id'],
      ['vaccinations',                 'vet_id'],
      ['pet_weights',                  'recorded_by'],
      ['appointment_intakes',          'submitted_by'],
      ['refill_requests',              'processed_by'],
      ['video_consultations',          'vet_id'],
      ['video_consultations',          'created_by'],
      ['health_check_results',         'performed_by'],
      ['prescriptive_resource_usage',  'used_by'],
      ['prescriptive_actions',         'acted_by'],
    ];

    await Promise.all([
      safe('appointments(client/vet)', supabaseAdmin.from('appointments').delete().or(`client_id.eq.${id},vet_id.eq.${id}`)),
      ...deletes.map(([table, column]) => safe(`${table}.${column} (delete)`, supabaseAdmin.from(table).delete().eq(column, id))),
      ...nullOuts.map(([table, column]) => safe(`${table}.${column} (null out)`, supabaseAdmin.from(table).update({ [column]: null }).eq(column, id))),
    ]);

    // Delete the Supabase Auth user; ON DELETE CASCADE on public.users.id
    // removes the profile row and any remaining cascaded children.
    try {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (error) throw error;
    } catch (e) {
      logger.error('deleteUser', `Failed to delete auth user ${id}: ${e.message}`, { cleanupIssues });
      const detail = cleanupIssues.length
        ? ' Pre-cleanup could not fully clear: ' + cleanupIssues.join('; ') + '.'
        : ' No pre-cleanup step reported an error, so this is likely a table not yet accounted for at all.';
      throw new Error('Could not delete account: ' + e.message + '.' + detail);
    }

    await log(actorId, null, 'delete_user', {
      summary: `Deleted ${before.role} ${before.email}`,
      before,
      meta: { deleted_user_id: id },
    });
    return { ok: true };
  },

  // ──────────────────────────────────────────────────────────
  // Bulk import (CSV-shaped JSON)
  //   payload.users = [{ email, name, role, phone_number?, ... }, ...]
  // ──────────────────────────────────────────────────────────
  async bulkImport(actorId, rows, opts = {}) {
    const send_invite = opts.send_invite !== false;
    const out = { ok: [], failed: [] };

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        const res = await this.createUser(actorId, { ...r, send_invite });
        out.ok.push({ row: i + 1, id: res.user.id, email: r.email });
      } catch (e) {
        out.failed.push({ row: i + 1, email: r.email, error: e.message });
      }
    }
    await log(actorId, null, 'bulk_import', {
      summary: `Bulk import: ${out.ok.length} ok / ${out.failed.length} failed`,
      meta: { ok: out.ok.length, failed: out.failed.length },
    });
    return out;
  },
};

module.exports = userManagementService;
