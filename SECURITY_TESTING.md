# VETLINK Security Testing Guide

## Quick Start

### Automated Test Suite

```bash
# 1. Start the backend
cd backend && npm run dev

# 2. In another terminal, run the test suite
cd backend && node tests/security.test.js

# 3. To test with an authenticated token:
TEST_TOKEN="your-jwt-token-here" node tests/security.test.js
```

### Get a Test Token

1. Log in as any user via the frontend or Postman
2. Copy the JWT from the Authorization header or localStorage
3. Pass it as `TEST_TOKEN` env var

---

## Manual Test Checklist

### 🔒 Authentication

| # | Test | How | Expected |
|---|------|-----|----------|
| 1 | No token | `GET /api/appointments` without Authorization header | `401 Unauthorized` |
| 2 | Expired token | Use a decoded/expired JWT | `401 Invalid or expired token` |
| 3 | Invalid token | `Authorization: Bearer fake-token-123` | `401 Invalid or expired token` |
| 4 | Deactivated account | Login with a deactivated user | `403 Account has been deactivated` |

### 🔒 Role-Based Access

| # | Test | How | Expected |
|---|------|-----|----------|
| 5 | Client → admin page | Login as client, call `GET /api/admin/users` | `403 Forbidden` |
| 6 | Staff → admin sweep | Login as staff, call `POST /api/no-show/sweep` | `403 Forbidden` |
| 7 | Vet → user management | Login as vet, call `GET /api/admin/users` | `403 Forbidden` |
| 8 | Client → mark complete | Login as client, call `PATCH /api/appointments/:id/status` with `completed` | `403` |

### 🔒 Input Validation

| # | Test | How | Expected |
|---|------|-----|----------|
| 9 | Invalid UUID | `PATCH /api/appointments/not-a-uuid/reschedule` | `400 Validation failed` |
| 10 | Missing required field | `POST /api/appointments` with empty body | `400 Validation failed` |
| 11 | Invalid status | `PATCH /api/appointments/:id/status { status: 'hacked' }` | `400 Invalid payload` |
| 12 | Negative grace period | `PUT /api/no-show/policy { grace_period_mins: -1 }` | `400 Invalid payload` |
| 13 | Oversized notes | `PATCH /api/appointments/:id/reschedule { notes: "x".repeat(5000) }` | `400 Invalid payload` |

### 🔒 Password Strength

| # | Test | How | Expected |
|---|------|-----|----------|
| 14 | Short password | Register with `password: "abc"` | `400 Validation failed` |
| 15 | No uppercase | Register with `password: "alllower1!"` | `400 Validation failed` |
| 16 | No number | Register with `password: "NoNumber!!"` | `400 Validation failed` |
| 17 | No symbol | Register with `password: "NoSymbol1"` | `400 Validation failed` |
| 18 | Strong password | Register with `password: "MyStr0ng!Pass"` | `201 Created` ✅ |

### 🔒 Security Headers

```bash
curl -I http://localhost:5000/health
```

| # | Header | Expected |
|---|--------|----------|
| 19 | `X-Content-Type-Options` | `nosniff` |
| 20 | `X-Frame-Options` | `DENY` or `SAMEORIGIN` |
| 21 | `Strict-Transport-Security` | `max-age=...` |
| 22 | `Content-Security-Policy` | Present |

### 🔒 CORS

```bash
curl -I -H "Origin: https://evil.com" http://localhost:5000/health
```

| # | Test | Expected |
|---|------|----------|
| 23 | Evil origin | `Access-Control-Allow-Origin` should NOT be `https://evil.com` |
| 24 | Allowed origin | `Access-Control-Allow-Origin` should match your frontend URL |

### 🔒 SQL Injection

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin'\'' OR '\''1'\''='\''1","password":"x"}'
```

| # | Test | Expected |
|---|------|----------|
| 25 | Login SQL injection | `401 Invalid email or password` (not `200`) |
| 26 | Query param injection | `GET /api/appointments?status=' OR '1'='1` → `400` or empty results |

### 🔒 Webhook Security

| # | Test | How | Expected |
|---|------|-----|----------|
| 27 | No signature | `POST /api/payments/webhook` without `Paymongo-Signature` | `401 Invalid webhook signature` |
| 28 | Wrong signature | `POST /api/payments/webhook` with fake signature | `401 Invalid webhook signature` |
| 29 | Stale timestamp | Replay an old webhook with valid signature | `401 Invalid webhook signature` |

---

## Postman Collection

Import this into Postman and set the `{{base}}` and `{{token}}` variables:

```json
{
  "info": { "name": "VETLINK Security Tests" },
  "item": [
    {
      "name": "Auth - No Token",
      "request": {
        "method": "GET",
        "url": "{{base}}/api/appointments"
      },
      "expect": { "status": 401 }
    },
    {
      "name": "Auth - Admin Only (staff token)",
      "request": {
        "method": "GET",
        "url": "{{base}}/api/admin/users",
        "header": [{ "key": "Authorization", "value": "Bearer {{staff_token}}" }]
      },
      "expect": { "status": 403 }
    },
    {
      "name": "Validation - Bad Status",
      "request": {
        "method": "PATCH",
        "url": "{{base}}/api/appointments/00000000-0000-0000-0000-000000000000/status",
        "header": [{ "key": "Authorization", "value": "Bearer {{token}}" }],
        "body": { "raw": "{\"status\":\"hacked\"}", "options": { "raw": { "language": "json" } } }
      },
      "expect": { "status": 400 }
    }
  ]
}
```

---

## What Each Test Validates

| Area | What It Proves |
|------|---------------|
| Rate Limiting | Brute-force login attempts are throttled |
| Auth | Unauthenticated users can't access any data |
| RBAC | Users can only access their permitted resources |
| Validation | Malformed/invalid payloads are rejected before hitting DB |
| Passwords | Weak passwords are rejected at registration |
| Headers | Browser-based attacks (clickjacking, MIME sniffing) are mitigated |
| CORS | Cross-origin requests from unauthorized domains are blocked |
| SQL Injection | Malicious input can't execute arbitrary SQL |
| Error Messages | Internal DB details are never leaked to the client |
| Webhooks | Payment webhooks can't be forged by third parties |
