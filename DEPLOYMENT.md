# VETLINK Deployment Guide
## Vercel (Frontend) + Railway (Backend)

---

## Prerequisites
- GitHub account (push code to a repo)
- Vercel account (free tier works)
- Railway account (free tier: $5/month credit)
- Supabase project (already set up)

---

## Step 1: Push Code to GitHub

```bash
cd VETLINK
git init
git add .
git commit -m "Initial VETLINK commit"
git remote add origin https://github.com/YOUR_USERNAME/VETLINK.git
git push -u origin main
```

---

## Step 2: Deploy Backend to Railway

1. Go to [railway.app](https://railway.app) → Sign in with GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select the VETLINK repo
4. Railway will auto-detect the `backend/` folder — select it as the root directory
5. Go to **Settings** → **Environment Variables** → Add all variables from `.env.example`:

```
NODE_ENV=production
PORT=5000
SUPABASE_URL=https://pnyykxzmuhchkrlkxupq.supabase.co
SUPABASE_ANON_KEY=your-key
SUPABASE_SERVICE_ROLE_KEY=your-key
SUPABASE_JWT_SECRET=your-secret
FRONTEND_URL=https://your-app.vercel.app
SEMAPHORE_API_KEY=your-key
SEMAPHORE_SENDER=VETLINK
PAYMONGO_SECRET_KEY=sk_live_xxx
PAYMONGO_PUBLIC_KEY=pk_live_xxx
PAYMONGO_WEBHOOK_SECRET=whsec_xxx
PAYMONGO_RETURN_URL=https://your-app.vercel.app
SMS_DISABLED=0
```

6. Railway will auto-deploy. Note the generated URL (e.g., `https://your-app.up.railway.app`)
7. **Test:** Visit `https://your-app.up.railway.app/health` — should return JSON

---

## Step 3: Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → Sign in with GitHub
2. Click **"Add New Project"** → Import the VETLINK repo
3. Set **Root Directory** to `frontend`
4. Vercel auto-detects Vite — keep defaults
5. Go to **Settings** → **Environment Variables** → Add:

```
VITE_SUPABASE_URL=https://pnyykxzmuhchkrlkxupq.supabase.co
VITE_SUPABASE_ANON_KEY=your-key
VITE_API_URL=
```

6. **Update `vercel.json`** — replace `your-railway-backend.up.railway.app` with your actual Railway URL:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://YOUR-ACTUAL-RAILWAY-URL.up.railway.app/api/:path*"
    },
    {
      "source": "/((?!api/).*)",
      "destination": "/index.html"
    }
  ]
}
```

7. Click **Deploy**
8. **Test:** Visit `https://your-app.vercel.app` — should load the frontend

---

## Step 4: Run Database Migrations

In Supabase SQL Editor, run these in order:
```sql
-- Run each file one at a time:
-- 1. phase16_reminders.sql
-- 2. phase17_no_show_policy.sql
-- 3. phase18_double_booking.sql
-- 4. fix_vet_id_ambiguity.sql
-- 5. fix_vet_specific_messaging.sql
-- 6. fix_sms_opt_in.sql
```

---

## Step 5: Set Up PayMongo Webhook

1. Go to [PayMongo Dashboard](https://dashboard.paymongo.com) → **Webhooks**
2. Add webhook URL: `https://your-railway-url.up.railway.app/api/payments/webhook`
3. Copy the webhook secret → Add to Railway env as `PAYMONGO_WEBHOOK_SECRET`

---

## Step 6: Create Admin Account

After deployment, create the first admin account:
1. Register via the frontend as a staff member
2. In Supabase, manually update the user's role to `admin`:
```sql
UPDATE public.users SET role = 'admin' WHERE email = 'your-email@example.com';
```

---

## Step 7: Set Up Cron Jobs (Optional)

For appointment reminders and no-show checks, set up a cron service:
- Use [cron-job.org](https://cron-job.org) (free tier)
- Or Railway's built-in cron (if on paid plan)

Schedule these endpoints:
```
POST https://your-railway-url.up.railway.app/api/reminders/cron
POST https://your-railway-url.up.railway.app/api/reminders/vaccination-cron
POST https://your-railway-url.up.railway.app/api/reminders/telehealth-cron
POST https://your-railway-url.up.railway.app/api/no-show/sweep
```

All require admin JWT in the Authorization header.

---

## Environment Variables Summary

### Railway (Backend)
| Variable | Required | Notes |
|----------|----------|-------|
| `NODE_ENV` | ✅ | Set to `production` |
| `PORT` | ✅ | Railway provides this automatically |
| `SUPABASE_URL` | ✅ | From Supabase dashboard |
| `SUPABASE_ANON_KEY` | ✅ | From Supabase dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | From Supabase dashboard |
| `SUPABASE_JWT_SECRET` | ✅ | From Supabase dashboard → Settings → API → JWT Secret |
| `FRONTEND_URL` | ✅ | Your Vercel URL (e.g., `https://app.vercel.app`) |
| `SEMAPHORE_API_KEY` | Optional | For SMS |
| `PAYMONGO_SECRET_KEY` | Optional | For payments |
| `PAYMONGO_WEBHOOK_SECRET` | Optional | For payment webhooks |
| `SMS_DISABLED` | Optional | `0` to enable SMS |

### Vercel (Frontend)
| Variable | Required | Notes |
|----------|----------|-------|
| `VITE_SUPABASE_URL` | ✅ | Same as backend |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Same as backend |
| `VITE_API_URL` | ❌ | Leave empty — Vercel proxy handles it |

---

## Troubleshooting

### "CORS error" in browser
- Make sure `FRONTEND_URL` in Railway matches your Vercel URL exactly
- Make sure there's no trailing slash

### "401 Unauthorized" on all requests
- Check `SUPABASE_JWT_SECRET` is correct
- Check `SUPABASE_SERVICE_ROLE_KEY` is correct

### Frontend shows blank page
- Check Vercel build logs for errors
- Make sure `vercel.json` rewrites point to your actual Railway URL

### API calls return "Cannot GET /api/..."
- The Vercel rewrite isn't proxying correctly
- Verify the Railway URL in `vercel.json` is correct and accessible
