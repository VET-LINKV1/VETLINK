# VETLINK Multi-Pet Digital Health Passport

End-to-end module that gives every pet a portable, shareable digital
health record. Builds on top of the EMR module — the same
`vaccinations`, `medical_records`, `prescriptions`, and `emr_files`
tables back the passport.

Stack: **React + Vite + Tailwind + Recharts + jsPDF/html2canvas** on
the frontend, **Express + Joi + nodemailer (optional)** on the backend,
**PostgreSQL via Supabase** for storage.

---

## 1. What was added

### Database (`database/phase10_passport.sql`)

| Object | Purpose |
| --- | --- |
| `pet_weights` | Append-only weight history per pet (with optional BCS) |
| `passport_shares` | Tokenized share links sent by email to outside vets/owners |
| `passport_config` | Single-row config table (expiring window, share TTL) |
| `passport_vaccination_status_v` | View that classifies each row in `vaccinations` as `protected` / `expiring_soon` / `overdue` / `scheduled` / `cancelled` |
| `passport_summary_v` | One row per pet with worst-case vax status, current weight, BCS, visit/file counts |
| `passport_for_token(uuid)` | Helper function for the public token-gated read |

RLS is enabled on the two new tables with the same `is_staff()` /
`owns_pet()` helpers as phase9. The "Expiring Soon" window defaults to
30 days; widen/narrow it by updating
`UPDATE public.passport_config SET expiring_window_days = 60;`.

### Backend (Express)

```
backend/src/
├── services/
│   ├── passportService.js    ← dashboard, single-pet chart, weight CRUD, shares
│   └── emailService.js       ← lazy-loaded nodemailer; degrades to "copy link"
├── controllers/
│   └── passportController.js
├── validations/
│   └── passportValidation.js
└── routes/
    └── passportRoutes.js     ← mounted at /api/passport
```

Routes are auto-registered in `backend/src/index.js` via the existing
`try { require(...) } catch (_) {}` pattern.

### Frontend (React + Vite)

```
frontend/src/
├── services/
│   └── passportService.js                ← axios client (+ public sub-client)
├── components/passport/
│   ├── VaccinationTimeline.jsx           ← color-coded timeline (green/yellow/red/blue)
│   ├── WeightChart.jsx                   ← Recharts line chart + log entries
│   ├── SharePassportModal.jsx            ← email-and-link flow
│   ├── PetPassportCard.jsx               ← dashboard card per pet
│   └── PassportPDF.jsx                   ← printable layout + jsPDF/html2canvas helper
└── pages/passport/
    ├── PassportDashboardPage.jsx         ← /passport (staff) and /client/passport
    ├── PetPassportPage.jsx               ← /passport/pets/:petId (full chart)
    └── SharedPassportPage.jsx            ← /passport/share/:token (public, no auth)
```

Routes added in `frontend/src/App.jsx`. Sidebar entries added for staff
(`Sidebar.jsx`) and clients (`ClientSidebar.jsx`).

---

## 2. REST API reference (base: `/api/passport`)

| Method | Path | Auth | Roles | Purpose |
| --- | --- | --- | --- | --- |
| GET    | `/clients`                            | required | any  | Per-client passport summary rows |
| GET    | `/pets/:petId`                        | required | any  | Full passport for one pet |
| GET    | `/pets/:petId/weights`                | required | any  | Weight history |
| POST   | `/weights`                            | required | admin/vet/staff | Log a new weight |
| DELETE | `/weights/:id`                        | required | admin/vet | Delete a weight point |
| GET    | `/pets/:petId/shares`                 | required | any  | List shares for a pet |
| POST   | `/shares`                             | required | any  | Create + (optionally) email a share link |
| DELETE | `/shares/:id`                         | required | self/staff | Revoke a share |
| GET    | `/shared/:token`                      | **public** | —    | Token-gated read of the passport |

Response shape mirrors the rest of VETLINK: `{ success, data?, error? }`.

---

## 3. One-time setup

### 3a. Install new dependencies

The module adds packages on both sides. From the repo root:

```bash
cd backend
npm install                # picks up nodemailer

cd ../frontend
npm install                # picks up recharts, jspdf, html2canvas
```

(`nodemailer` is loaded lazily — the backend will still boot if it
isn't installed; the share-by-email flow just falls back to "copy link".)

### 3b. Run the migration

In Supabase SQL Editor, paste and run `database/phase10_passport.sql`.
Order: this depends on `vaccinations` from `phase9_emr.sql`, so run
phase9 first if you haven't.

### 3c. (Optional) Configure SMTP for outbound email

Add to `backend/.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-account@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=VETLINK <noreply@your-clinic.com>
SMTP_SECURE=0
```

Without these the share modal still works — it just shows the user a
"copy link" fallback instead of actually delivering the email.

### 3d. (Optional) Set the public app URL

For the share email to embed an absolute URL, set:

```env
FRONTEND_URL=https://your-deployed-app.com
```

Defaults to whatever the current request host derives to (works in dev).

---

## 4. How the color-coding works

`passport_vaccination_status_v` runs each vaccination through this
ladder (top match wins):

1. `cancelled`     → status was explicitly cancelled
2. `overdue`       → status is `overdue` **or** `due_date < today`
3. `protected`     → administered AND (no due_date **or** due_date ≥ today + window)
4. `expiring_soon` → administered AND due_date is within the window
5. `scheduled`     → due_date is in the future, not yet administered

The dashboard summary takes the **worst** status across a pet's
vaccinations and surfaces it on the card. Window length is configurable
via `passport_config.expiring_window_days` (default 30).

---

## 5. Security notes

- **Share tokens are UUIDs** (128-bit, unguessable) and expire on a
  configurable TTL (default 30 days). Every view bumps a view counter so
  staff can see who's been peeking. Tokens can be revoked from
  `DELETE /api/passport/shares/:id`.
- The public endpoint **does not** return owner PII (email / phone) or
  uploaded files. Only the pet profile, vaccinations, weight series,
  recent visits, and active prescriptions are exposed.
- PDF generation is **client-side** with jsPDF + html2canvas. No PDFs
  ever touch the server, and no extra storage is required for them.
- All other routes are behind `authMiddleware`; mutations are also
  behind `roleMiddleware`. RLS is enabled on both new tables for
  defense in depth.

---

## 6. Extending the module

- **Wider obesity flagging**: `WeightChart.jsx` already shows a trend
  delta; add a clinic-defined ideal range per species/breed and flag
  the latest BCS > 6 with a banner.
- **Auto-email reminders**: combine `passport_summary_v.vax_overdue`
  with the existing `notificationService` and a daily cron to nudge
  owners whose pet's status flips to "expiring soon" or "overdue".
- **Vaccination growth ring** (mobile): swap the timeline for a
  donut on small screens — Recharts' `RadialBarChart` makes this a
  20-line change.
- **DICOM previews on the PDF**: the EMR module already has the X-ray
  bytes; pull them in via `getSignedUrl` and embed thumbnails in
  `PassportPDF.jsx`.
