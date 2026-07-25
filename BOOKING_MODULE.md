# VETLINK Smart Frictionless Booking & Intake

A reason-driven appointment-booking flow with dynamic slot lookup,
nearest-vet matching, urgency triage (with automatic emergency
alerts + draft SOAP), and structured pre-visit intake forms.

Sits **alongside** the existing `/appointments` flow — nothing
existing is broken.

Stack: React + Vite + Tailwind on the frontend, Express + Joi
on the backend, PostgreSQL via Supabase for storage and slot
computation.

---

## 1. What was added

### Database (`database/phase11_booking.sql`)

| Object | Purpose |
| --- | --- |
| `appointment_reason` enum | `annual_checkup` / `vaccination` / `grooming` / `injury` / `emergency` / `other` |
| `urgency_level` enum | `routine` / `standard` / `urgent` / `emergency` |
| New columns on `appointments` | `reason_code`, `urgency`, `triaged_at`, `triaged_by` |
| `appointment_intakes` table | One pre-visit intake per appointment (symptoms, diet, meds, behavior, fasting, consent) |
| `get_available_slots(vet, date, slot_mins)` | PL/pgSQL function returning open slot starts inside the vet's working hours, conflict-checked against existing bookings |
| `find_open_vets(date, around_time, limit)` | Returns ranked vet rows: each vet's nearest open slot to a target time + their day caseload |
| `v_vet_load_today` | Per-vet count of pending/confirmed appointments today (tiebreaker) |

`appointment_intakes` has RLS enabled — clients access only their own
pet's intakes; admin/vet/staff have full access.

### Backend (Express)

```
backend/src/
├── services/
│   └── bookingService.js     ← reasons, slots, vet ranking, booking,
│                               intake, vet upcoming dashboard, retriage
├── controllers/
│   └── bookingController.js
├── validations/
│   └── bookingValidation.js  ← Joi schemas + validateBody()
└── routes/
    └── bookingRoutes.js      ← mounted at /api/booking
```

Routes auto-registered in `backend/src/index.js` via the existing
`try { require(...) } catch (_) {}` pattern.

### Frontend (React + Vite)

```
frontend/src/
├── services/
│   └── bookingService.js              ← axios client
├── components/booking/
│   ├── ReasonPicker.jsx               ← 5-tile reason picker w/ urgency badges
│   ├── SlotPicker.jsx                 ← date strip + suggested vets + per-vet slot list
│   ├── IntakeForm.jsx                 ← collapsible-section intake editor
│   └── IntakeSummary.jsx              ← read-only intake display (vet view)
└── pages/booking/
    ├── SmartBookingPage.jsx           ← /client/book wizard (4 steps)
    ├── IntakeSubmitPage.jsx           ← /intake/:appointmentId
    └── VetIntakeReviewPage.jsx        ← /vet/intake-review pre-visit dashboard
```

Routes registered in `App.jsx`; sidebar entries added in both staff
(`Sidebar.jsx`) and client (`ClientSidebar.jsx`).

---

## 2. REST API reference (base: `/api/booking`)

All endpoints require auth.

| Method | Path | Roles | Purpose |
| --- | --- | --- | --- |
| GET    | `/reasons`                              | any                | Canonical reason list (label, urgency, durationMins, suggestedSpecialty, color) |
| GET    | `/slots?vetId=&date=&slotMins=`         | any                | Open slot starts for one vet on a date |
| GET    | `/suggest-vets?reasonCode=&date=&preferredTime=&limit=` | any | Ranked vets + each vet's nearest open slot |
| POST   | `/`                                     | client, admin, staff | Create a booking. Emergency-coded reasons fire the alert workflow. |
| PATCH  | `/:appointmentId/triage`                | admin, staff, vet  | Override urgency on an existing appointment |
| POST   | `/intake`                               | any                | Submit / update the pre-visit intake (clients limited to own pets) |
| GET    | `/intake/:appointmentId`                | any                | Read the intake (clients = own, vets = assigned, staff/admin = all) |
| GET    | `/vet/upcoming?days=7`                  | vet, admin, staff  | Upcoming appointments (with intake nested) |

