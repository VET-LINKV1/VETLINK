require('dotenv').config();
const config = require('./config/env');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');

// ── Routes ────────────────────────────────────────────────────
const authRoutes        = require('./routes/authRoutes');
const staffAuthRoutes   = require('./routes/staffAuthRoutes');
const clientRoutes      = require('./routes/clientRoutes');
const petRoutes         = require('./routes/petRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');

let medicalRecordRoutes, notificationRoutes, profileRoutes, vetScheduleRoutes;
try { medicalRecordRoutes = require('./routes/medicalRecordRoutes'); } catch (_) {}
try { notificationRoutes  = require('./routes/notificationRoutes');  } catch (_) {}
try { profileRoutes       = require('./routes/profileRoutes');       } catch (_) {}
try { vetScheduleRoutes   = require('./routes/vetScheduleRoutes');   } catch (_) {}
let adminRoutes; try { adminRoutes = require('./routes/adminRoutes'); } catch (_) {}
let paymentRoutes; try { paymentRoutes = require('./routes/paymentRoutes'); } catch (_) {}
let analyticsRoutes; try { analyticsRoutes = require('./routes/analyticsRoutes'); } catch (_) {}
let diagnosticRoutes; try { diagnosticRoutes = require('./routes/diagnosticRoutes'); } catch (_) {}
let predictiveRoutes; try { predictiveRoutes = require('./routes/predictiveRoutes'); } catch (_) {}
let prescriptiveRoutes; try { prescriptiveRoutes = require('./routes/prescriptiveRoutes'); } catch (_) {}
let emrRoutes; try { emrRoutes = require('./routes/emrRoutes'); } catch (_) {}
let passportRoutes; try { passportRoutes = require('./routes/passportRoutes'); } catch (_) {}
let bookingRoutes; try { bookingRoutes = require('./routes/bookingRoutes'); } catch (_) {}
let postCareRoutes; try { postCareRoutes = require('./routes/postCareRoutes'); } catch (_) {}
let commsRoutes; try { commsRoutes = require('./routes/commsRoutes'); } catch (_) {}
let userMgmtRoutes; try { userMgmtRoutes = require('./routes/userManagementRoutes'); } catch (_) {}
let reminderRoutes; try { reminderRoutes = require('./routes/reminderRoutes'); } catch (_) {}
let noShowRoutes;   try { noShowRoutes   = require('./routes/noShowRoutes');   } catch (_) {}

const app = express();

app.use(helmet());
// CORS — in dev, allow the configured frontend URL plus any LAN origin
// (192.168.*, 10.*, 172.16-31.*) so phones on the same Wi-Fi can use the app.
// In production, only the configured FRONTEND_URL is accepted.
const lanOriginRe = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;
app.use(cors({
  origin: (origin, cb) => {
    // Allow tools like curl/Postman (no Origin header)
    if (!origin) return cb(null, true);
    if (origin === config.cors.frontendUrl) return cb(null, true);
    if (config.isDev && lanOriginRe.test(origin)) return cb(null, true);
    return cb(new Error('CORS: origin not allowed — ' + origin));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

// ── Rate limiting ───────────────────────────────────────────────
// Strategy:
//   • In development: limiter is effectively off for localhost so it
//     never bites during normal usage of the app.
//   • In production: a generous global ceiling so realtime + signed-URL
//     traffic doesn't trip 429s, plus stricter limits ONLY on auth
//     endpoints (login + register) which are the actual abuse surface.
//
// Tunable via env: RATE_LIMIT_MAX (global), AUTH_RATE_LIMIT_MAX (auth).
const RATE_WINDOW_MS    = 15 * 60 * 1000;
const RATE_LIMIT_MAX    = Number(process.env.RATE_LIMIT_MAX     || 2000);
const AUTH_RATE_MAX     = Number(process.env.AUTH_RATE_LIMIT_MAX|| 30);

const skipLocal = (req) => {
  if (!config.isDev) return false;
  const ip = req.ip || '';
  return ip === '::1' || ip === '127.0.0.1' || ip.endsWith('127.0.0.1');
};

app.use(rateLimit({
  windowMs: RATE_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipLocal,
  // Don't count safe reads against the global ceiling — realtime fan-out
  // and signed-URL fetches dominate traffic but are not abuse vectors.
  skipSuccessfulRequests: false,
  keyGenerator: (req) => req.ip,
  message: { success: false, error: 'Too many requests. Please slow down for a few minutes.' },
}));

// Tight bucket just for auth endpoints (login + token refresh + register).
app.use(['/api/auth/login', '/api/auth/register', '/api/staff/auth/login'], rateLimit({
  windowMs: RATE_WINDOW_MS,
  max: AUTH_RATE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipLocal,
  message: { success: false, error: 'Too many login attempts. Please wait 15 minutes.' },
}));

app.use((req, res, next) => {
  if (req.originalUrl === '/api/payments/webhook') return next();
  return express.json({ limit: '10kb' })(req, res, next);
});
app.use(express.urlencoded({ extended: true }));

if (config.isDev) app.use(morgan('dev'));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api')) {
      logger.api(req, res.statusCode, { ms: Date.now() - start });
    }
  });
  next();
});

