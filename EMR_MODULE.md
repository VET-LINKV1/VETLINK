# VETLINK Advanced EMR Module

End-to-end Electronic Medical Records module that extends VETLINK with
SOAP notes, vaccination tracking, prescription management, treatment
tracking, secure file storage, a per-pet timeline, and cross-record
search.

Built on the existing VETLINK stack: **React + Vite + Tailwind** on the
frontend, **Express + Joi + multer** on the backend, **PostgreSQL via
Supabase** for data, and **Supabase Storage** for files.

---

## 1. What was added

### Database (`database/phase9_emr.sql`)

| Object | Purpose |
| --- | --- |
| `soap_notes` | Structured SOAP entries linked to `medical_records` |
| `emr_files` | Metadata for uploaded files (X-rays, labs, Rx scans, photos, docs) |
| `vaccinations` | Vaccine doses with due dates + status (scheduled / administered / overdue / cancelled) |
| `prescriptions` | Structured prescriptions with refills, dosage, frequency, status |
| `treatments` | Non-medication interventions (surgery, dental, grooming) |
| `medical_timeline_v` | UNION view producing a unified per-pet event stream |
| `mark_overdue_vaccinations()` | Idempotent function flipping `scheduled → overdue` once `due_date` passes |
| `is_staff()`, `owns_pet()` | RLS helper functions reused across policies |

RLS is enabled on every new table with:
- **staff** (`admin`/`veterinarian`/`staff`) → full access
- **client** → SELECT only for rows belonging to their own pets

Plus Supabase Storage:
- Private bucket **`emr-files`**
- Policy `emr_files_staff_all` — staff full CRUD
- Policy `emr_files_client_read` — clients read objects whose key starts with one of their pet IDs

### Backend (Express)

```
backend/src/
├── services/
│   ├── emrService.js        ← SOAP, vax, rx, tx, timeline, chart, search
│   └── emrFileService.js    ← multipart upload, signed URLs, archive
├── controllers/
│   └── emrController.js
├── validations/
│   └── emrValidation.js     ← Joi schemas + validateBody() middleware
├── middleware/
│   └── uploadMiddleware.js  ← multer (memory storage, 25 MB cap, allowed MIME list)
└── routes/
    └── emrRoutes.js         ← mounted at /api/emr
```

Routes are auto-registered in `backend/src/index.js` via the existing
`try { require('./routes/emrRoutes') } catch (_) {}` pattern.

### Frontend (React + Vite)

```
frontend/src/
├── services/
│   └── emrService.js                 ← axios client for /api/emr/*
├── components/emr/
│   ├── ClientPetSelector.jsx         ← collapsible client → pets navigator
│   ├── EMRTimeline.jsx               ← vertical event timeline
│   ├── SOAPEditor.jsx                ← S / O / A / P form
│   ├── SOAPNoteList.jsx              ← read-only display of past SOAP notes
│   ├── VaccinationTracker.jsx       ← list + add + mark-administered + delete
│   ├── PrescriptionManager.jsx      ← list + prescribe + refill + discontinue
│   ├── TreatmentTracker.jsx         ← list + add + advance status
│   └── EMRFileGallery.jsx           ← drag-pick upload + tile grid + signed-URL open
└── pages/emr/
    ├── EMRPage.jsx                  ← staff workspace (mounted at /emr)
    └── ClientEMRPage.jsx            ← read-only owner view (mounted at /client/emr)
```

Routes are added in `frontend/src/App.jsx`, sidebar nav entries added to
`frontend/src/components/dashboard/Sidebar.jsx` for `admin`, `veterinarian`,
and `staff` roles.

---

## 2. REST API reference (base: `/api/emr`)

All endpoints require a Bearer token (`authMiddleware`). Write endpoints
additionally require role membership.

