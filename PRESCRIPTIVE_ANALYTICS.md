# Prescriptive Analytics (Action Plan) — Module Reference

What predictive tells you might happen, prescriptive tells you what to DO.
Three engines surface concrete, ranked recommendations the clinic can act on.
**Admin and veterinarian roles only.**

## Modules

| # | Feature                          | Engine                                                                                   | Endpoint                           |
|---|----------------------------------|------------------------------------------------------------------------------------------|------------------------------------|
| 1 | Dynamic scheduling               | Conflict detection on overlapping vet bookings · sterilization-window check · load balance | `GET /api/prescriptive/scheduling`     |
| 2 | Personalised wellness plans      | Species-aware life-stage rules over age / weight / breed / medical history                | `GET /api/prescriptive/wellness`       |
| 3 | Optimised ordering               | Rolling 90-day usage × horizon + per-category demand from upcoming appointments           | `GET /api/prescriptive/ordering`       |
|   | All-in-one summary + action queue | All three engines in parallel, with a merged priority-sorted queue                       | `GET /api/prescriptive/summary`        |
|   | Persist a snapshot               | Insert engine output into `prescriptive_recommendations` (audit trail)                  | `POST /api/prescriptive/recommendations` |

Query params:
- `horizonDays` — days of demand to cover (7..180, default 30). Used by `/ordering` and `/summary`.
- `petId`, `ownerId`, `species` — filter `/wellness`.

All endpoints require `Authorization: Bearer <token>` and an `admin` or `veterinarian` role.
401/403 otherwise.

## Files added

### Database
- `database/phase8_prescriptive.sql`
  - Tables: `rooms`, `equipment`, `equipment_usage`, `vet_availability`, `prescriptive_recommendations`
  - Views: `v_presc_upcoming_appointments`, `v_presc_vet_load`, `v_presc_equipment_status`,
    `v_presc_pet_wellness_baseline`, `v_presc_upcoming_demand`
  - RPCs: `fn_presc_demand_from_upcoming`, `fn_presc_schedule_conflicts`
  - Seed data: 5 rooms + 6 pieces of equipment (idempotent)
  - RLS policies (staff read where appropriate, admin/vet write)

### Backend (`backend/src/`)
- `services/prescriptive/recommenders.js` — pure-JS engines (scheduling/wellness/ordering),
  zero DB dependency, easy to unit-test.
- `services/prescriptiveService.js` — pulls features from Supabase, delegates to engines.
- `controllers/prescriptiveController.js` — HTTP layer.
- `routes/prescriptiveRoutes.js` — admin/vet router mounted at `/api/prescriptive`.
- `index.js` — `prescriptiveRoutes` registered alongside the other analytics routers.

### Frontend (`frontend/src/`)
- `services/prescriptiveService.js` — axios wrapper.
- `components/prescriptive/RecommendationCard.jsx` — uniform card with priority chip,
  optional Accept / Dismiss actions.
- `pages/prescriptive/PrescriptiveAnalyticsPage.jsx` — dashboard shell + tab nav + regenerate/PDF.
- `pages/prescriptive/SchedulingTab.jsx`
- `pages/prescriptive/WellnessTab.jsx` (with pet/owner/breed search + life-stage filter)
- `pages/prescriptive/OrderingTab.jsx`
- `App.jsx` — route `/prescriptive-analytics` (and alias `/action-plan`).
- `components/dashboard/Sidebar.jsx` — "Action Plan" entry for admin AND vet.

## Run order

1. Apply migrations in order: `phase1` → `phase2` → `phase3` → `phase4_payments` → `phase5_analytics` → `phase6_diagnostic` → `phase7_predictive` → **`phase8_prescriptive`**.
2. (Optional) Seed `vet_availability` so the scheduling load calc is meaningful — without it the engine still produces conflict / sterilization recommendations but skips load balancing.
3. Restart the backend (`npm run dev` in `backend/`). The boot log should include `/api/prescriptive` in the registered routes list.
4. Restart the frontend (`npm run dev` in `frontend/`). Sign in as `admin` or `veterinarian`. The sidebar will show an "Action Plan" entry.

## How the engines work

### 1. Dynamic scheduling
- **Conflicts** (`critical`): the RPC `fn_presc_schedule_conflicts` returns every pair of upcoming
  appointments where the same vet has overlapping `(appointment_at, duration_mins)` windows.
  The engine attaches the overlap-in-minutes to each rec.
