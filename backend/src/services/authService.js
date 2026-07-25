const { supabase, supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Profile columns returned to the frontend.
 * Single source of truth so login / getMe / register all agree.
 */
const PROFILE_COLUMNS = 'id, email, role, name, phone_number, address, avatar_url, is_verified, is_active, created_at';

const authService = {
  /**
   * Sign in user via Supabase Auth, then fetch their role profile.
   * Rejects deactivated accounts.
   */
  async login(email, password) {
    logger.auth('login.attempt', { email });

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      logger.auth('login.failed', { email, reason: authError.message });
      throw new Error(authError.message || 'Invalid credentials');
    }

    const { session, user: authUser } = authData;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select(PROFILE_COLUMNS)
      .eq('id', authUser.id)
      .single();

    if (profileError || !profile) {
      logger.auth('login.no_profile', { userId: authUser.id, email });
      throw new Error('User profile not found. Please contact an administrator.');
    }

    if (profile.is_active === false) {
      logger.auth('login.deactivated', { userId: profile.id, email });
      throw new Error('This account has been deactivated. Please contact an administrator.');
    }

    logger.auth('login.success', { userId: profile.id, role: profile.role, email });

    return {
      session: {
        accessToken:  session.access_token,
        refreshToken: session.refresh_token,
        expiresAt:    session.expires_at,
      },
      user: profile,
    };
  },

  async getProfile(userId) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .single();

    if (error || !data) throw new Error('User not found');
    return data;
  },

  /**
   * Sign out — uses the admin client (anon client cannot call admin.signOut).
   */
  async logout(accessToken) {
    try {
      const { error } = await supabaseAdmin.auth.admin.signOut(accessToken);
      if (error) logger.warn('auth', 'Supabase signOut warning', { msg: error.message });
    } catch (err) {
      logger.warn('auth', 'Supabase signOut threw', { msg: err.message });
    }
    return true;
  },
};

module.exports = authService;
module.exports.PROFILE_COLUMNS = PROFILE_COLUMNS;
