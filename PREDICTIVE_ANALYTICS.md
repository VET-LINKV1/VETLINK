# Predictive Analytics — Module Reference

Forward-looking analytics for VETLINK. Predicts future clinic trends and
risks using historical data and a mix of ML / decision-tree / statistical
models. **Admin role only.**

## Modules

| # | Feature                       | Model                                                       | Endpoint                          |
|---|-------------------------------|-------------------------------------------------------------|-----------------------------------|
| 1 | Client churn prediction       | Decision-tree rules (inactivity, missed appts, spend, cadence) | `GET /api/predictive/churn`           |
| 2 | Seasonal inventory forecast   | Seasonal-naive (mean-of-month) × linear-trend per medication    | `GET /api/predictive/inventory`       |
| 3 | Appointment forecasting       | Linear regression + month-of-year seasonal multiplier + DOW×hour density | `GET /api/predictive/appointments`    |
| 4 | Treatment risk prediction     | Rule-based classifier (recurring dx, age, follow-ups, overdue)  | `GET /api/predictive/treatment-risk`  |
|   | All-in-one summary            | All four in parallel                                            | `GET /api/predictive/summary`         |

Query params:
- `horizon` — months to forecast (1..12, default 6). Used by inventory + appointments.
- `band` — comma-separated risk bands to keep in `/churn` (e.g. `high,critical`).

All endpoints require `Authorization: Bearer <token>` and an `admin` role.
401/403 otherwise.

## Files added

### Database
- `database/phase7_predictive.sql`
  - `predictive_cache` table (optional persistence)
  - Views: `v_pred_client_features`, `v_pred_monthly_service_demand`,
    `v_pred_inventory_usage_monthly`, `v_pred_appointment_density`,
    `v_pred_pet_risk_features`
  - RPCs: `fn_pred_demand_seasonality`, `fn_pred_appointment_density`
  - RLS policy for `predictive_cache` (admin-only)

### Backend (`backend/src/`)
- `services/predictive/engines.js` — pure-JS prediction engines (tree-classifier,
  linreg, seasonal index). No DB dependency, easy to unit-test.
- `services/predictiveService.js` — pulls features from Supabase, delegates to engines.
- `controllers/predictiveController.js` — HTTP layer.
- `routes/predictiveRoutes.js` — admin-only router mounted at `/api/predictive`.
- `index.js` — `predictiveRoutes` registered alongside `analyticsRoutes` and `diagnosticRoutes`.

### Frontend (`frontend/src/`)
- `services/predictiveService.js` — axios wrapper.
- `components/predictive/HorizonSelector.jsx` — 3/6/9/12-month chips.
- `components/predictive/RiskBadge.jsx` — risk-band pill.
- `pages/predictive/PredictiveAnalyticsPage.jsx` — dashboard shell + tab nav.
- `pages/predictive/ChurnPredictionTab.jsx`
- `pages/predictive/InventoryForecastTab.jsx`
- `pages/predictive/AppointmentForecastTab.jsx`
- `pages/predictive/TreatmentRiskTab.jsx`
- `App.jsx` — route `/predictive-analytics` (and alias `/predictions`).
- `components/dashboard/Sidebar.jsx` — admin nav link "Predictive".

## Run order

1. Apply migrations in order: `phase1` → `phase2` → `phase3` → `phase4_payments` → `phase5_analytics` → `phase6_diagnostic` → **`phase7_predictive`**.
2. Restart the backend (`npm run dev` in `backend/`). The boot log should include `/api/predictive` in the registered routes list.
3. Restart the frontend (`npm run dev` in `frontend/`). Sign in as an `admin`. The sidebar will show a "Predictive" entry.

## How the models work

### 1. Churn (decision-tree-style)
For every client, `v_pred_client_features` exposes inactivity, missed/cancelled
counts (lifetime + last 180 days), visit cadence (last 90 vs prior 90 days), and
spend deltas. The engine evaluates a fixed set of interpretable rules — each
rule has a weight that adds to (or subtracts from) the risk score. Output is
clamped to `[0,100]` and bucketed into `low / medium / high / critical`.
Every prediction carries the list of rules that fired so the dashboard can show
why each client is flagged.

### 2. Seasonal inventory forecast
For each medication: pull the per-month usage history, fit a linear regression
on time, compute a per-month-of-year seasonal index. Forecast = `trend × seasonal_multiplier`
clamped at zero. Risk is derived from `(stock_on_hand / avg_monthly_demand)`:
- `out_of_stock` = stock ≤ 0
- `below_reorder` = stock ≤ reorder_level
- `stockout_soon` = months-of-cover < 1
- `low` = months-of-cover < 2
- otherwise `ok`

The service tab uses the same seasonal-naive method on `v_pred_monthly_service_demand`
to surface peak months and trending services.

### 3. Appointment forecasting
- **Monthly**: linear regression across all months of appointment volume, multiplied
  by a month-of-year seasonal index from the last 12+ months.
- **Density**: rolling 365-day histogram of (day-of-week × hour) appointments.
  Cells in the top decile are flagged as "peaks" and rendered as a heatmap.

### 4. Treatment risk (rule-based)
Per-pet features include `visit_count`, `distinct_diagnoses`, `recurring_events`
(same diagnosis within 180 days), `followups_scheduled`, `age`, and `next_followup_date`.
Rules add weight for high recurrence, multiple distinct diagnoses, missing follow-ups,
senior age, and overdue follow-up dates. Output buckets:
`low / medium / high / critical`. Recurring diagnoses (top 12 by count) are
returned alongside.

## Testing the endpoints

```bash
# Authenticate first to grab a JWT (admin account), then:
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/predictive/churn
curl -H "Authorization: Bearer $TOKEN" "http://localhost:5000/api/predictive/inventory?horizon=6"
curl -H "Authorization: Bearer $TOKEN" "http://localhost:5000/api/predictive/appointments?horizon=12"
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/predictive/treatment-risk
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/predictive/summary
```

Each returns `{ success: true, data: {...} }` on success, `{ success: false, error: "..." }` otherwise.

## Sanity checks the engine performs

- Linear regression returns `{ slope: 0, intercept: mean }` for < 2 data points
  so single-month histories don't blow up.
- All percentages use a `pct(n, d)` helper that returns 0 when `d` is falsy.
- All forecast values are clamped to be ≥ 0 (no negative demand).
- Risk scores are clamped to `[0, 100]` before bucketing.

## Extending

To add a new prediction module:
1. Add a view or RPC in `database/phase7_predictive.sql` (or a new phase).
2. Add an engine function in `backend/src/services/predictive/engines.js`.
3. Add a service function in `backend/src/services/predictiveService.js`.
4. Add a controller method + route entry.
5. Add a tab file in `frontend/src/pages/predictive/` and register it in `PredictiveAnalyticsPage.jsx`.
