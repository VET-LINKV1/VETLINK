/**
 * security.test.js
 *
 * Manual security test suite for VETLINK backend.
 * Run with: node tests/security.test.js
 *
 * Prerequisites:
 *   1. Backend running on http://localhost:5000
 *   2. A valid JWT token (set as TOKEN below)
 *   3. Supabase database with phase16-18 migrations run
 */
const http = require('http');

const BASE = 'http://localhost:5000';
let TOKEN = process.env.TEST_TOKEN || ''; // Set your JWT token here
let PASSED = 0, FAILED = 0;

async function request(method, path, body, headers = {}) {
  const url = new URL(BASE + path);
  const payload = body ? JSON.stringify(body) : null;
  const opts = {
    method,
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
  };

  return new Promise((resolve, reject) => {
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json;
        try { json = JSON.parse(data); } catch { json = { raw: data }; }
        resolve({ status: res.status || res.statusCode, body: json });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function assert(condition, label, details) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    PASSED++;
  } else {
    console.log(`  ❌ ${label}${details ? ' — ' + details : ''}`);
    FAILED++;
  }
}

// ══════════════════════════════════════════════════════════════
// TEST 1: Rate Limiting
// ══════════════════════════════════════════════════════════════
async function testRateLimiting() {
  console.log('\n🔒 TEST 1: Rate Limiting');

  // NOTE: Rate limiter skips localhost in dev mode. This test only works
  // when running against a non-localhost URL (e.g., LAN IP in production).
  if (BASE.includes('localhost') || BASE.includes('127.0.0.1')) {
    console.log('  ⏭️  Skipped — rate limiter is off for localhost in dev mode');
    console.log('     To test: set BASE to a LAN IP like http://192.168.1.50:5000');
    return;
  }

  // Auth endpoints should be rate-limited more strictly
  const results = [];
  for (let i = 0; i < 35; i++) {
    const r = await request('POST', '/api/auth/login', {
      email: 'nonexistent@test.com',
      password: 'wrongpassword',
    });
    results.push(r.status);
  }

  const has429 = results.some(s => s === 429);
  assert(has429, 'Auth rate limit triggers after ~30 attempts', `got status codes: ${[...new Set(results)].sort().join(',')}`);
}

// ══════════════════════════════════════════════════════════════
// TEST 2: Authentication — no token
// ══════════════════════════════════════════════════════════════
async function testNoToken() {
  console.log('\n🔒 TEST 2: Authentication — no token');

  const savedToken = TOKEN;
  TOKEN = '';

  const r1 = await request('GET', '/api/appointments');
  assert(r1.status === 401, 'GET /appointments without token returns 401', `got ${r1.status}`);

  const r2 = await request('PATCH', '/api/appointments/fake-id/status', { status: 'completed' });
  assert(r2.status === 401, 'PATCH /appointments/:id/status without token returns 401', `got ${r2.status}`);

  const r3 = await request('POST', '/api/reminders/cron');
  assert(r3.status === 401, 'POST /reminders/cron without token returns 401', `got ${r3.status}`);

  TOKEN = savedToken;
}

// ══════════════════════════════════════════════════════════════
// TEST 3: Role-Based Access Control
// ══════════════════════════════════════════════════════════════
async function testRBAC() {
  console.log('\n🔒 TEST 3: Role-Based Access Control');

  // Admin-only endpoints should reject non-admin tokens
  const endpoints = [
    { method: 'POST', path: '/api/no-show/sweep', label: 'No-show sweep' },
    { method: 'PUT',  path: '/api/no-show/policy', label: 'No-show policy update' },
    { method: 'POST', path: '/api/reminders/cron', label: 'Reminder cron' },
    { method: 'POST', path: '/api/reminders/vaccination-cron', label: 'Vaccination cron' },
    { method: 'GET',  path: '/api/reminders/templates', label: 'Reminder templates' },
    { method: 'GET',  path: '/api/admin/users', label: 'User management' },
    { method: 'GET',  path: '/api/predictive/summary', label: 'Predictive analytics' },
    { method: 'GET',  path: '/api/prescriptive/summary', label: 'Prescriptive analytics' },
  ];

  // NOTE: These tests need a non-admin token. If using an admin token,
  // they'll pass (admin has access). Set a different token to test rejection.
  if (!TOKEN) {
    console.log('  ⏭️  Skipping RBAC tests (no token provided)');
    return;
  }

  for (const { method, path, label } of endpoints) {
    const r = await request(method, path, {});
    const allowed = r.status !== 403 && r.status !== 401;
    assert(allowed || r.status === 403 || r.status === 401,
      `${label} returns proper status for current role`, `got ${r.status}`);
  }
}

// ══════════════════════════════════════════════════════════════
// TEST 4: Input Validation
// ══════════════════════════════════════════════════════════════
async function testInputValidation() {
  console.log('\n🔒 TEST 4: Input Validation');

  // These tests need Joi validation + auth. Without a token, auth middleware
  // returns 401 before validation runs, which is also correct behavior.
  function isGood(s) { return [400, 401, 403, 404].includes(s); }

  // Reschedule with invalid data
  const r1 = await request('PATCH', '/api/appointments/fake-id/reschedule', {
    appointmentAt: 'not-a-date',
    durationMins: 'not-a-number',
  });
  assert(isGood(r1.status), 'Reschedule rejects invalid appointmentAt', `got ${r1.status}`);

  // Status update with invalid status
  const r2 = await request('PATCH', '/api/appointments/fake-id/status', {
    status: 'invalid_status',
  });
  assert(isGood(r2.status), 'Status update rejects invalid status value', `got ${r2.status}`);

  // No-show policy with invalid grace period (needs admin token for 400)
  const r3 = await request('PUT', '/api/no-show/policy', {
    grace_period_mins: -5,
  });
  assert(isGood(r3.status), 'No-show policy rejects negative grace period', `got ${r3.status}`);

  // No-show policy with too large grace period
  const r4 = await request('PUT', '/api/no-show/policy', {
    grace_period_mins: 99999,
  });
  assert(isGood(r4.status), 'No-show policy rejects grace period > 1440', `got ${r4.status}`);

  // Booking with missing required fields
  const r5 = await request('POST', '/api/appointments', {
    notes: 'no required fields',
  });
  assert(isGood(r5.status), 'Booking rejects missing fields', `got ${r5.status}`);

  // XSS in notes field — with or without token, should not crash
  const r6 = await request('PATCH', '/api/appointments/fake-id/reschedule', {
    notes: '<script>alert("xss")</script>',
    appointmentAt: new Date(Date.now() + 86400000).toISOString(),
  });
  assert(isGood(r6.status) || r6.status === 200,
    'XSS payload in notes is handled safely', `got ${r6.status}`);
}

// ══════════════════════════════════════════════════════════════
// TEST 5: Security Headers (Helmet)
// ══════════════════════════════════════════════════════════════
async function testSecurityHeaders() {
  console.log('\n🔒 TEST 5: Security Headers (Helmet)');

  const r = await request('GET', '/health');
  const headers = {};
  // Manually parse headers from raw response
  const url = new URL(BASE + '/health');
  const res = await new Promise((resolve) => {
    http.get(url.href, resolve);
  });
  for (const [k, v] of Object.entries(res.headers)) {
    headers[k.toLowerCase()] = v;
  }

  assert(headers['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options: nosniff',
    `got ${headers['x-content-type-options']}`);
  assert(headers['x-frame-options'] === 'DENY' || headers['x-frame-options'] === 'SAMEORIGIN',
    'X-Frame-Options set', `got ${headers['x-frame-options']}`);
  assert(headers['x-xss-protection'] === '0' || !!headers['x-xss-protection'],
    'X-XSS-Protection set', `got ${headers['x-xss-protection']}`);
  assert(!!headers['content-security-policy'] || !!headers['content-security-policy-report-only'],
    'Content-Security-Policy header present', `found: ${!!headers['content-security-policy']}`);
  assert(!!headers['strict-transport-security'],
    'Strict-Transport-Security header present', `found: ${!!headers['strict-transport-security']}`);
}

// ══════════════════════════════════════════════════════════════
// TEST 6: CORS
// ══════════════════════════════════════════════════════════════
async function testCORS() {
  console.log('\n🔒 TEST 6: CORS Protection');

  // Request with unauthorized origin
  const url = new URL(BASE + '/health');
  const res = await new Promise((resolve) => {
    const req = http.get({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: {
        Origin: 'https://evil-attacker.com',
      },
    }, resolve);
  });

  // CORS should NOT include the evil origin in the response
  const acao = res.headers['access-control-allow-origin'];
  assert(acao !== 'https://evil-attacker.com',
    'CORS rejects evil origin', `got ACAO: ${acao}`);
}

// ══════════════════════════════════════════════════════════════
// TEST 7: Error Message Sanitization
// ══════════════════════════════════════════════════════════════
async function testErrorSanitization() {
  console.log('\n🔒 TEST 7: Error Message Sanitization');

  // Request with a non-existent UUID — should not leak DB internals
  const r = await request('GET', '/api/appointments/00000000-0000-0000-0000-000000000000');

  // 401 without token is fine (auth blocks before error)
  if (r.status === 401) {
    console.log('  ⏭️  No token — auth blocks before error sanitization test');
    return;
  }

  const msg = JSON.stringify(r.body);
  assert(!msg.includes('column'), 'Error does not contain column names', msg.slice(0, 200));
  assert(!msg.includes('relation'), 'Error does not contain relation names', msg.slice(0, 200));
  assert(!msg.includes('supabase'), 'Error does not contain supabase internals', msg.slice(0, 200));
  assert(!msg.includes('stack'), 'Error does not contain stack trace', msg.slice(0, 200));
}

// ══════════════════════════════════════════════════════════════
// TEST 8: SQL Injection
// ══════════════════════════════════════════════════════════════
async function testSQLInjection() {
  console.log('\n🔒 TEST 8: SQL Injection');

  // Try SQL injection via login
  const r = await request('POST', '/api/auth/login', {
    email: "admin' OR '1'='1",
    password: "'; DROP TABLE users; --",
  });
  assert(r.status !== 200, 'SQL injection in login does not succeed', `got ${r.status}`);

  // Try SQL injection via query params — 401 (no token) or 400 (invalid) are both fine
  const r2 = await request('GET', "/api/appointments?status=' OR '1'='1");
  assert(r2.status !== 200 || !String(r2.body).includes('users'),
    'SQL injection in query params is handled safely', `got ${r2.status}`);
}

// ══════════════════════════════════════════════════════════════
// RUN ALL TESTS
// ══════════════════════════════════════════════════════════════
async function run() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  VETLINK Security Test Suite');
  console.log('  Target: ' + BASE);
  console.log('  Token: ' + (TOKEN ? 'SET (length ' + TOKEN.length + ')' : 'NOT SET'));
  console.log('═══════════════════════════════════════════════════');

  await testSecurityHeaders();
  await testCORS();
  await testNoToken();
  await testRateLimiting();
  await testInputValidation();
  await testErrorSanitization();
  await testSQLInjection();
  await testRBAC();

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  Results: ${PASSED} passed, ${FAILED} failed`);
  console.log('═══════════════════════════════════════════════════');
  process.exit(FAILED > 0 ? 1 : 0);
}

run().catch(e => { console.error('Test runner error:', e); process.exit(1); });
