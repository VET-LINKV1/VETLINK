/**
 * settingsService.js
 * Centralized, admin-only configuration store for the VETLINK Settings module.
 *
 * All config tables are single-row (id = 'default') except:
 *   • roles            — catalog of the six staff roles
 *   • role_permissions — RBAC matrix (role × module × permission)
 *   • branches / rooms — branch + room inventory
 *
 * Every mutating op records an entry in admin_audit_log via the
 * log_settings_change helper so configuration changes are auditable.
 *
 * SECURITY:
 *   • PayMongo secret keys are NEVER read from or written to the database.
 *     Only a boolean `paymongo_secret_set` flag and the public key are stored.
 *   • Audit rows are append-only; this service only ever inserts audit rows.
 */
const { supabaseAdmin } = require('../config/supabase');
const smsService = require('./smsService');

const DEFAULT_ID = 'default';
const CONFIG_TABLES = {
  clinic:        'settings_clinic',
  appointments:  'settings_appointments',
  pets:          'settings_pets',
  prescriptions: 'settings_prescriptions',
  laboratory:    'settings_laboratory',
  billing:       'settings_billing',
  notifications: 'settings_notifications',
  security:      'settings_security',
  system:        'settings_system',
};

// ── Audit helper ────────────────────────────────────────────────────────────
async function logSettingsChange(actorId, module, summary, { before = null, after = null, meta = null } = {}) {
  try {
    await supabaseAdmin.from('admin_audit_log').insert({
      actor_id: actorId,
      action: 'config_change',
      module,
      summary,
      before_json: before,
      after_json: after,
      meta,
    });
  } catch (e) {
    // Audit failures must never block the primary action.
    console.error('[audit] settings change log failed', module, e?.message);
  }
}

// ── Generic single-row config read/write ────────────────────────────────────
async function getConfigRow(table) {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select('*')
    .eq('id', DEFAULT_ID)
    .maybeSingle();
  if (error) throw new Error('Failed to read ' + table + ': ' + error.message);
  if (!data) {
    // Seed if missing (migration normally seeds, but be defensive).
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from(table).insert({ id: DEFAULT_ID }).select('*').maybeSingle();
    if (insErr) throw new Error('Failed to seed ' + table + ': ' + insErr.message);
    return inserted;
  }
  return data;
}

async function updateConfigRow(table, patch, actorId, moduleKey, summary, before) {
  const { data, error } = await supabaseAdmin
    .from(table)
    .update(patch)
    .eq('id', DEFAULT_ID)
    .select('*')
    .maybeSingle();
  if (error) throw new Error('Failed to update ' + table + ': ' + error.message);
  await logSettingsChange(actorId, moduleKey, summary, { before, after: data });
  return data;
}

// ── Field mappers (DB snake_case ⇄ frontend camelCase) ───────────────────────
const pick = (obj, keys) => {
  const out = {};
  keys.forEach(k => { if (obj[k] !== undefined) out[k] = obj[k]; });
  return out;
};

const clinicMap = {
  to: r => ({
    name: r.name, shortName: r.short_name, email: r.email, phone: r.phone, mobile: r.mobile,
    website: r.website, logoUrl: r.logo_url, addressLine: r.address_line, city: r.city,
    state: r.state, postalCode: r.postal_code, country: r.country, timezone: r.timezone,
    currency: r.currency, emergencyName: r.emergency_name, emergencyPhone: r.emergency_phone,
    operatingHours: r.operating_hours,
  }),
  from: p => ({
    name: p.name, short_name: p.shortName, email: p.email, phone: p.phone, mobile: p.mobile,
    website: p.website, logo_url: p.logoUrl, address_line: p.addressLine, city: p.city,
    state: p.state, postal_code: p.postalCode, country: p.country, timezone: p.timezone,
    currency: p.currency, emergency_name: p.emergencyName, emergency_phone: p.emergencyPhone,
    operating_hours: p.operatingHours,
  }),
};

