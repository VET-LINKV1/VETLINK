/**
 * paymongoSignature.js
 *
 * PayMongo webhook signature verification.
 * Header format: `Paymongo-Signature: t=<timestamp>,te=<test_sig>,li=<live_sig>`
 *
 *   - Compute HMAC-SHA256 over `${t}.${rawBody}` using the webhook secret
 *   - Compare digest with `te` (test mode) or `li` (live mode)
 *   - Reject timestamps older than ANTI_REPLAY_SECONDS (default 5 min)
 *
 * Returns { valid, reason } — never throws.
 */
const crypto = require('crypto');

const ANTI_REPLAY_SECONDS = 300;

function parseSignatureHeader(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') return null;
  const parts = headerValue.split(',').map(p => p.trim());
  const out = {};
  for (const p of parts) {
    const [k, v] = p.split('=');
    if (k && v) out[k.trim()] = v.trim();
  }
  if (!out.t) return null;
  return out;
}

function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Verify a PayMongo webhook signature.
 * @param {string|Buffer} rawBody — original request body bytes (NOT JSON-parsed)
 * @param {string} signatureHeader — value of `Paymongo-Signature` header
 * @param {string} secret — webhook secret from PayMongo dashboard
 * @param {object} [opts]
 * @param {boolean} [opts.live=false]   — match against `li` (live) instead of `te` (test)
 * @param {number} [opts.maxAgeSec=300] — reject older signatures (anti-replay)
 * @param {Date}   [opts.now=new Date()]
 */
function verifyPayMongoSignature(rawBody, signatureHeader, secret, opts = {}) {
  if (!secret) return { valid: false, reason: 'no_secret_configured' };
  if (!rawBody) return { valid: false, reason: 'no_body' };

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return { valid: false, reason: 'malformed_header' };

  const live      = opts.live === true;
  const expected  = live ? parsed.li : parsed.te;
  if (!expected)  return { valid: false, reason: live ? 'no_li_in_header' : 'no_te_in_header' };

  // Anti-replay: reject signatures older than maxAgeSec
  const maxAge = opts.maxAgeSec ?? ANTI_REPLAY_SECONDS;
  const now    = opts.now ? opts.now.getTime() : Date.now();
  const tSec   = parseInt(parsed.t, 10);
  if (!Number.isFinite(tSec)) return { valid: false, reason: 'bad_timestamp' };
  if (now / 1000 - tSec > maxAge) return { valid: false, reason: 'stale_timestamp' };

  // Compute HMAC-SHA256 over `${t}.${body}`
  const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const payload = `${parsed.t}.${bodyStr}`;
  const computed = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  if (!timingSafeEqualHex(computed, expected)) {
    return { valid: false, reason: 'signature_mismatch' };
  }
  return { valid: true, timestamp: tSec };
}

module.exports = { verifyPayMongoSignature, parseSignatureHeader, timingSafeEqualHex, ANTI_REPLAY_SECONDS };
