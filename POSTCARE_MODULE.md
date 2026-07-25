# VETLINK Integrated Post-Care & Pharmacy Hub

End-to-end module covering everything that happens *after* a visit:
digital discharge instructions, prescription refill requests, and
automated medication reminders. Builds on the EMR (`phase9`) and
existing notification/SMS/email services.

Stack: React + Vite + Tailwind on the frontend, Express + Joi on the
backend, PostgreSQL via Supabase for storage, the existing
`notificationService` / `smsService` / `emailService` for delivery.

---

## 1. What was added

### Database (`database/phase12_postcare.sql`)

| Object | Purpose |
| --- | --- |
| `discharge_instructions` table | One discharge per appointment; structured `steps` / `feeding` / `videos` JSON arrays + free-text body |
| `discharge_files` table | Join between discharges and `emr_files` (re-uses the EMR Supabase Storage bucket) |
| `refill_requests` table | Client-initiated refill workflow with `status` enum (pending → approved/denied → dispensed) |
| `medication_reminders` table | Per-prescription schedule (`times_of_day TIME[]`, channels, food instruction) |
| `reminder_dispatch_log` table | Append-only audit of every dispatch attempt |
| `v_due_reminders` view | Active reminders whose `next_fire_at` ≤ NOW; the cron tick scans this |
| `compute_next_fire_at(times, from)` function | Returns the next scheduled timestamp; reused by the BEFORE-INSERT trigger and the JS layer |
| `medrem_set_next_fire` trigger | Keeps `next_fire_at` in sync whenever schedule changes |

All five new tables have RLS enabled — staff have full access; clients
manage their own pets' rows; discharge rows only become visible to
clients once `is_published = true`.

### Backend (Express)

```
backend/src/
├── services/
│   └── postCareService.js          ← discharge CRUD, refill workflow,
│                                     reminder CRUD, cron tick dispatcher
├── controllers/
│   └── postCareController.js
├── validations/
│   └── postCareValidation.js       ← Joi schemas + validateBody()
└── routes/
    └── postCareRoutes.js           ← mounted at /api/postcare
```

Routes are auto-registered in `backend/src/index.js` via the
existing `try { require(...) } catch (_) {}` pattern.

### Frontend (React + Vite)

```
frontend/src/
├── services/
│   └── postCareService.js          ← axios client
├── components/postcare/
│   ├── DischargeView.jsx           ← client read-only display w/ video embeds
│   ├── DischargeEditor.jsx         ← vet editor (steps/feeding/videos arrays)
│   ├── RefillRequestPanel.jsx      ← client "Request refill" + history list
│   └── ReminderManager.jsx         ← reminders list + create/edit modal
└── pages/postcare/
    ├── ClientPostCarePage.jsx      ← /client/postcare (3 tabs)
    ├── ClinicPharmacyPage.jsx      ← /pharmacy (refill queue + tick button)
    └── VetDischargePage.jsx        ← /discharge/:appointmentId
```

Routes added to `App.jsx`; sidebar entries added for both staff
(`Pharmacy`) and clients (`Post-Care & Pharmacy`).

---

## 2. REST API reference (base: `/api/postcare`)

All endpoints require auth.

| Method | Path | Roles | Purpose |
| --- | --- | --- | --- |
| GET    | `/discharges/by-appointment/:appointmentId` | any  | Full discharge for one appointment |
| GET    | `/discharges/pets/:petId`                   | any  | List discharges for a pet (clients see published only) |
| PUT    | `/discharges`                                | admin, vet | Upsert by appointmentId; `isPublished=true` notifies the owner |
| POST   | `/discharges/:dischargeId/files`             | admin, vet | Attach an existing emr_files row |
| DELETE | `/discharges/files/:joinId`                  | admin, vet | Detach a file |
| POST   | `/refills`                                   | any  | Request a refill on an active prescription |
| GET    | `/refills/mine`                              | client | List own requests |
| GET    | `/refills/queue?status=pending`              | admin, vet, staff | Clinic queue |
| PATCH  | `/refills/:id/approve`                       | admin, vet, staff | Approve + auto-bump `prescriptions.refills_used` |
| PATCH  | `/refills/:id/deny`                          | admin, vet, staff | Deny with reason |
| PATCH  | `/refills/:id/dispense`                      | admin, vet, staff | Mark dispensed |
| PATCH  | `/refills/:id/cancel`                        | any  | Cancel (clients own only) |
| GET    | `/reminders?ownerId=`                        | any  | List reminders (defaults to caller) |
| POST   | `/reminders`                                 | any  | Create a reminder |
| PATCH  | `/reminders/:id`                             | any  | Update (owner or staff) |
| DELETE | `/reminders/:id`                             | any  | Delete (owner or staff) |
| GET    | `/reminders/:id/log`                         | any  | Dispatch history |
| POST   | `/reminders/tick`                            | admin, vet, staff | Cron tick — scan + dispatch every due reminder |