const appointmentsMap = {
  to: r => ({
    defaultDuration: r.default_duration, allowCustomDuration: r.allow_custom_duration,
    customDurations: r.custom_durations, appointmentTypes: r.appointment_types,
    cancellationHours: r.cancellation_hours, rescheduleLimit: r.reschedule_limit,
    checkInWindow: r.check_in_window, noShowGrace: r.no_show_grace, noShowAction: r.no_show_action,
    onlineBooking: r.online_booking, bookingLeadDays: r.booking_lead_days,
    requireDeposit: r.require_deposit, depositPercent: r.deposit_percent,
    vetSchedulingMode: r.vet_scheduling_mode,
  }),
  from: p => ({
    default_duration: p.defaultDuration, allow_custom_duration: p.allowCustomDuration,
    custom_durations: p.customDurations, appointment_types: p.appointmentTypes,
    cancellation_hours: p.cancellationHours, reschedule_limit: p.rescheduleLimit,
    check_in_window: p.checkInWindow, no_show_grace: p.noShowGrace, no_show_action: p.noShowAction,
    online_booking: p.onlineBooking, booking_lead_days: p.bookingLeadDays,
    require_deposit: p.requireDeposit, deposit_percent: p.depositPercent,
    vet_scheduling_mode: p.vetSchedulingMode,
  }),
};

const petsMap = {
  to: r => ({
    weightUnit: r.weight_unit, tempUnit: r.temp_unit, species: r.species, breeds: r.breeds,
    vaccineTypes: r.vaccine_types, allergyCategories: r.allergy_categories,
    recordCategories: r.record_categories, idFields: r.id_fields, bcsScale: r.bcs_scale,
  }),
  from: p => ({
    weight_unit: p.weightUnit, temp_unit: p.tempUnit, species: p.species, breeds: p.breeds,
    vaccine_types: p.vaccineTypes, allergy_categories: p.allergyCategories,
    record_categories: p.recordCategories, id_fields: p.idFields, bcs_scale: p.bcsScale,
  }),
};

const prescriptionsMap = {
  to: r => ({
    medicationCatalog: r.medication_catalog, dosageUnits: r.dosage_units,
    frequencyOptions: r.frequency_options, maxRefills: r.max_refills,
    refillLeadDays: r.refill_lead_days, validityDays: r.validity_days,
    requireVetApproval: r.require_vet_approval, approvalThreshold: r.approval_threshold,
  }),
  from: p => ({
    medication_catalog: p.medicationCatalog, dosage_units: p.dosageUnits,
    frequency_options: p.frequencyOptions, max_refills: p.maxRefills,
    refill_lead_days: p.refillLeadDays, validity_days: p.validityDays,
    require_vet_approval: p.requireVetApproval, approval_threshold: p.approvalThreshold,
  }),
};

const laboratoryMap = {
  to: r => ({
    testTypes: r.test_types, categories: r.categories, units: r.units,
    referenceRanges: r.reference_ranges, resultStatuses: r.result_statuses,
    requireApproval: r.require_approval, autoVerifyBelow: r.auto_verify_below,
  }),
  from: p => ({
    test_types: p.testTypes, categories: p.categories, units: p.units,
    reference_ranges: p.referenceRanges, result_statuses: p.resultStatuses,
    require_approval: p.requireApproval, auto_verify_below: p.autoVerifyBelow,
  }),
};

const billingMap = {
  // Never expose any secret key. Only a boolean is returned.
  to: r => ({
    currency: r.currency, taxEnabled: r.tax_enabled, taxRate: r.tax_rate, taxLabel: r.tax_label,
    serviceChargeEnabled: r.service_charge_enabled, serviceChargeRate: r.service_charge_rate,
    invoicePrefix: r.invoice_prefix, invoiceStart: r.invoice_start, paymentMethods: r.payment_methods,
    refundPolicy: r.refund_policy, refundWindowDays: r.refund_window_days,
    paymongo: {
      connected: r.paymongo_connected,
      mode: r.paymongo_mode,
      publicKey: r.paymongo_public_key || '',
      secretKeySet: !!r.paymongo_secret_set,
    },
  }),
  from: p => {
    const out = {};
    if (p.currency !== undefined) out.currency = p.currency;
    if (p.taxEnabled !== undefined) out.tax_enabled = p.taxEnabled;
    if (p.taxRate !== undefined) out.tax_rate = p.taxRate;
    if (p.taxLabel !== undefined) out.tax_label = p.taxLabel;
    if (p.serviceChargeEnabled !== undefined) out.service_charge_enabled = p.serviceChargeEnabled;
    if (p.serviceChargeRate !== undefined) out.service_charge_rate = p.serviceChargeRate;
    if (p.invoicePrefix !== undefined) out.invoice_prefix = p.invoicePrefix;
    if (p.invoiceStart !== undefined) out.invoice_start = p.invoiceStart;
    if (p.paymentMethods !== undefined) out.payment_methods = p.paymentMethods;
    if (p.refundPolicy !== undefined) out.refund_policy = p.refundPolicy;
    if (p.refundWindowDays !== undefined) out.refund_window_days = p.refundWindowDays;
    if (p.paymongo) {
      const pg = p.paymongo;
      if (pg.connected !== undefined) out.paymongo_connected = pg.connected;
      if (pg.mode !== undefined) out.paymongo_mode = pg.mode;
      if (pg.publicKey !== undefined) out.paymongo_public_key = pg.publicKey || null;
      // secretKeySet only flips the flag; the secret value itself is never stored here.
      if (pg.secretKeySet !== undefined) out.paymongo_secret_set = !!pg.secretKeySet;
    }
    return out;
  },
};

