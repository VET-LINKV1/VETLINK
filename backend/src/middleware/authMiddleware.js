const jwt = require('jsonwebtoken');
const { supabase, supabaseAdmin } = require('../config/supabase');
const config = require('../config/env');
const logger = require('../utils/logger');
const { PROFILE_COLUMNS } = require('../services/authService');

/**
 * Verifies a Supabase access token and attaches the local user profile
 * to req.user. Rejects deactivated accounts.
 *
 * Verification strategy (defense in depth):
 *   1. Ask Supabase itself: `supabase.auth.getUser(token)`. This works
 *      regardless of HS256 vs RS256/ES256 signing — Supabase rotated to
 *      asymmetric JWT signing for new projects, breaking the old
 *      `jwt.verify(token, JWT_SECRET)` path.
 *   2. If that returns no user, fall back to the legacy local verify
 *      (still useful when SUPABASE_JWT_SECRET is set and works).
 */
async function resolveUserId(token) {
  // 1. Ask Supabase first — works for any signing algorithm
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user?.id) return { userId: data.user.id, source: 'supabase' };
    if (error) logger.auth('jwt.supabase_getUser_error', { reason: error.message });
  } catch (e) {
    logger.auth('jwt.supabase_getUser_threw', { reason: e.message });
  }

  // 2. Legacy local verify (HS256). Only attempted if a secret is set.
  if (config.supabase.jwtSecret) {
    try {
      const decoded = jwt.verify(token, config.supabase.jwtSecret);
      if (decoded?.sub) return { userId: decoded.sub, source: 'jwt-local' };
    } catch (e) {
      logger.auth('jwt.local_verify_failed', { reason: e.message });
    }
  }
  return null;
}

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];

    const resolved = await resolveUserId(token);
    if (!resolved) {
      logger.auth('jwt.invalid', { path: req.path });
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired token' });
    }

    const { data: userProfile, error } = await supabaseAdmin
      .from('users')
      .select(PROFILE_COLUMNS)
      .eq('id', resolved.userId)
      .single();

    if (error || !userProfile) {
      logger.auth('jwt.no_profile', { sub: resolved.userId, path: req.path });
      return res.status(401).json({ success: false, error: 'Unauthorized: User not found' });
    }

    if (userProfile.is_active === false) {
      logger.auth('jwt.deactivated', { userId: userProfile.id, path: req.path });
      return res.status(403).json({ success: false, error: 'Account has been deactivated.' });
    }

    logger.auth('role.detected', {
      userId: userProfile.id,
      role:   userProfile.role,
      path:   req.path,
      via:    resolved.source,
    });

    req.user  = userProfile;
    req.token = token;
    next();
  } catch (err) {
    logger.error('authMiddleware', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error during authentication' });
  }
};

module.exports = authMiddleware;