Standard `{ success, data?, error? }` envelope.

---

## 3. How automated reminders work

1. The owner creates a `medication_reminders` row binding a
   prescription to one or more `times_of_day` and one or more
   `channels` (`in_app`, `sms`, `email`).
2. A `BEFORE INSERT/UPDATE` trigger calls
   `compute_next_fire_at(times_of_day, NOW)` to stamp the row's
   `next_fire_at` field.
3. Any process can hit `POST /api/postcare/reminders/tick` (require
   staff role) — the service queries `v_due_reminders` (active rows
   with `next_fire_at ≤ NOW + 1 min`), builds the message
   `"Time for {pet}'s {medication} ({dosage}) — {frequency}. {food_instruction}"`,
   and dispatches per channel:
   - `in_app` → `notificationService.create(owner_id, …)`
   - `sms`    → `smsService.sendNotification(phone, message)`
   - `email`  → `emailService.send({ to, subject, html, text })`
4. Each dispatch is logged to `reminder_dispatch_log` with status
   (`sent` / `failed` / `skipped` + error).
5. After dispatch, `next_fire_at` is recomputed for the next slot in
   `times_of_day`. The tick is idempotent — re-running it within the
   same minute won't re-send.

**Wiring the tick.** During dev you can press the **"Run reminder
tick"** button on `/pharmacy`. In prod, hit
`POST /api/postcare/reminders/tick` from one of:
- Supabase pg_cron (extension): `SELECT cron.schedule('postcare-tick', '* * * * *', $$SELECT net.http_post('https://api.../api/postcare/reminders/tick', '{}'::jsonb)$$);`
- An external cron/job runner that POSTs every minute
- A worker process in your own infrastructure

---

## 4. One-time setup

1. **Run the migration** in Supabase SQL Editor:
   ```bash
   # Paste contents of database/phase12_postcare.sql, then
   NOTIFY pgrst, 'reload schema';
   ```
   Phase 12 depends on phase 9 (`prescriptions`, `emr_files`), so
   verify phases 1–11 ran first.

2. **No new packages required** — the module reuses
   `notificationService` (already present), `smsService`
   (configured via `SEMAPHORE_API_KEY` / `TWILIO_*`), and
   `emailService` (configured via `SMTP_*` if you set it up for
   the passport sharing flow).

3. **Restart the backend.** `/api/postcare` will appear in the boot
   log's registered-routes list.

4. **Configure desired channels.** If SMS or email isn't configured,
   the reminder dispatcher silently logs each dispatch as `skipped`
   with reason `"channel not configured"` — no crash. Configure when
   ready.

---

## 5. Smoke test

1. As **vet**: open an appointment and navigate to
   `/discharge/<appointmentId>`. Add a couple of steps, a feeding
   item, and a YouTube tutorial URL. Click **Publish to client** —
   the owner receives an in-app notification.
2. As **client** (the appointment's owner): sidebar → **Post-Care &
   Pharmacy** → **Discharges** tab. The published discharge appears
   in the sidebar; click it to see the steps + embedded video.
3. Switch to **Prescriptions** tab. Click **Request refill** on an
   active prescription with refills remaining.
4. As **admin / vet / staff**: sidebar → **Pharmacy**. The new
   request is in the Pending tab. Click **Approve** — the
   prescription's `refills_used` increments, and the client gets a
   "Refill approved" in-app notification.
5. Back on the client view: switch to **Reminders** tab. Click
   **New reminder**, pick a prescription, set times like
   `08:00` / `20:00`, channels `in_app + sms`, food instruction
   `"give with food"`. Save.
6. As staff on `/pharmacy`, click **Run reminder tick**. If the
   current time is past one of the configured slots, you'll see the
   "Dispatched 1 of 1 due" toast and the client gets:
   *"Time for Max's Amoxicillin (1.5 ml) — twice daily. give with
   food."*

---

## 6. Security notes

- **Refill double-submission** is prevented at the service layer:
  `requestRefill` rejects with HTTP 409 if there's already a pending
  request on the same prescription.
- **Refill rollback safety**: refills_used is incremented inside
  `approveRefill` and only on the way to status=approved. If anything
  later fails, the row's status doesn't advance — but the counter
  did move, so manual reconciliation is needed if you see this. A
  follow-up could wrap the bump + status update in a Supabase RPC
  for true transactional semantics.
- **Reminder dispatch** never crashes the tick — every channel send
  is try/catch'd and logged. The next iteration picks up where the
  last left off.
- **RLS** is enabled on all five new tables; staff use the service
  role and bypass RLS in code, but an accidental anon-key query
  can't leak data.