const notificationsMap = {
  to: r => ({
    clicksend: {
      enabled: r.clicksend_enabled,
      from: r.clicksend_from || '',
      senderId: r.clicksend_sender_id || '',
      connected: r.clicksend_connected,
    },
    channels: r.channels || {},
    reminderLeadHours: r.reminder_lead_hours || [],
    emailFrom: r.email_from || '',
    templates: r.templates || {},
  }),
  from: p => {
    const out = {};
    if (p.clicksend) {
      const cs = p.clicksend;
      if (cs.enabled !== undefined) out.clicksend_enabled = cs.enabled;
      if (cs.from !== undefined) out.clicksend_from = cs.from || null;
      if (cs.senderId !== undefined) out.clicksend_sender_id = cs.senderId || null;
      if (cs.connected !== undefined) out.clicksend_connected = cs.connected;
    }
    if (p.channels !== undefined) out.channels = p.channels;
    if (p.reminderLeadHours !== undefined) out.reminder_lead_hours = p.reminderLeadHours;
    if (p.emailFrom !== undefined) out.email_from = p.emailFrom || null;
    if (p.templates !== undefined) out.templates = p.templates;
    return out;
  },
};

const securityMap = {
  to: r => ({
    minLength: r.min_length, requireUppercase: r.require_uppercase, requireNumber: r.require_number,
    requireSymbol: r.require_symbol, passwordExpiryDays: r.password_expiry_days,
    sessionTimeoutMin: r.session_timeout_min, maxLoginAttempts: r.max_login_attempts,
    lockoutMinutes: r.lockout_minutes, twoFactorRequired: r.two_factor_required,
    twoFactorMethod: r.two_factor_method, lockoutEnabled: r.lockout_enabled,
    notifyOnNewLogin: r.notify_on_new_login, notifyOnPermissionChange: r.notify_on_permission_change,
  }),
  from: p => ({
    min_length: p.minLength, require_uppercase: p.requireUppercase, require_number: p.requireNumber,
    require_symbol: p.requireSymbol, password_expiry_days: p.passwordExpiryDays,
    session_timeout_min: p.sessionTimeoutMin, max_login_attempts: p.maxLoginAttempts,
    lockout_minutes: p.lockoutMinutes, two_factor_required: p.twoFactorRequired,
    two_factor_method: p.twoFactorMethod, lockout_enabled: p.lockoutEnabled,
    notify_on_new_login: p.notifyOnNewLogin, notify_on_permission_change: p.notifyOnPermissionChange,
  }),
};

const systemMap = {
  to: r => ({
    dateFormat: r.date_format, timeFormat: r.time_format, timezone: r.timezone, currency: r.currency,
    language: r.language, weekStart: r.week_start, pagination: r.pagination,
    dashboardRefreshSec: r.dashboard_refresh_sec, compactTables: r.compact_tables,
  }),
  from: p => ({
    date_format: p.dateFormat, time_format: p.timeFormat, timezone: p.timezone, currency: p.currency,
    language: p.language, week_start: p.weekStart, pagination: p.pagination,
    dashboard_refresh_sec: p.dashboardRefreshSec, compact_tables: p.compactTables,
  }),
};

