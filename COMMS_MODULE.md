# Direct Support & Communication Channels — Integration Guide

Phase 13 of VETLINK adds two-way secure messaging, file/media attachments, and
embedded video consultations (Jitsi Meet). All chat is realtime via Supabase
Realtime; video uses an iframe embed of meet.jit.si — no signaling server or
SDK keys required.

---

## 1. Database — `database/phase13_comms.sql`

Apply the migration once in Supabase SQL Editor. It is idempotent and safe to
re-run.

It creates:

- **Enums** — `message_kind` (`text`/`image`/`video`/`file`/`system`),
  `consult_status` (`scheduled`/`waiting`/`in_progress`/`completed`/
  `cancelled`/`no_show`).
- **Tables**
  - `conversations` — one row per client thread. Tracks `last_message_at`,
    `last_message_preview`, `unread_for_client`, `unread_for_staff`.
  - `conversation_participants` — staff who can read/reply.
  - `messages` — chat messages with optional `pet_id`, `appointment_id`,
    `reply_to_id`. Soft-deletable via `is_deleted`.
  - `message_attachments` — `kind`, `mime_type`, `width`, `height`,
    `duration_sec` (for media), `size_bytes`, `storage_path`.
  - `video_consultations` — `room_name`, `jitsi_base_url`, `subject`,
    `status`, `scheduled_at`, `started_at`, `ended_at`, `duration_sec`.
  - `consultation_notes` — SOAP-shaped notes per consultation.
- **View** `v_conversation_list` — joins client info onto conversations for
  the inbox list.
- **Trigger** `bump_conversation_on_message` — updates the conversation's
  preview + unread counters on every new message.
- **Function** `get_or_create_conversation(p_client UUID)` — used by the
  backend to lazily create a thread the first time a client sends.
- **RLS policies** — staff see everything; clients see only their own
  thread, their own messages, their own attachments, their own consults.
- **Storage bucket** `chat-files` (private) with policies for signed-URL
  reads. 50 MB max per file; MIME allowlist enforced in the backend.
- **Realtime publication** — `messages`, `message_attachments`,
  `video_consultations`, `conversations` added to `supabase_realtime`.

After running the migration, reload PostgREST:

```sql
NOTIFY pgrst, 'reload schema';
```

---

## 2. Backend

### Files added

```
backend/src/services/commsService.js
backend/src/controllers/commsController.js
backend/src/validations/commsValidation.js
backend/src/routes/commsRoutes.js
```

### Wiring

`backend/src/index.js` lazily registers the routes (already done):

```js
let commsRoutes; try { commsRoutes = require('./routes/commsRoutes'); } catch (_) {}
// ...
if (commsRoutes) app.use('/api/comms', commsRoutes);
```

### REST surface

| Method | Path                                         | Purpose                          |
|--------|----------------------------------------------|----------------------------------|
| GET    | `/api/comms/conversations`                   | Inbox list (staff = all, client = own) |
| GET    | `/api/comms/conversations/:id`               | Conversation + last 50 messages |
| POST   | `/api/comms/conversations/:id/read`          | Mark thread as read              |
| POST   | `/api/comms/messages`                        | Send a text/system message       |
| DELETE | `/api/comms/messages/:id`                    | Soft-delete a message            |
| POST   | `/api/comms/attachments` (multipart)         | Upload image/video/file (≤ 50 MB)|
| GET    | `/api/comms/attachments/:id/url`             | Signed URL (10-min TTL)          |
| GET    | `/api/comms/consultations`                   | List consults (filter by status, days) |
| GET    | `/api/comms/consultations/:id`               | Consult + notes                  |
| POST   | `/api/comms/consultations`                   | Create consult (vet/admin)       |
| POST   | `/api/comms/consultations/:id/join`          | Returns `meeting_url` + transitions status |
| POST   | `/api/comms/consultations/:id/end`           | Closes the call, records duration |
| PUT    | `/api/comms/consultations/:id/notes`         | Upsert SOAP notes (vet/admin)    |