| Method | Path | Roles | Body |
| --- | --- | --- | --- |
| GET    | `/clients`                              | any auth | — |
| GET    | `/pets/:petId/chart`                    | any auth | — |
| GET    | `/pets/:petId/timeline`                 | any auth | `?kinds=visit,vaccination&limit=100&offset=0` |
| POST   | `/soap`                                 | admin, vet | `{ medicalRecordId, subjective, objective, assessment, plan }` |
| PUT    | `/soap/:id`                             | admin, vet | partial SOAP |
| DELETE | `/soap/:id`                             | admin, vet | — |
| GET    | `/pets/:petId/vaccinations`             | any auth | — |
| GET    | `/vaccinations/upcoming?days=30`        | staff    | — |
| POST   | `/vaccinations`                         | admin, vet | `{ petId, vaccineName, ... }` |
| PUT    | `/vaccinations/:id`                     | admin, vet | partial |
| DELETE | `/vaccinations/:id`                     | admin, vet | — |
| GET    | `/pets/:petId/prescriptions`            | any auth | — |
| POST   | `/prescriptions`                        | admin, vet | `{ petId, medicationName, dosage, frequency, ... }` |
| PUT    | `/prescriptions/:id`                    | admin, vet | partial |
| POST   | `/prescriptions/:id/refill`             | admin, vet | — |
| DELETE | `/prescriptions/:id`                    | admin, vet | — |
| GET    | `/pets/:petId/treatments`               | any auth | — |
| POST   | `/treatments`                           | admin, vet | `{ petId, name, ... }` |
| PUT    | `/treatments/:id`                       | admin, vet | partial |
| DELETE | `/treatments/:id`                       | admin, vet | — |
| GET    | `/pets/:petId/files?kind=xray`          | any auth | — |
| GET    | `/files/:id/url`                        | any auth | returns 10-min signed URL |
| POST   | `/files` (multipart)                    | staff (any) | `file=<binary>`, `petId`, `kind`, `title`, `description` |
| PUT    | `/files/:id`                            | admin, vet | partial metadata |
| DELETE | `/files/:id?hard=1`                     | admin, vet | soft by default |
| GET    | `/search?q=…&petId=…&kinds=record,soap` | any auth | — |

All responses share the shape `{ success: boolean, data?, error? }`.

---

## 3. One-time setup steps

1. **Run the migration** in Supabase SQL Editor:
   ```bash
   # Open the file and paste, or via supabase CLI:
   supabase db execute --file database/phase9_emr.sql
   ```
   Order matters: phase9 depends on `medical_records` from `phase3_schema.sql`.

2. **Confirm the storage bucket** exists.
   The migration creates `emr-files` automatically via `INSERT INTO
   storage.buckets`. If your Supabase project disallows that, create it
   manually as a **private** bucket and run the two storage policies at
   the bottom of `phase9_emr.sql`.

3. **No new env vars** are needed — the module reuses the existing
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.

4. **Restart the backend** and visit `/health` — the boot log should
   include `/api/emr` in the registered routes list.

5. **Open `/emr`** as an admin/vet/staff user. Clients see their own
   read-only chart at `/client/emr`.

---

## 4. Security notes

- Auth is enforced at the Express layer (`authMiddleware`) and again at
  the service layer (`assertPetVisible`, `assertCanWrite`, etc.). RLS in
  Supabase provides a third defense if anyone ever queries with the anon
  key directly.
- File bytes never live on the API server. Multer uses **memory
  storage**; the buffer is handed straight to Supabase Storage.
- Files are served via **time-limited signed URLs** (10 minutes); the
  bucket itself stays private.
- Object keys are namespaced by `pet_id`, which the storage RLS policy
  uses to scope client reads.
- Uploads are restricted to a curated MIME allow-list and a 25 MB cap.

---

## 5. Extending the module

- **Notifications**: hook `emrService.createVaccination` to fire owner
  reminders 7 days before `due_date` using the existing
  `notificationService`.
- **PDF export**: add `GET /api/emr/pets/:petId/export.pdf` that joins
  the chart payload and renders via the existing `pdf` skill.
- **Auto-overdue cron**: schedule `SELECT mark_overdue_vaccinations()`
  via Supabase pg_cron once a day so statuses stay accurate without an
  active session.
- **Full-text ranking**: the `idx_soap_notes_fts` GIN index is already
  in place — switch the search service from `ilike` to `to_tsquery`
  ranking when you're ready.