const MAPS = {
  clinic: clinicMap, appointments: appointmentsMap, pets: petsMap, prescriptions: prescriptionsMap,
  laboratory: laboratoryMap, billing: billingMap, notifications: notificationsMap,
  security: securityMap, system: systemMap,
};

// ── RBAC (roles + permissions) ────────────────────────────────────────────────
const PERM_COLS = ['view', 'create', 'edit', 'delete', 'approve', 'manage'];

async function getRolesAndPermissions() {
  const { data: roles, error: rErr } = await supabaseAdmin.from('roles').select('*').order('label');
  if (rErr) throw new Error('Failed to read roles: ' + rErr.message);

  const { data: perms, error: pErr } = await supabaseAdmin.from('role_permissions').select('*');
  if (pErr) throw new Error('Failed to read permissions: ' + pErr.message);

  const matrix = {};
  (perms || []).forEach(pr => {
    matrix[pr.role] = matrix[pr.role] || {};
    matrix[pr.role][pr.module] = {
      view: pr.can_view, create: pr.can_create, edit: pr.can_edit,
      delete: pr.can_delete, approve: pr.can_approve, manage: pr.can_manage,
    };
  });

  return {
    roles: (roles || []).map(r => ({ id: r.id, label: r.label, description: r.description, isSystem: r.is_system })),
    matrix,
  };
}

async function updatePermission(actorId, role, module, perm, value) {
  if (!PERM_COLS.includes(perm)) throw new Error('Invalid permission: ' + perm);
  const col = 'can_' + (perm === 'view' ? 'view' : perm);

  const { data: existing } = await supabaseAdmin
    .from('role_permissions').select('*').eq('role', role).eq('module', module).maybeSingle();

  let result;
  if (existing) {
    const { data, error } = await supabaseAdmin
      .from('role_permissions').update({ [col]: value }).eq('id', existing.id)
      .select('*').maybeSingle();
    if (error) throw new Error('Failed to update permission: ' + error.message);
    result = data;
  } else {
    const insert = { role, module, [col]: value };
    PERM_COLS.forEach(p => { const c = 'can_' + (p === 'view' ? 'view' : p); if (c !== col) insert[c] = false; });
    const { data, error } = await supabaseAdmin.from('role_permissions').insert(insert).select('*').maybeSingle();
    if (error) throw new Error('Failed to insert permission: ' + error.message);
    result = data;
  }

  await logSettingsChange(actorId, 'users', `Changed ${perm} on ${role} / ${module}`, {
    meta: { role, module, perm, value },
  });
  return result;
}

async function setRolePermissions(actorId, role, modulePerms) {
  // modulePerms: { [module]: { view, create, edit, delete, approve, manage } }
  const rows = Object.entries(modulePerms).map(([module, perms]) => ({
    role, module,
    can_view: !!perms.view, can_create: !!perms.create, can_edit: !!perms.edit,
    can_delete: !!perms.delete, can_approve: !!perms.approve, can_manage: !!perms.manage,
  }));
  const { error } = await supabaseAdmin.from('role_permissions').upsert(rows, { onConflict: 'role,module' });
  if (error) throw new Error('Failed to set permissions: ' + error.message);
  await logSettingsChange(actorId, 'users', `Updated permissions for ${role}`, { meta: { role } });
  return true;
}

// ── Branches & Rooms ──────────────────────────────────────────────────────────
async function getBranches() {
  const { data: branches, error: bErr } = await supabaseAdmin
    .from('branches').select('*').order('name');
  if (bErr) throw new Error('Failed to read branches: ' + bErr.message);
  const { data: rooms, error: rErr } = await supabaseAdmin
    .from('rooms').select('*').order('name');
  if (rErr) throw new Error('Failed to read rooms: ' + rErr.message);

  return {
    branches: (branches || []).map(b => ({
      id: b.id, name: b.name, address: b.address, phone: b.phone,
      primary: b.is_primary, hours: { open: b.open_time, close: b.close_time },
    })),
    rooms: (rooms || []).map(r => ({
      id: r.id, branch: r.branch_id, name: r.name, type: r.room_type, available: r.is_available,
    })),
    roomTypes: ['consultation', 'surgery', 'laboratory'],
  };
}

