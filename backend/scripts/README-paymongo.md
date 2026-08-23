# PayMongo Setup (VETLINK)

## Prerequisites
- `backend/.env` has `PAYMONGO_SECRET_KEY` (already set — live key).
- Your backend is **deployed at a public HTTPS URL**.
- The SQL migrations are applied to Supabase:
  - `database/phase4_payments.sql`
  - `database/phase4_payments_pet_invoice.sql`  ← adds `pet_id` + `invoices` table

## 1. Point PayMongo back to your deployed backend

Set `WEBHOOK_URL` in `backend/.env` to your live webhook endpoint:

```
WEBHOOK_URL=https://your-backend-domain.com/api/payments/webhook
```

Also update `PAYMONGO_RETURN_URL` to your production frontend so users return
to the correct success/failed pages after paying:

```
PAYMONGO_RETURN_URL=https://your-frontend-domain.com
```

## 2. Register the webhook (auto)

From the `backend/` folder, run:

```bash
node scripts/setup-paymongo-webhook.js
# or explicitly:
node scripts/setup-paymongo-webhook.js https://your-backend-domain.com/api/payments/webhook
```

This calls PayMongo's API and creates a webhook subscribed to:
- `checkout_session.payment.paid`
- `payment.paid`
- `payment.failed`

It prints the **webhook secret** — shown only ONCE. Copy it immediately
(it's also saved to `backend/.paymongo-webhook-secret.txt` for convenience).

## 3. Save the webhook secret

Put the printed secret into `backend/.env`:

```
PAYMONGO_WEBHOOK_SECRET=<the-secret-from-step-2>
```

Restart the backend. The webhook handler now verifies every incoming signature.

## 4. Verify the flow (on your deployed backend)

1. Log in as a Pet Owner → Book an appointment (this creates a pending payment).
2. On "My Appointments", click **Pay now** → redirected to PayMongo.
3. Pay with a test card / GCash simulator.
4. PayMongo POSTs to your webhook → backend marks payment `paid`,
   confirms the appointment, generates an invoice, sends an SMS/notification.
5. You land on `/client/payment/success` which polls and shows "Payment Successful".

If the webhook isn't reachable yet, the success page falls back to polling
PayMongo directly (reconcile) — payment still completes, just slightly delayed.

## Security notes
- The **secret key** (`PAYMONGO_SECRET_KEY`) and **webhook secret** never leave
  the backend. The React frontend only uses the public key (handled by PayMongo's
  hosted checkout, so even the public key isn't embedded in our code).
- Webhook signatures are verified with HMAC-SHA256. In production, unverified
  webhooks are rejected (401). In dev, a missing secret is tolerated.
- `.env` is gitignored — never commit real credentials.
