/**
 * logger.js
 * Lightweight structured logger — single source for backend log lines.
 * Required by the brief: log auth session, role detection, API responses.
 *
 * In dev: pretty colored output.
 * In prod: JSON for log aggregators.
 */

const isDev = process.env.NODE_ENV !== 'production';

const colors = {
  reset:  '\x1b[0m',
  gray:   '\x1b[90m',
  cyan:   '\x1b[36m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  magenta:'\x1b[35m',
};

function fmt(level, scope, message, meta) {
  const ts = new Date().toISOString();
  if (!isDev) {
    return JSON.stringify({ ts, level, scope, message, ...meta });
  }
  const c = {
    info:  colors.cyan,
    warn:  colors.yellow,
    error: colors.red,
    debug: colors.gray,
    auth:  colors.magenta,
    api:   colors.green,
  }[level] || colors.reset;
  const metaStr = meta && Object.keys(meta).length
    ? ' ' + colors.gray + JSON.stringify(meta) + colors.reset
    : '';
  return `${colors.gray}${ts}${colors.reset} ${c}[${level.toUpperCase()}]${colors.reset} ${colors.cyan}${scope}${colors.reset} ${message}${metaStr}`;
}

const logger = {
  info:  (scope, msg, meta = {}) => console.log(fmt('info',  scope, msg, meta)),
  warn:  (scope, msg, meta = {}) => console.warn(fmt('warn', scope, msg, meta)),
  error: (scope, msg, meta = {}) => console.error(fmt('error', scope, msg, meta)),
  debug: (scope, msg, meta = {}) => { if (isDev) console.log(fmt('debug', scope, msg, meta)); },

  /** Auth-specific tagged log — required by brief */
  auth:  (msg, meta = {}) => console.log(fmt('auth', 'AUTH', msg, meta)),

  /** API response log — required by brief */
  api:   (req, statusCode, extra = {}) => {
    const meta = {
      method: req.method,
      path:   req.originalUrl || req.url,
      status: statusCode,
      userId: req.user?.id || null,
      role:   req.user?.role || null,
      ...extra,
    };
    console.log(fmt('api', 'API', `${req.method} ${meta.path} → ${statusCode}`, meta));
  },
};

module.exports = logger;