async function createBranch(actorId, payload) {
  const { name, address = null, phone = null, primary = false, hours } = payload;
  if (!name) throw new Error('Branch name is required');
  const row = {
    name, address, phone, is_primary: primary,
    open_time: hours?.open || '08:00', close_time: hours?.close || '18:00',
  };
  const { data, error } = await supabaseAdmin.from('branches').insert(row).select('*').maybeSingle();
  if (error) throw new Error('Failed to create branch: ' + error.message);
  await logSettingsChange(actorId, 'branch', `Created branch ${name}`, { after: data });
  return {
    id: data.id, name: data.name, address: data.address, phone: data.phone,
    primary: data.is_primary, hours: { open: data.open_time, close: data.close_time },
  };
}

async function updateBranch(actorId, id, payload) {
  const { data: before } = await supabaseAdmin.from('branches').select('*').eq('id', id).maybeSingle();
  const row = {};
  if (payload.name !== undefined) row.name = payload.name;
  if (payload.address !== undefined) row.address = payload.address;
  if (payload.phone !== undefined) row.phone = payload.phone;
  if (payload.primary !== undefined) row.is_primary = payload.primary;
  if (payload.hours?.open !== undefined) row.open_time = payload.hours.open;
  if (payload.hours?.close !== undefined) row.close_time = payload.hours.close;
  const { data, error } = await supabaseAdmin.from('branches').update(row).eq('id', id).select('*').maybeSingle();
  if (error) throw new Error('Failed to update branch: ' + error.message);
  await logSettingsChange(actorId, 'branch', `Updated branch ${data.name}`, { before, after: data });
  return {
    id: data.id, name: data.name, address: data.address, phone: data.phone,
    primary: data.is_primary, hours: { open: data.open_time, close: data.close_time },
  };
}

async function deleteBranch(actorId, id) {
  const { data: before } = await supabaseAdmin.from('branches').select('*').eq('id', id).maybeSingle();
  if (!before) throw new Error('Branch not found');
  const { error } = await supabaseAdmin.from('branches').delete().eq('id', id);
  if (error) throw new Error('Failed to delete branch: ' + error.message);
  await logSettingsChange(actorId, 'branch', `Deleted branch ${before.name}`, { before });
  return true;
}

async function createRoom(actorId, payload) {
  const { branchId, name, type, available = true } = payload;
  if (!branchId || !name || !type) throw new Error('branchId, name, and type are required');
  const { data, error } = await supabaseAdmin
    .from('rooms').insert({ branch_id: branchId, name, room_type: type, is_available: available })
    .select('*').maybeSingle();
  if (error) throw new Error('Failed to create room: ' + error.message);
  await logSettingsChange(actorId, 'branch', `Created room ${name}`, { after: data });
  return { id: data.id, branch: data.branch_id, name: data.name, type: data.room_type, available: data.is_available };
}

async function updateRoom(actorId, id, payload) {
  const row = {};
  if (payload.name !== undefined) row.name = payload.name;
  if (payload.type !== undefined) row.room_type = payload.type;
  if (payload.available !== undefined) row.is_available = payload.available;
  if (payload.branchId !== undefined) row.branch_id = payload.branchId;
  const { data, error } = await supabaseAdmin.from('rooms').update(row).eq('id', id).select('*').maybeSingle();
  if (error) throw new Error('Failed to update room: ' + error.message);
  await logSettingsChange(actorId, 'branch', `Updated room ${data.name}`, { after: data });
  return { id: data.id, branch: data.branch_id, name: data.name, type: data.room_type, available: data.is_available };
}

async function deleteRoom(actorId, id) {
  const { data: before } = await supabaseAdmin.from('rooms').select('*').eq('id', id).maybeSingle();
  if (!before) throw new Error('Room not found');
  const { error } = await supabaseAdmin.from('rooms').delete().eq('id', id);
  if (error) throw new Error('Failed to delete room: ' + error.message);
  await logSettingsChange(actorId, 'branch', `Deleted room ${before.name}`, { before });
  return true;
}

