const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

const STORAGE_BUCKET = 'avatars';

const profileService = {
  async getProfile(userId) {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, role, phone_number, address, avatar_url, is_verified, is_active, created_at')
      .eq('id', userId)
      .single();
    if (error || !user) throw new Error('User not found');

    let staffProfile = null;
    if (user.role === 'veterinarian' || user.role === 'staff') {
      const { data } = await supabaseAdmin
        .from('staff_profiles')
        .select('license_number, specialization, position')
        .eq('user_id', userId)
        .maybeSingle();
      staffProfile = data || null;
    }

    return { ...user, staff_profile: staffProfile };
  },

  async updateProfile(userId, payload) {
    const { name, phoneNumber, address, licenseNumber, specialization, position } = payload;

    const updateData = {};
    if (name !== undefined && name !== '')              updateData.name         = name;
    if (phoneNumber !== undefined)                       updateData.phone_number = phoneNumber || null;
    if (address !== undefined)                           updateData.address      = address || null;

    if (Object.keys(updateData).length > 0) {
      const { error } = await supabaseAdmin.from('users').update(updateData).eq('id', userId);
      if (error) throw new Error('Failed to update profile: ' + error.message);
    }

    // Update staff_profiles for vet / staff
    const { data: user } = await supabaseAdmin.from('users').select('role').eq('id', userId).single();
    if (user?.role === 'veterinarian' || user?.role === 'staff') {
      const profileUpdate = {};
      if (licenseNumber  !== undefined) profileUpdate.license_number = licenseNumber  || null;
      if (specialization !== undefined) profileUpdate.specialization = specialization || null;
      if (position       !== undefined) profileUpdate.position       = position       || null;

      if (Object.keys(profileUpdate).length > 0) {
        const { data: existing } = await supabaseAdmin
          .from('staff_profiles').select('id').eq('user_id', userId).maybeSingle();
        if (existing) {
          await supabaseAdmin.from('staff_profiles').update(profileUpdate).eq('user_id', userId);
        } else {
          await supabaseAdmin.from('staff_profiles').insert({ user_id: userId, ...profileUpdate });
        }
      }
    }

    logger.info('profile.update', 'updated', { userId, fields: Object.keys(updateData) });
    return profileService.getProfile(userId);
  },

  /**
   * Upload an avatar image to Supabase Storage and persist the public URL.
   * - File is stored at `<userId>/avatar.<ext>` inside the `avatars` bucket
   *   (no extra `avatars/` nesting — bucket is already the namespace).
   * - URL gets a `?t=<timestamp>` cache-buster so the new image renders
   *   immediately without a hard refresh.
   * - The `avatars` bucket must exist in Supabase Storage (Public).
   */
  async uploadAvatar(userId, file) {
    const ext      = (file.originalname.split('.').pop() || 'jpg').toLowerCase();
    const fileName = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
        cacheControl: '3600',
      });

    if (uploadError) {
      // Common case: bucket doesn't exist yet
      if (/bucket.*not.*found/i.test(uploadError.message) || uploadError.message.includes('Bucket not found')) {
        throw new Error(
          `Supabase Storage bucket "${STORAGE_BUCKET}" does not exist. ` +
          'Please create a public bucket named "avatars" in your Supabase project Storage settings.'
        );
      }
      throw new Error('Upload failed: ' + uploadError.message);
    }

    const { data: urlData } = supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
    // Cache-bust so the browser shows the new avatar immediately on subsequent loads
    const avatarUrl = urlData.publicUrl + '?t=' + Date.now();

    const { error: updErr } = await supabaseAdmin
      .from('users')
      .update({ avatar_url: avatarUrl })
      .eq('id', userId);
    if (updErr) throw new Error('Failed to save avatar URL: ' + updErr.message);

    logger.info('profile.avatar', 'uploaded', { userId, path: fileName });
    return { avatarUrl };
  },
};

module.exports = profileService;
