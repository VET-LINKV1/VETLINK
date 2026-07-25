const paymentService = require('../services/paymentService');
const { listServices } = require('../config/pricing');
const { verifyPayMongoSignature } = require('../utils/paymongoSignature');
const logger = require('../utils/logger');

const paymentController = {
  /** GET /api/payments/services */
  async listServices(req, res) {
    res.json({ success: true, data: listServices() });
  },

  /** POST /api/payments/create-checkout-session */
  async createCheckoutSession(req, res) {
    try {
      const { appointmentId } = req.body;
      if (!appointmentId) return res.status(400).json({ success: false, error: 'appointmentId is required' });
      const result = await paymentService.createCheckoutSession(appointmentId, req.user.id);
      res.json({ success: true, data: result });
    } catch (err) {
      const isAuth = /Access denied|not found/i.test(err.message);
      res.status(isAuth ? 403 : 400).json({ success: false, error: err.message });
    }
  },

  /** GET /api/payments/status/:appointmentId?reconcile=true */
  async getStatus(req, res) {
    try {
      const { appointmentId } = req.params;
      const forceReconcile = req.query.reconcile === 'true' || req.query.reconcile === '1';
      const data = await paymentService.getStatus(appointmentId, req.user.id, { forceReconcile });
      res.json({ success: true, data });
    } catch (err) {
      const code = /Access denied/i.test(err.message) ? 403 : 404;
      res.status(code).json({ success: false, error: err.message });
    }
  },

  /**
   * POST /api/payments/webhook
   *
   * Verifies HMAC signature, then dispatches by event type:
   *   - checkout_session.payment.paid  → markPaid
   *   - payment.paid                   → markPaid
   *   - payment.failed                 → markFailed
   *
   * Always returns 200 quickly (PayMongo retries non-2xx). If the signature
   * fails, return 200 with `verified: false` in the body so PayMongo treats
   * it as delivered but our logs still capture the rejection.
   * Strict 401 in prod is also valid — we choose tolerant + log here.
   */
  async webhook(req, res) {
    const sigHeader = req.headers['paymongo-signature'];
    const secret    = process.env.PAYMONGO_WEBHOOK_SECRET || '';
    const isLive    = (process.env.PAYMONGO_SECRET_KEY || '').startsWith('sk_live_');

    // Verify (skipped only if no secret is set — useful for very early dev,
    // but you should set the secret as soon as you add a webhook in dashboard)
    if (secret) {
      const v = verifyPayMongoSignature(req.rawBody, sigHeader, secret, { live: isLive });
      if (!v.valid) {
        logger.warn('payment.webhook', 'signature verification FAILED', {
          reason: v.reason, hasHeader: !!sigHeader, bodyBytes: req.rawBody?.length || 0,
        });
        return res.status(401).json({ success: false, error: 'Invalid webhook signature: ' + v.reason });
      }
      logger.info('payment.webhook', 'signature verified', { ts: v.timestamp });
    } else {
      logger.warn('payment.webhook', 'no PAYMONGO_WEBHOOK_SECRET set — skipping signature verify (dev only)');
    }

    // Parse event
    const evt = req.body?.data?.attributes;
    const evtType = evt?.type;
    const data    = evt?.data;
    if (!evtType) {
      logger.warn('payment.webhook', 'malformed payload (no event type)');
      return res.status(200).json({ received: true, ignored: 'no_event_type' });
    }

    logger.info('payment.webhook', 'event received', { evtType, dataId: data?.id });

    try {
      switch (evtType) {
        case 'checkout_session.payment.paid': {
          // data.id is the checkout session id (our transaction_id)
          const sessionId = data?.id;
          if (!sessionId) throw new Error('missing checkout session id');
          // The actual paid payment object is nested
          const paymentObj = data?.attributes?.payments?.find(p => p?.attributes?.status === 'paid');
          const method    = paymentObj?.attributes?.source?.type
                         || paymentObj?.attributes?.payment_method_used
                         || 'unknown';
          await paymentService.markPaid(sessionId, {
            reason: 'webhook',
            payment_method: method,
            raw: { event: req.body, payment: paymentObj },
          });
          break;
        }

        case 'payment.paid': {
          // Standalone payment event — find by checkout session reference if present
          const referencedSessionId =
            data?.attributes?.checkout_session?.id ||
            data?.attributes?.metadata?.checkout_session_id;
          if (!referencedSessionId) {
            logger.info('payment.webhook', 'payment.paid without checkout_session reference — ignoring');
            break;
          }
          const method = data?.attributes?.source?.type
                       || data?.attributes?.payment_method_used
                       || 'unknown';
          await paymentService.markPaid(referencedSessionId, {
            reason: 'webhook.payment.paid',
            payment_method: method,
            raw: { event: req.body },
          });
          break;
        }

        case 'payment.failed': {
          const referencedSessionId =
            data?.attributes?.checkout_session?.id ||
            data?.attributes?.metadata?.checkout_session_id;
          if (referencedSessionId) {
            await paymentService.markFailed(referencedSessionId, {
              reason: 'webhook.payment.failed',
              raw: { event: req.body },
            });
          }
          break;
        }

        default:
          logger.info('payment.webhook', 'event type not handled', { evtType });
      }

      return res.status(200).json({ received: true });
    } catch (err) {
      logger.error('payment.webhook', 'handler threw', { msg: err.message, evtType });
      // Still 200 so PayMongo doesn't retry forever — we have the logs
      return res.status(200).json({ received: true, error: err.message });
    }
  },
};

module.exports = paymentController;
