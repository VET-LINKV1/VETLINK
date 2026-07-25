/**
 * emrFileService.js
 * Secure upload + retrieval of EMR files (X-rays, lab results,
 * prescriptions, photos, documents) backed by Supabase Storage.
 *
 *   bucket: 'emr-files'  (private)
 *   key:    <pet_id>/<timestamp>_<sanitized_filename>
 *
 * Files are never served publicly — we return short-lived
 * signed URLs from getSignedUrl().
 */
const crypto = require('crypto');
const path = require('path');
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

const BUCKET = 'emr-files';
const SIGN_TTL_SEC = 60 * 10; // 10 minutes

const STAFF_ROLES = ['admin', 'veterinarian', 'staff'];
const WRITE_ROLES = ['admin', 'veterinarian', 'staff']; // staff can upload (e.g. scanning lab paperwork)

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
  'application/dicom', // X-ray DICOM
]);

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

function sanitize(filename) {
  const base = path.basename(filename || 'file');
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

async function assertPetVisible(petId, userId, role) {
  if (!STAFF_ROLES.includes(role) && role !== 'client') throw new Error('Access denied.');
  const { data: pet } = await supabaseAdmin
    .from('pets').select('id, owner_id').eq('id', petId).single();
  if (!pet) throw new Error('Pet not found.');
  if (role === 'client' && pet.owner_id !== userId) throw new Error('Access denied.');
  return pet;
}

const emrFileService = {

  /**
   * Upload one file. Caller passes a multer in-memory file object
   * (file.buffer, file.originalname, file.mimetype, file.size) plus
   * metadata (petId, kind, title, description, medicalRecordId).
   */
  async upload(actorId, role, file, meta) {
    if (!WRITE_ROLES.includes(role)) throw new Error('Access denied: upload requires staff role.');
    if (!file || !file.buffer)        throw new Error('No file provided.');
    if (!meta?.petId)                 throw new Error('petId is required.');
    if (!meta?.title)                 throw new Error('title is required.');

    if (file.size > MAX_BYTES) throw new Error('File too large (max 25 MB).');
    if (!ALLOWED_MIME.has(file.mimetype)) throw new Error(`Unsupported file type: ${file.mimetype}`);

    await assertPetVisible(meta.petId, actorId, role);

    const safeName  = sanitize(file.originalname);
    const stamp     = Date.now();
    const rand      = crypto.randomBytes(4).toString('hex');
    const storageKey = `${meta.petId}/${stamp}_${rand}_${safeName}`;

    const { error: upErr } = await supabaseAdmin
      .storage.from(BUCKET)
      .upload(storageKey, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });
    if (upErr) {
      logger.error('emr', 'storage.upload_failed', { msg: upErr.message });
      throw new Error('Upload failed: ' + upErr.message);
    }

    const { data, error } = await supabaseAdmin
      .from('emr_files').insert({
        pet_id:            meta.petId,
        medical_record_id: meta.medicalRecordId || null,
        uploaded_by:       actorId,
        kind:              meta.kind || 'document',
        title:             meta.title,
        description:       meta.description || null,
        storage_path:      storageKey,
        mime_type:         file.mimetype,
        size_bytes:        file.size,
      }).select().single();

    if (error) {
      // Rollback the storage object so we don't orphan bytes
      try { await supabaseAdmin.storage.from(BUCKET).remove([storageKey]); } catch (_) {}
      throw new Error(error.message);
    }

    logger.info('emr', 'file.uploaded', { id: data.id, pet: meta.petId, kind: data.kind });
    return data;
  },

  async listByPet(petId, userId, role, { kind } = {}) {
    await assertPetVisible(petId, userId, role);
    let q = supabaseAdmin.from('emr_files').select('*')
      .eq('pet_id', petId).eq('is_archived', false)
      .order('created_at', { ascending: false });
    if (kind) q = q.eq('kind', kind);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
  },

  /** Short-lived signed URL for a single file (download or preview). */
  async getSignedUrl(fileId, userId, role) {
    const { data: file } = await supabaseAdmin
      .from('emr_files').select('*').eq('id', fileId).single();
    if (!file) throw new Error('File not found.');

    await assertPetVisible(file.pet_id, userId, role);

    const { data, error } = await supabaseAdmin
      .storage.from(BUCKET)
      .createSignedUrl(file.storage_path, SIGN_TTL_SEC);
    if (error) throw new Error(error.message);
    return { url: data.signedUrl, expiresIn: SIGN_TTL_SEC, file };
  },

  async update(fileId, role, payload) {
    if (!WRITE_ROLES.includes(role)) throw new Error('Access denied.');
    const allowed = ['title', 'description', 'kind', 'is_archived'];
    const update = {};
    for (const k of allowed) if (k in payload) update[k] = payload[k];
    if ('kind' in payload && payload.kind) update.kind = payload.kind;
    if (Object.keys(update).length === 0) throw new Error('Nothing to update.');

    const { data, error } = await supabaseAdmin
      .from('emr_files').update(update).eq('id', fileId).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Soft delete by default (is_archived = true). Pass hard=true to remove bytes too. */
  async remove(fileId, role, { hard = false } = {}) {
    if (!WRITE_ROLES.includes(role)) throw new Error('Access denied.');
    const { data: file } = await supabaseAdmin
      .from('emr_files').select('*').eq('id', fileId).single();
    if (!file) throw new Error('File not found.');

    if (hard) {
      try { await supabaseAdmin.storage.from(BUCKET).remove([file.storage_path]); } catch (_) {}
      const { error } = await supabaseAdmin.from('emr_files').delete().eq('id', fileId);
      if (error) throw new Error(error.message);
      return { deleted: true, hard: true };
    }

    const { error } = await supabaseAdmin
      .from('emr_files').update({ is_archived: true }).eq('id', fileId);
    if (error) throw new Error(error.message);
    return { deleted: true, hard: false };
  },

};

module.exports = emrFileService;