- **Sterilization gaps** (`high`): every appointment whose service name matches `SURGERY_KEYWORDS`
  (surgery / spay / neuter / dental / orthopedic) is checked against the earliest `available_after`
  in the surgical-equipment pool. If the kit won't be ready, the engine suggests pushing the
  appointment by N minutes or swapping kits.
- **Load balancing** (`medium`/`low`): vets with > 90% utilisation are flagged as over-booked
  and the engine suggests redistributing to vets with ≤ 40% utilisation.

### 2. Personalised wellness plans
For every pet, build a `life_stage` from species + age (puppy/kitten / adult / mature / senior),
then derive:
- **Nutrition**: stage-appropriate formula + a Kleiber-style daily caloric target
  (`70 × weight^0.75` for dogs, `50 × weight^0.67` for cats).
- **Exercise**: stage + species + weight-band specific recommendation.
- **Vaccinations**: full puppy/kitten series vs annual core vaccines.
- **Follow-up cadence**: 30 days (juvenile), 180 (mature), 90 (senior), 365 (healthy adult).
- **Watchpoints**: the 3 most recent diagnoses on record.

Priority climbs from `low` to `critical` based on overdue status + chronic conditions.

### 3. Optimised ordering
- Pull rolling 90-day per-medication usage from `medication_transactions` (`used` + `billed`).
- Pull upcoming-appointment count by inferred category from `v_presc_upcoming_demand`
  (heuristic keyword map: vaccine / antiparasitic / antibiotic / other).
- For each medication compute:
  - `daily_usage = recent_90_total / 90`
  - `horizon_need = daily_usage × horizonDays`
  - `category_share = upcoming_units_for_category / meds_in_category`
  - `projected_need = horizon_need + category_share`
  - `suggested_qty = max(reorder_level, projected_need) − stock_on_hand`
- Priority:
  - `critical` — stock ≤ 0
  - `high` — stock ≤ reorder_level OR days-of-cover < 14
  - `medium` — days-of-cover < 30
  - `low` — otherwise

Output includes a per-line cost estimate (`suggested_qty × unit_price_cents`) and a total.

## Testing the endpoints

```bash
# Authenticate first to grab a JWT (admin or vet account), then:
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/prescriptive/scheduling
curl -H "Authorization: Bearer $TOKEN" "http://localhost:5000/api/prescriptive/wellness?species=Dog"
curl -H "Authorization: Bearer $TOKEN" "http://localhost:5000/api/prescriptive/ordering?horizonDays=60"
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/prescriptive/summary
# Snapshot a generated plan to the audit table:
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"recommendations":[{"module":"scheduling","priority":"high","title":"Test"}]}' \
     http://localhost:5000/api/prescriptive/recommendations
```

Each returns `{ success: true, data: {...} }` on success.

## Sanity checks

- `suggested_qty` is clamped to ≥ 0 (no negative orders).
- Empty medication catalogue → ordering output has 0 line items, no errors.
- Vet load query is left-joined with `vet_availability`; vets with no availability rows still appear
  with `utilization_pct: null` (engine skips them rather than dividing by zero).
- Conflict RPC uses `a.id < b.id` to return each conflict pair exactly once.

## Extending

To add a new recommendation module:
1. Add a view or RPC in `database/phase8_prescriptive.sql` (or a new phase).
2. Add a recommender function in `backend/src/services/prescriptive/recommenders.js`.
3. Add a service function in `backend/src/services/prescriptiveService.js`.
4. Add a controller method + route entry.
5. Add a tab file in `frontend/src/pages/prescriptive/` and register it in `PrescriptiveAnalyticsPage.jsx`.

## How this fits the analytics stack

VETLINK now has four progressive analytics layers:

| Layer        | Asks                            | Module                                            |
|--------------|---------------------------------|---------------------------------------------------|
| Descriptive  | "What is happening?"            | Health Check (`/health-check`)                   |
| Diagnostic   | "Why is it happening?"          | Root Cause (`/diagnostic-analytics`)             |
| Predictive   | "What will happen next?"        | Predictive (`/predictive-analytics`)             |
| Prescriptive | "What should we do about it?"   | Action Plan (`/prescriptive-analytics`) — this   |
