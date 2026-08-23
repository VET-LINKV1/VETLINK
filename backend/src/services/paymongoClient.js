/**
 * paymongoClient.js
 * Thin wrapper around the PayMongo REST API.
 *
 * Auth: HTTP Basic with secret key as username, no password.
 * Docs: https://developers.paymongo.com
 *
 * All amounts are in centavos (e.g. ₱500 = 50000).
 */
const logger = require('../utils/logger');

// Configurable base URL (spec: PAYMONGO_API_URL). Falls back to the
// official production endpoint when unset.
const API_BASE = (process.env.PAYMONGO_API_URL || 'https://api.paymongo.com/v1').replace(/\/$/, '');

function authHeader() {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) throw new Error('PAYMONGO_SECRET_KEY is not set in .env');
  return 'Basic ' + Buffer.from(key + ':').toString('base64');
}

async function request(method, path, body) {
  const res = await fetch(API_BASE + path, {
    method,
    headers: {
      'Authorization': authHeader(),
      'Content-Type':  'application/json',
      'Accept':        'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  if (!res.ok) {
    const errMsg = json?.errors?.[0]?.detail || json?.errors?.[0]?.code || `HTTP ${res.status}`;
    logger.error('paymongo', `${method} ${path} failed`, { status: res.status, errMsg });
    throw new Error('PayMongo: ' + errMsg);
  }
  return json;
}

const paymongoClient = {
  /**
   * Create a hosted Checkout Session.
   * @returns the data object from PayMongo (includes .id and .attributes.checkout_url)
   * Docs: POST /checkout_sessions
   */
  async createCheckoutSession({ amount, description, lineItems, successUrl, cancelUrl, referenceNumber, metadata }) {
    const body = {
      data: {
        attributes: {
          send_email_receipt: false,
          show_description:   true,
          show_line_items:    true,
          line_items:         lineItems,
          payment_method_types: ['card', 'gcash', 'paymaya', 'grab_pay'],
          success_url:        successUrl,
          cancel_url:         cancelUrl,
          description,
          reference_number:   referenceNumber,
          metadata:           metadata || {},
        },
      },
    };
    const r = await request('POST', '/checkout_sessions', body);
    return r.data;
  },

  /**
   * Retrieve a checkout session (used by the polling fallback to confirm payment).
   */
  async retrieveCheckoutSession(checkoutSessionId) {
    const r = await request('GET', '/checkout_sessions/' + checkoutSessionId);
    return r.data;
  },
};

module.exports = paymongoClient;
