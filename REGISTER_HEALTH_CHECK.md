# 🩺 The Health Check — Descriptive Analytics Module

A four-role descriptive analytics dashboard added to VETLINK.
Backend, frontend, SQL, and exports — all included.

---

## What was added

**Database** (`database/`)
- `phase5_analytics.sql` — analytics indexes, four convenience views, two RPC helpers.

**Backend** (`backend/src/`)
- `services/analyticsService.js` — four role-scoped report builders.
- `controllers/analyticsController.js` — HTTP layer.
- `routes/analyticsRoutes.js` — `/api/analytics/health-check/*` endpoints.
- Wired into `index.js` (followed the existing `try/catch require` pattern, so it loads only if present).

**Frontend** (`frontend/src/`)
- `services/healthCheckService.js` — Axios wrapper around the new endpoints.
- `utils/exportHelpers.js` — CSV (Blob) + PDF (`window.print`) helpers, **no new npm deps**.
- `components/healthcheck/` — KpiTile, ChartCard, DateRangeFilter, charts.jsx (pure-SVG Bar/HBar/Line/Donut/SparkLine).
- `pages/HealthCheckPage.jsx` — top-level page, auto-routes to the right dashboard.
- `pages/health-check/{Admin,Vet,Staff,Client}HealthCheck.jsx` — the four role dashboards.
- Routes added in `App.jsx` (`/health-check`, `/client/health-check`).
- Sidebar entries added in `Sidebar.jsx` (admin/vet/staff) and `ClientSidebar.jsx`.

---

## Deploy steps

### 1. Run the SQL migration

In Supabase SQL Editor, run **`database/phase5_analytics.sql`** (it's idempotent — safe to re-run).

This creates:
- `idx_*` indexes on `appointments`, `pets`, `medical_records`, `payments`.
- Views: `v_appointments_enriched`, `v_revenue_monthly`, `v_top_diagnoses`, `v_pet_visit_frequency`.
- Functions: `fn_appointments_by_day(start, end)`, `fn_vaccination_compliance()`.

### 2. Restart the backend

No new packages required. The route is auto-loaded via the existing `try { require(...) } catch {}` pattern in `backend/src/index.js`.

```bash
cd backend
npm run dev   # or `npm start`
```

You should see this line in the startup log:

```
[INFO] boot Routes registered { routes: [..., '/api/analytics'] }
```

### 3. Restart the frontend

No new packages required either. Pure-SVG charts + native `Blob` for CSV + native `window.print()` for PDF.

```bash
cd frontend
npm run dev
```

### 4. Try it

- Log in as **admin** → click **Health Check** in the sidebar → `/health-check`.
- Same path serves **vet** and **staff** with role-appropriate metrics.
- Log in as a **client** → click **Health Check** → `/client/health-check`.

---

## API reference

All endpoints require `Authorization: Bearer <supabase_jwt>` (existing `authMiddleware`).

| Method | Path                                    | Required role(s)             | Notes                                                    |
| ------ | --------------------------------------- | ---------------------------- | -------------------------------------------------------- |
| GET    | `/api/analytics/health-check`           | any authenticated user       | Auto-routes to the right report based on caller role.    |
| GET    | `/api/analytics/health-check/admin`     | `admin`                      | Clinic-wide.                                             |
| GET    | `/api/analytics/health-check/vet`       | `veterinarian`, `admin`      | Admins may pass `?vetId=…` to inspect another vet.       |
| GET    | `/api/analytics/health-check/staff`     | `staff`, `admin`             | Operations.                                              |
| GET    | `/api/analytics/health-check/client`    | `client`, `admin`, `staff`   | Admins/staff may pass `?clientId=…` to inspect a client. |

Common query string: `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` (defaults: trailing 90 days).

Response shape (all roles):

```json
{
  "success": true,
  "data": {
    "role": "admin",
    "window": { "start": "2026-02-13", "end": "2026-05-14" },
    "kpis":   { "...": "..." },
    "charts": { "...": "..." }
  }
}
```

---

## What each role sees

**Admin — clinic-wide**
KPIs: appointments / completion rate / no-show rate / revenue / pets / users / vaccination rate / records.
Charts: appointments per day (stacked by status), status mix, top types, caseload by vet, day-of-week, pets by species/breed/age/weight/gender, top diagnoses, monthly revenue, payments by status & method, users by role.

**Veterinarian — caseload**
KPIs: my appointments / completed / upcoming / cancelled / avg duration / records authored / follow-ups due / unique pets.
Charts: caseload over time, status mix, appointment types, top diagnoses I've recorded, pets treated by species.

**Staff — operations**
KPIs: throughput / pending / confirmed / completed / cancellations / no-show rate / collected / outstanding / paid count.
Charts: appointment volume, status mix, caseload by vet, top services booked, payments by status, payment methods.

**Client — pet family**
KPIs: pets / visits booked / completed / upcoming / records / follow-ups / cancellations / window.
Charts: visits over time, status mix, visit types, visits per pet, **per-pet weight trend lines**, pet directory table.

---

## Exports

- **CSV (per chart)** — every `ChartCard` shows a "CSV" button. Clicking downloads the underlying series as a UTF-8 CSV with a BOM (Excel-friendly).
- **PDF (full page)** — header has an "Export PDF" button. Opens the browser's print dialog with a print stylesheet that hides the sidebar/topbar and keeps each chart on one page. The user picks "Save as PDF" from the destination dropdown.

---

## Heads-up

- The vaccination-compliance check is keyword-based against `diagnosis / treatment / prescription` (matches `vaccin*`, `booster`, `immuniz*`). When a proper `vaccinations` table is added later, swap `fn_vaccination_compliance()` to read from it.
- Heavy aggregation runs in the JS service for clarity. For a clinic-scale dataset (≤ low tens of thousands of rows) this is plenty fast. If you grow past that, push more rollups into Postgres views/RPCs.
- All backend queries use `supabaseAdmin` (service role) — RLS is bypassed, role gating is enforced via `roleMiddleware`. This matches the rest of the app.