// ── Audit log (read-only, append-only enforced server-side) ───────────────────
async function listAuditLog({ limit = 100, offset = 0, action = null, q = null } = {}) {
  let query = supabaseAdmin
    .from('admin_audit_log')
    .select('id, actor_id, target_id, action, module, summary, created_at, before_json, after_json, meta', { count: 'exact' });

  if (action && action !== 'all') query = query.eq('action', action);
  if (q) query = query.ilike('summary', `%${q}%`);

  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  const { data, error, count } = await query;
  if (error) throw new Error('Failed to read audit log: ' + error.message);

  const ids = new Set();
  (data || []).forEach(r => { if (r.actor_id) ids.add(r.actor_id); });
  let usersById = {};
  if (ids.size) {
    const { data: u } = await supabaseAdmin.from('users').select('id, name, email, role').in('id', Array.from(ids));
    (u || []).forEach(x => { usersById[x.id] = x; });
  }
  const rows = (data || []).map(r => ({
    id: r.id,
    action: r.action,
    module: r.module,
    summary: r.summary,
    at: r.created_at,
    actor: usersById[r.actor_id] ? (usersById[r.actor_id].name || usersById[r.actor_id].email) : (r.actor_id || 'system'),
    actorId: r.actor_id,
  }));
  return { items: rows, total: count || 0, limit, offset };
}

// ── Connection tests ──────────────────────────────────────────────────────────
async function testSms(phoneNumber, message = 'This is a test message from VETLINK.') {
  if (!phoneNumber) return { ok: false, error: 'A phone number is required.' };
  const result = await smsService.sendNotification(phoneNumber, message);
  return { ok: result.delivered, provider: result.provider, disabled: result.disabled || false };
}

async function getPaymongoStatus() {
  const { data, error } = await supabaseAdmin
    .from('settings_billing').select('paymongo_connected, paymongo_mode, paymongo_public_key')
    .eq('id', DEFAULT_ID).maybeSingle();
  if (error) throw new Error('Failed to read PayMongo status: ' + error.message);
  return {
    connected: !!data?.paymongo_connected,
    mode: data?.paymongo_mode || 'test',
    publicKeyMasked: data?.paymongo_public_key ? data.paymongo_public_key.slice(0, 6) + '…' : null,
    note: 'Secret keys are never transmitted or stored on the server; rotation must be done in the PayMongo dashboard.',
  };
}

// ── Public service object ─────────────────────────────────────────────────────
const settingsService = {
  CONFIG_TABLES,

  async getSection(section) {
    const table = CONFIG_TABLES[section];
    if (!table) throw new Error('Unknown settings section: ' + section);
    const row = await getConfigRow(table);
    return MAPS[section].to(row);
  },

  async updateSection(section, patch, actorId) {
    const table = CONFIG_TABLES[section];
    if (!table) throw new Error('Unknown settings section: ' + section);
    const before = await getConfigRow(table);
    const beforeMapped = MAPS[section].to(before);
    const dbPatch = MAPS[section].from(patch);
    const updated = await updateConfigRow(table, dbPatch, actorId, section, `Updated ${section} settings`, beforeMapped);
    return MAPS[section].to(updated);
  },

  async resetSection(section, actorId) {
    // Reset to sensible defaults by deleting the row and re-inserting it with the
    // table's column DEFAULTs (every config column has a DEFAULT in the migration).
    const table = CONFIG_TABLES[section];
    if (!table) throw new Error('Unknown settings section: ' + section);
    const before = await getConfigRow(table);
    const beforeMapped = MAPS[section].to(before);

    const { error: delErr } = await supabaseAdmin.from(table).delete().eq('id', DEFAULT_ID);
    if (delErr) throw new Error('Failed to reset ' + section + ': ' + delErr.message);

    const { data, error } = await supabaseAdmin
      .from(table).insert({ id: DEFAULT_ID }).select('*').maybeSingle();
    if (error) throw new Error('Failed to re-seed ' + section + ': ' + error.message);

    await logSettingsChange(actorId, section, `Reset ${section} settings to defaults`, { before: beforeMapped });
    return MAPS[section].to(data);
  },

  getRolesAndPermissions,
  updatePermission,
  setRolePermissions,

  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  createRoom,
  updateRoom,
  deleteRoom,

  listAuditLog,
  testSms,
  getPaymongoStatus,
};

module.exports = settingsService;