Notes:
- Room name format: `vetlink-<10-byte-hex>` to keep URLs unguessable.
- `join` transitions: client first → `waiting`; vet first → `waiting`;
  both present → `in_progress` and stamps `started_at`.
- `end` stamps `ended_at`, computes `duration_sec`, and flips to `completed`.

---

## 3. Frontend

### Files added

```
frontend/src/services/commsService.js
frontend/src/hooks/useConversation.js
frontend/src/components/comms/MessageBubble.jsx
frontend/src/components/comms/ChatComposer.jsx
frontend/src/components/comms/ConversationList.jsx
frontend/src/components/comms/JitsiEmbed.jsx
frontend/src/components/comms/ConsultationNotesEditor.jsx
frontend/src/pages/comms/ClientMessagesPage.jsx
frontend/src/pages/comms/StaffMessagesPage.jsx
frontend/src/pages/comms/TelehealthPage.jsx
frontend/src/pages/comms/ConsultationsListPage.jsx
```

### Routes added (`frontend/src/App.jsx`)

| Path                       | Roles                          | Page                       |
|----------------------------|--------------------------------|----------------------------|
| `/messages`                | admin, veterinarian, staff     | `StaffMessagesPage`        |
| `/telehealth`              | admin, veterinarian, staff     | `ConsultationsListPage`    |
| `/telehealth/:id`          | any authenticated              | `TelehealthPage`           |
| `/client/messages`         | client                         | `ClientMessagesPage`       |
| `/client/telehealth`       | client                         | `ConsultationsListPage`    |

### Sidebar entries

- Staff sidebar (admin/vet/staff): **Messages** → `/messages`,
  **Telehealth** → `/telehealth`.
- Client sidebar: **Messages** → `/client/messages`,
  **Video Consults** → `/client/telehealth`.

### Realtime hook

`useConversation(conversationId)` opens a Supabase channel
`conv:<id>` that listens for:

- `INSERT` on `messages` (filtered by `conversation_id`) — appends new bubbles.
- `INSERT` on `message_attachments` — re-attaches uploads to the parent message.
- `UPDATE` on `messages` — surfaces soft-deletes (rows with `is_deleted=true`
  are filtered out).

The hook auto-marks the thread as read on load and on every incoming message.

### Video embed

`JitsiEmbed` is a thin iframe wrapper around `meet.jit.si`. The backend
returns the full meeting URL (`<jitsi_base_url>/<room_name>`); the component
appends `userInfo.displayName` and a few sensible config defaults via the
URL hash so no SDK is required.

```jsx
<JitsiEmbed
  url={meetingUrl}
  displayName={user.name}
  subject="Follow-up exam"
  onClose={end}
/>
```

### Notes editor

`ConsultationNotesEditor` exposes a SOAP form
(Subjective / Objective / Assessment / Plan / Follow-up / Private notes)
and writes to `PUT /api/comms/consultations/:id/notes`. Vets and admins
get this side-by-side with the live video on `TelehealthPage`.

---

## 4. Smoke test

1. **Login as a client** → click **Messages** → type "hi" → send.
   Expect a row created in `conversations` and a bubble in your view.
2. **Login as staff** in another browser → click **Messages** → the new
   thread should appear in the inbox with an unread badge. Open it; the
   message should be visible in realtime.
3. From staff, send a reply with a photo attachment (paperclip → pick).
   The client view should show the bubble + inline preview within a second.
4. Staff side: open the existing **Pre-visit Review** or any vet flow to
   POST a new consult, or use `POST /api/comms/consultations` directly.
   Then both sides hit **Telehealth → \<the row\>** → both should land in
   the Jitsi room.
5. After ending the call, the vet's notes form auto-loads alongside the
   "Consultation ended" panel.

---

## 5. Env vars

The module reuses the existing Supabase + service-role + nodemailer env vars.
No new keys required for Jitsi unless you host your own bridge — in which
case override `jitsi_base_url` per consultation when creating it (defaults
to `https://meet.jit.si`).
