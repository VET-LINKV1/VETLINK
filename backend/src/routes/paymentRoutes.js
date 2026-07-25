const { Router } = require('express');
const express = require('express');
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');

const router = Router();

// Public catalogue (no auth) — clients need this on the booking form
router.get('/services', paymentController.listServices);

// Webhook — receives raw body so signatures can be verified in Phase 4
router.post('/webhook',
  express.raw({ type: '*/*', limit: '1mb' }),
  (req, res, next) => {
    // Save the raw bytes for the controller, then JSON-parse for convenience
    req.rawBody = req.body;
    try { req.body = JSON.parse(req.body.toString('utf8')); } catch { req.body = {}; }
    next();
  },
  paymentController.webhook
);

// Authenticated endpoints
router.use(authMiddleware);
router.post('/create-checkout-session',     paymentController.createCheckoutSession);
router.get('/status/:appointmentId',        paymentController.getStatus);

module.exports = router;