Response shape: `{ success: boolean, data?, error? }`.

---

## 3. Smart logic — the moving parts

**Vet ranking (`find_open_vets`)**
1. Build the set of vets on schedule for the target date.
2. For each vet, ask `get_available_slots(...)` for all open
   times — these already exclude past slots and slots that
   conflict with another pending/confirmed booking.
3. Pick each vet's slot closest to the client's preferred time
   (`ROW_NUMBER() OVER (PARTITION BY vet ORDER BY ABS(slot − target))`).
4. Order vets by `delta_mins ASC, load_today ASC` so a less-busy
   vet wins ties.

**Specialty filter (Node layer)** — when the reason has a
`suggestedSpecialty` ("Surgery" for `injury`, "Emergency & Critical
Care" for `emergency`) and at least one matching vet is in the
top-N, the list is narrowed to those vets. Otherwise the original
ranking stands so the client always sees something.

**Emergency triage** — when `reasonCode === 'emergency'`:
- The booking is created with `urgency='emergency'`, `status='confirmed'` (no approval queue).
- Every active admin + staff user gets an in-app notification (`🚨 EMERGENCY booking`) via the existing `notificationService`.
- If a vet is already assigned, a draft `medical_records` + draft `soap_notes` row is created, with `subjective` prefilled `"🚨 EMERGENCY — see intake form on appointment for symptoms & history."` The vet completes this at triage.

**Conflict prevention** — slots are recomputed on every render of the picker, and the SQL function uses `tstzrange(... '[)')` overlap detection, so two clients can't grab the same minute even if they click simultaneously.

---

## 4. One-time setup

1. **Run the migration** in the Supabase SQL Editor — paste and run
   `database/phase11_booking.sql`. It depends on the existing
   `appointments` + `vet_schedules` tables, so phases 1–10 must be
   in place. After running, refresh the PostgREST cache so the new
   types and functions are visible:
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```

2. **Make sure vets have working hours.** The slot function only
   returns rows for vets that have a `vet_schedules` row matching
   the day-of-week. If none of your vets has hours configured for,
   say, Tuesday, the picker will show "No vets have free slots on
   this date." Add hours via the existing Vet Schedule UI.

3. **Restart the backend** so `bookingRoutes` is registered. You
   should see `/api/booking` in the boot log.

4. **No new packages required** — the module uses only the
   dependencies already in `backend/package.json` and
   `frontend/package.json`.

---

## 5. End-to-end smoke test

1. Sign in as a **client** with at least one pet.
2. Sidebar → **Book Visit** → pick the pet → pick "Annual Check-up" → pick a date.
3. Pick a vet card; choose a different slot if needed; click **Continue** → **Confirm booking**.
4. On the success screen, click **Fill intake form**, submit it.
5. Sign in as the **veterinarian** assigned to that booking.
6. Sidebar → **Pre-visit Review** → expand the appointment → confirm the intake renders inside the row.
7. (Optional) Re-test with **Emergency** as the reason — you should see the red banner with the earliest available slot, the success screen flips to the "EMERGENCY booked — front desk alerted" red gradient, and admin/staff accounts receive an in-app notification.

---

## 6. Extending the module

- **Multi-pet bookings**: extend `createBooking` to accept an array of `petId`s and create N appointments in one transaction.
- **Reminder digests**: combine `bookingService.vetUpcoming` with the `schedule` skill / cron to email a vet their next day's bookings + intake summaries.
- **Pre-visit AI summary**: pipe the intake text into the LLM and store the resulting "vet briefing" on `appointment_intakes` for quick scanning.
- **Telehealth flag**: add a `is_telehealth` column on `appointments`, surface as a fourth reason tile.
