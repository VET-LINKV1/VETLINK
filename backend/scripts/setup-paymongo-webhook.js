/**
 * setup-paymongo-webhook.js
 *
 * Run once (locally) to register a PayMongo webhook for your DEPLOYED backend.
 * Prints the webhook secret — SAVE IT IMMEDIATELY (shown only on creation).
 *
 * Usage:
 *   cd backend && node scripts/setup-paymongo-webhook.js
 *
 * Requires:
 *   - PAYMONGO_SECRET_KEY in backend/.env (already set)
 *   - Your backend's public HTTPS URL (pass via arg or env)
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');

const PAYMONGO_API = (process.env.PAYMONGO_API_URL || 'https://api.paymongo.com/v1').replace(/\/$/, '');
const SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;

if (!SECRET_KEY) {
  console.error('❌ PAYMONGO_SECRET_KEY not found in backend/.env');
  process.exit(1);
}

// Webhook target URL — can be passed as first arg or set via WEBHOOK_URL env
const TARGET_URL = process.argv[2] || process.env.WEBHOOK_URL;

if (!TARGET_URL) {
  console.error('❌ Usage: node scripts/setup-paymongo-webhook.js <https://your-backend/api/payments/webhook>');
  console.error('   Or set WEBHOOK_URL in backend/.env');
  process.exit(1);
}

if (!TARGET_URL.startsWith('https://')) {
  console.error('❌ Webhook URL must be HTTPS (PayMongo rejects HTTP)');
  process.exit(1);
}

const EVENTS = [
  'checkout_session.payment.paid',  // primary: checkout completed
  'payment.paid',                    // fallback: standalone payment
  'payment.failed',                  // failed payments
];

function authHeader() {
  return 'Basic ' + Buffer.from(SECRET_KEY + ':').toString('base64');
}

async function request(method, endpoint, body) {
  const res = await fetch(PAYMONGO_API + endpoint, {
    method,
    headers: {
      'Authorization': authHeader(),
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  if (!res.ok) {
    const errMsg = json?.errors?.[0]?.detail || json?.errors?.[0]?.code || `HTTP ${res.status}`;
    throw new Error('PayMongo API error: ' + errMsg);
  }
  return json;
}

async function main() {
  console.log('🔧 Registering PayMongo webhook…');
  console.log('   Target:', TARGET_URL);
  console.log('   Events:', EVENTS.join(', '));
  console.log('   API base:', PAYMONGO_API);
  console.log('');

  try {
    const webhook = await request('POST', '/webhooks', {
      data: {
        attributes: {
          url: TARGET_URL,
          events: EVENTS,
        },
      },
    });

    const data = webhook.data;
    const secret = data?.attributes?.secret;
    const webhookId = data?.id;

    if (!secret || !webhookId) {
      console.error('❌ Unexpected response:', JSON.stringify(webhook, null, 2));
      process.exit(1);
    }

    console.log('✅ Webhook created!');
    console.log('   Webhook ID:', webhookId);
    console.log('   Secret:    ', secret);
    console.log('');
    console.log('⚠️  COPY THE SECRET NOW — PayMongo will NOT show it again.');
    console.log('   Add it to backend/.env:');
    console.log('   PAYMONGO_WEBHOOK_SECRET=' + secret);
    console.log('');

    // Also write it to a temp file for easy copy-paste
    const outPath = path.resolve(__dirname, '../.paymongo-webhook-secret.txt');
    fs.writeFileSync(outPath, secret, 'utf8');
    console.log('   (Also saved to backend/.paymongo-webhook-secret.txt)');

    // Quick verification: fetch it back
    console.log('\n🔎 Verifying webhook is reachable…');
    const fetched = await request('GET', '/webhooks/' + webhookId);
    const status = fetched.data?.attributes?.status;
    console.log('   Status:', status || 'unknown');
    if (status === 'enabled') {
      console.log('   ✅ Webhook is enabled and ready for live traffic.');
    } else {
      console.log('   ⚠️  Webhook status is', status, '— may need manual enable in dashboard.');
    }

  } catch (err) {
    console.error('❌ Failed:', err.message);
    process.exit(1);
  }
}

main();