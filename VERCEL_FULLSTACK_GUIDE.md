# VETLINK — Full-Stack Vercel Deployment Guide

Deploy BOTH the React frontend and the Express backend to Vercel.
The backend runs as a Node serverless function that wraps the existing
Express app (no `app.listen` in the serverless context).

Verified facts about this repo:
- Backend uses multer **memoryStorage** → files go straight to Supabase
  Storage (`emr-files` bucket). Nothing touches local disk, so it is
  safe on serverless (Vercel Functions have an ephemeral read-only FS).
- Frontend is Vite; built output is `frontend/dist`.
- `.env` is loaded via dotenv in backend, but Vercel serverless reads
  real env vars from the dashboard — dotenv no-ops without a file (fine).
- Frontend uses a RELATIVE `/api` base URL (VITE_API_URL left empty),
  so on Vercel everything is same-origin (no CORS needed).

------------------------------------------------------------------
STEP 1 — Split the Express app from app.listen()
------------------------------------------------------------------
Create backend/src/app.js containing everything in backend/src/index.js
EXCEPT the final `app.listen(...)` block. End the file with:
    module.exports = app;
Keep backend/src/index.js for local/Render (require('./app').listen(...)).
No logic changes.

------------------------------------------------------------------
STEP 2 — Serverless entry point (repo root)
------------------------------------------------------------------
Create api/[[...path]].js at the REPO ROOT:
    const app = require('../backend/src/app');
    module.exports = app;
    module.exports.config = { api: { bodyParser: false } };
bodyParser:false is REQUIRED so multer can parse multipart uploads.

------------------------------------------------------------------
STEP 3 — Root package.json
------------------------------------------------------------------
Create package.json at repo root:
{
  "name": "vetlink",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "cd frontend && npm install && npm run build"
  },
  "dependencies": { /* copy ALL backend/package.json dependencies here */ }
}
Backend deps must resolve from root node_modules for the api/ function.

------------------------------------------------------------------
STEP 4 — vercel.json (repo root)
------------------------------------------------------------------
{
  "buildCommand": "npm run build",
  "outputDirectory": "frontend/dist",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/[[...path]]" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
  "headers": [
    { "source": "/assets/(.*)", "headers": [
      { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" } ] }
  ]
}
Remove the old Render URL from frontend/vercel.json (or delete it).

------------------------------------------------------------------
STEP 5 — Environment Variables (Vercel dashboard)
------------------------------------------------------------------
Backend vars (plain env vars):
  SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_JWT_SECRET, FRONTEND_URL=<vercel domain>, NODE_ENV=production,
  SEMAPHORE_API_KEY, SEMAPHORE_SENDER (optional),
  PAYMONGO_SECRET_KEY, PAYMONGO_PUBLIC_KEY, PAYMONGO_WEBHOOK_SECRET,
  PAYMONGO_RETURN_URL (optional), SMS_DISABLED=0

Frontend build vars (Vite bakes these in at build time):
  VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
  DO NOT set VITE_API_URL (leave empty → relative /api).

------------------------------------------------------------------
STEP 6 — Cron endpoints
------------------------------------------------------------------
Options:
A) Vercel Cron (Pro plan) — add to vercel.json:
   "crons": [
     { "path": "/api/reminders/cron", "schedule": "0 8 * * *" },
     { "path": "/api/reminders/vaccination-cron", "schedule": "0 9 * * *" },
     { "path": "/api/reminders/telehealth-cron", "schedule": "0 10 * * *" },
     { "path": "/api/no-show/sweep", "schedule": "30 7 * * *" }
   ]
B) Keep cron-job.org pointing at https://<app>.vercel.app/api/...

------------------------------------------------------------------
STEP 7 — Deploy
------------------------------------------------------------------
Via dashboard: import github.com/chickennuggies07/vetlink
  Root Directory = repo root (NOT frontend/)
  Framework = Vite, Build = npm run build, Output = frontend/dist
  Vercel auto-detects api/[[...path]].js
Or CLI:
  npm i -g vercel && vercel login && vercel --prod

------------------------------------------------------------------
STEP 8 — Post-deploy checks
------------------------------------------------------------------
- https://<app>.vercel.app/health → { service: "VETLINK API" }
- Login through UI → /api/auth/* works same-origin
- Upload an EMR file → multer+Supabase path works serverless
- Repoint PayMongo webhook → https://<app>.vercel.app/api/payments/webhook
- Update/rotate cron targets to the new Vercel URL

------------------------------------------------------------------
CAVEATS
------------------------------------------------------------------
- Cold starts: first request after idle takes a few seconds.
- Hobby functions timeout at 10s (Pro = 60s). Heavy analytics may need Pro.
- Commit api/, root package.json, root vercel.json, backend/src/app.js
  before deploying (remote already exists: chickennuggies07/vetlink).