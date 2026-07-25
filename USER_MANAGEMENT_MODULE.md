# Admin User Management — Integration Guide

Phase 14 of VETLINK adds an admin-only User Management screen. From a single
page an admin can search, filter, create, edit, suspend, reactivate, verify,
reset passwords for, bulk-import, and delete users across all roles
(admin / veterinarian / staff / client). Every mutating action is recorded
to a tamper-resistant audit log.

---

## 1. Database — `database/phase14_user_mgmt.sql`

Run once in the Supabase SQL Editor. Idempotent.

Adds:

- **Enum** `admin_action_kind` — `create_user`, `update_user`, `change_role`,
  `suspend`, `reactivate`, `delete_user`, `reset_password`, `send_invite`,
  `verify_user`, `bulk_import`.
- **Table** `admin_audit_log(id, actor_id, target_id, action, summary,
  before_json, after_json, meta, ip, user_agent, created_at)`.
- **Indexes** on `users` for fast search (lower(email), lower(name), role,
  is_active).
- **Function** `is_admin(uid)` — `SECURITY DEFINER` helper.
- **Function** `log_admin_action(...)` — convenience SP for inserting audit rows.
- **View** `v_user_last_action` — most-recent audit row per user.
- **RLS** on `admin_audit_log` — only admins can `SELECT`; backend writes via
  the service role and bypasses RLS.

Then reload PostgREST:

```sql
NOTIFY pgrst, 'reload schema';
```

---

## 2. Backend

### Files added

```
backend/src/services/userManagementService.js
backend/src/controllers/userManagementController.js
backend/src/validations/userManagementValidation.js
backend/src/routes/userManagementRoutes.js
```

### Wiring (already done in `index.js`)

```js
let userMgmtRoutes; try { userMgmtRoutes = require('./routes/userManagementRoutes'); } catch (_) {}
// ...
if (userMgmtRoutes) app.use('/api/admin/users', userMgmtRoutes);
```

Mounted **before** the broader `/api/admin` so the specific prefix wins.

### REST surface (all routes admin-only)

| Method | Path                                               | Purpose                              |
|--------|----------------------------------------------------|--------------------------------------|
| GET    | `/api/admin/users`                                 | List + search + filter + paginate    |
| POST   | `/api/admin/users`                                 | Create user (+ optional invite link) |
| GET    | `/api/admin/users/audit`                           | List recent admin actions            |
| GET    | `/api/admin/users/:id`                             | Get one user                         |
| GET    | `/api/admin/users/:id/activity`                    | Pets + appointments + messages + audit |
| PATCH  | `/api/admin/users/:id`                             | Update profile / change role         |
| DELETE | `/api/admin/users/:id`                             | Hard delete (Supabase Auth + profile)|
| POST   | `/api/admin/users/:id/suspend`                     | `is_active = false`, sign user out   |
| POST   | `/api/admin/users/:id/reactivate`                  | `is_active = true`                   |
| POST   | `/api/admin/users/:id/verify`                      | `is_verified = true`                 |
| POST   | `/api/admin/users/:id/reset-password`              | Generate a recovery link (returned)  |
| POST   | `/api/admin/users/bulk-import`                     | Bulk create from JSON rows           |

Notes:
- All mutations write an `admin_audit_log` row with `before_json` / `after_json`.
- Admin cannot delete their own account (server **and** UI enforced).
- Suspending forces sign-out via `supabaseAdmin.auth.admin.signOut(uid)`.
- Creating a vet/staff also upserts a `staff_profiles` row.

---

## 3. Frontend

### Files added

```
frontend/src/services/userManagementService.js
frontend/src/pages/admin/UserManagementPage.jsx
frontend/src/components/admin/users/UserTable.jsx
frontend/src/components/admin/users/UserFormDialog.jsx
frontend/src/components/admin/users/UserActivityDrawer.jsx
frontend/src/components/admin/users/CsvImportDialog.jsx
frontend/src/components/admin/users/AuditLogDrawer.jsx
```

### Routing (`frontend/src/App.jsx`)

| Path             | Roles  | Page                  |
|------------------|--------|-----------------------|
| `/admin/users`   | admin  | `UserManagementPage`  |
| `/users`         | admin  | redirect to above     |

### Sidebar

The previously-disabled **"User Management"** item in the admin sidebar is
now active and points to `/admin/users`.

### UI layout

- **Stat cards** — total users, active on current page, staff on page,
  clients on page.
- **Toolbar** — debounced search by name/email/phone, role filter, status
  filter (all / active / suspended), refresh.
- **Table** — sortable columns (name, role, status, joined). Row actions:
  view activity, edit, reset password, mark verified, suspend/reactivate,
  delete.
- **Create dialog** — surfaces an invite link the admin can copy after
  creation (so they can hand it to the user out-of-band if email isn't
  configured).
- **Edit dialog** — same form as create but with `PATCH` semantics and the
  ability to change role.
- **Activity drawer** — per-user pets, recent appointments, recent messages,
  per-user audit trail.
- **CSV import dialog** — paste or upload a CSV; rows parsed client-side,
  POSTed in one request, success/failure summary shown row-by-row.
- **Audit log drawer** — last 150 admin actions across the system with
  actor + target + relative timestamps.

### CSV template

```
email,name,role,phone_number,license_number,specialization,position,department
jane@clinic.com,Jane Doe,veterinarian,+639170000001,V-123,Surgery,,Clinical
carl@clinic.com,Carl Reyes,staff,+639170000002,,,assistant,Reception
owner@example.com,Owner Name,client,+639170000003,,,,
```

---

## 4. Smoke test

1. Sign in as the admin (`admin@phvc.com`).
2. Open the sidebar → **User Management**.
3. Click **+ New user** → enter email/name/role → save. Copy the invite
   link from the green banner.
4. In an incognito window, paste the link → set a password → sign in as
   that new user. Confirm role-appropriate routing.
5. Back in the admin window: search for the new user, click **Activity**,
   confirm the audit entry shows up.
6. Hit the row's **⋯ → Suspend**; reload — the row badge flips to
   "Suspended". Trying to sign in as that user should now fail.
7. **⋯ → Reactivate** → user can sign in again.
8. Click **Audit log** in the toolbar — every action you took should be
   listed in reverse chronological order.
9. Click **Import CSV** → **Load template** → **Import (3)**. Confirm the
   three rows appear in the table with the badges you expect.
10. Try **Delete user** on the seeded test row to verify the auth + profile
    are both removed.

---

## 5. Env vars

No new env vars required. The service-role Supabase key (already used
across the backend) is reused for the Auth admin API calls.

---

## 6. Caveats

- **Email delivery**: `generateLink` returns a `recovery` link directly so
  the admin can copy/paste it. If you want Supabase to email it
  automatically, switch the call to `inviteUserByEmail` (and configure
  the SMTP redirect URL in the Supabase project settings).
- **Hard delete**: `DELETE /:id` removes the Supabase auth user, which
  cascades to `public.users` and all dependent rows declared with
  `ON DELETE CASCADE`. Use **Suspend** for reversible actions.
- **Audit log retention**: there is no auto-purge; add a periodic
  cleanup if the table grows large.