app.get('/health', (_, res) => res.json({
  success: true,
  service: 'VETLINK API',
  version: '1.0.0',
  timestamp: new Date().toISOString(),
}));

app.use('/api/auth',                authRoutes);
app.use('/api/staff',               staffAuthRoutes);
app.use('/api/client',              clientRoutes);
app.use('/api/pets',                petRoutes);
app.use('/api/client/pets',         petRoutes);
app.use('/api/appointments',        appointmentRoutes);
app.use('/api/client/appointments', appointmentRoutes);

if (medicalRecordRoutes) app.use('/api/medical-records', medicalRecordRoutes);
if (notificationRoutes)  app.use('/api/notifications',   notificationRoutes);
if (profileRoutes)       app.use('/api/profile',         profileRoutes);
if (vetScheduleRoutes)   app.use('/api/vet-schedule',    vetScheduleRoutes);
if (userMgmtRoutes)      app.use('/api/admin/users',     userMgmtRoutes);
if (adminRoutes)         app.use('/api/admin',           adminRoutes);
if (paymentRoutes)       app.use('/api/payments',        paymentRoutes);
if (analyticsRoutes)     app.use('/api/analytics',       analyticsRoutes);
if (diagnosticRoutes)    app.use('/api/diagnostic',      diagnosticRoutes);
if (predictiveRoutes)    app.use('/api/predictive',      predictiveRoutes);
if (prescriptiveRoutes)  app.use('/api/prescriptive',    prescriptiveRoutes);
if (emrRoutes)           app.use('/api/emr',             emrRoutes);
if (passportRoutes)      app.use('/api/passport',        passportRoutes);
if (bookingRoutes)       app.use('/api/booking',         bookingRoutes);
if (postCareRoutes)      app.use('/api/postcare',        postCareRoutes);
if (commsRoutes)         app.use('/api/comms',           commsRoutes);
if (reminderRoutes)      app.use('/api/reminders',       reminderRoutes);
if (noShowRoutes)        app.use('/api/no-show',          noShowRoutes);

app.use((req, res) => {
  logger.warn('404', req.method + ' ' + req.path + ' not found');
  res.status(404).json({ success: false, error: req.method + ' ' + req.path + ' not found' });
});

app.use((err, req, res, next) => {
  logger.error('GlobalError', err.message, { stack: config.isDev ? err.stack : undefined });
  res.status(err.status || 500).json({
    success: false,
    error: config.isDev ? err.message : 'Unexpected error',
  });
});

app.listen(config.port, () => {
  logger.info('boot', 'VETLINK API running on port ' + config.port, { env: config.nodeEnv });
  logger.info('boot', 'Routes registered', {
    routes: [
      '/api/auth',
      '/api/staff',
      '/api/client',
      '/api/pets',
      '/api/appointments',
      medicalRecordRoutes && '/api/medical-records',
      notificationRoutes  && '/api/notifications',
      profileRoutes       && '/api/profile',
      vetScheduleRoutes   && '/api/vet-schedule',
      adminRoutes         && '/api/admin',
      paymentRoutes       && '/api/payments',
      analyticsRoutes     && '/api/analytics',
      diagnosticRoutes    && '/api/diagnostic',
      predictiveRoutes    && '/api/predictive',
      prescriptiveRoutes  && '/api/prescriptive',
      emrRoutes           && '/api/emr',
      passportRoutes      && '/api/passport',
      bookingRoutes       && '/api/booking',
      postCareRoutes      && '/api/postcare',
      commsRoutes         && '/api/comms',
      reminderRoutes      && '/api/reminders',
      noShowRoutes        && '/api/no-show',
      userMgmtRoutes      && '/api/admin/users',
    ].filter(Boolean),
  });
});

module.exports = app;
