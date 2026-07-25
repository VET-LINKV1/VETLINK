# 🐾 VETLINK — Veterinary Management System

> Phase 1 (15%): Authentication + Role-based Dashboard

---

## 📁 Project Structure

```
vetlink/
├── backend/                    # Node.js + Express API
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.js          # Environment config + validation
│   │   │   └── supabase.js     # Supabase client (anon + admin)
│   │   ├── controllers/
│   │   │   └── authController.js   # Request handlers
│   │   ├── services/
│   │   │   └── authService.js      # Business logic
│   │   ├── routes/
│   │   │   └── authRoutes.js       # Route definitions
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js   # JWT verification
│   │   │   ├── roleMiddleware.js   # RBAC enforcement
│   │   │   └── validateMiddleware.js # Joi input validation
│   │   └── index.js            # Express app + server
│   ├── .env.example
│   └── package.json
│
├── frontend/                   # React + Tailwind + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── dashboard/
│   │   │   │   ├── AdminDashboard.jsx
│   │   │   │   ├── VetDashboard.jsx
│   │   │   │   ├── StaffDashboard.jsx
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   └── Topbar.jsx
│   │   │   └── ui/
│   │   │       ├── StatCard.jsx
│   │   │       ├── SectionCard.jsx
│   │   │       ├── ComingSoonBadge.jsx
│   │   │       └── LoadingScreen.jsx
│   │   ├── layouts/
│   │   │   └── DashboardLayout.jsx
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   └── DashboardPage.jsx
│   │   ├── hooks/
│   │   │   └── useAuth.js
│   │   ├── services/
│   │   │   ├── supabaseClient.js
│   │   │   ├── apiClient.js    # Axios with JWT interceptors
│   │   │   └── authService.js
│   │   ├── store/
│   │   │   └── authStore.js    # Zustand global state
│   │   ├── components/
│   │   │   └── ProtectedRoute.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── .env.example
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
└── database/
    ├── schema.sql              # PostgreSQL schema
    ├── seed.sql                # SQL seed instructions
    └── seed.js                 # Node.js auto-seeder
```

---

## 🚀 Local Setup

### Prerequisites
- Node.js ≥ 18
- A Supabase project (free tier works)

### 1. Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `database/schema.sql`
3. Copy your credentials from **Settings → API**

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Fill in .env with your Supabase credentials
npm install
npm run dev         # Starts on http://localhost:5000
```

### 3. Frontend Setup

```bash
cd frontend
cp .env.example .env
# Fill in .env with your Supabase credentials
npm install
npm run dev         # Starts on http://localhost:5173
```

### 4. Seed Demo Users

```bash
# From project root
cd database
node seed.js
```

This creates:
| Email | Password | Role |
|-------|----------|------|
| admin@vetlink.dev | demo1234 | Admin |
| vet@vetlink.dev | demo1234 | Veterinarian |
| staff@vetlink.dev | demo1234 | Staff |

---

## 🔑 Environment Variables

### Backend `.env`
```env
PORT=5000
NODE_ENV=development
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=your-jwt-secret   # Settings → API → JWT Settings
FRONTEND_URL=http://localhost:5173
```

### Frontend `.env`
```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=http://localhost:5000/api
```

---

## 📡 API Reference

### POST `/api/auth/login`
```json
// Request
{ "email": "admin@vetlink.dev", "password": "demo1234" }

// Response 200
{
  "success": true,
  "data": {
    "session": {
      "accessToken": "eyJ...",
      "refreshToken": "...",
      "expiresAt": 1234567890
    },
    "user": {
      "id": "uuid",
      "email": "admin@vetlink.dev",
      "name": "Admin User",
      "role": "admin",
      "created_at": "2024-01-01T00:00:00Z"
    }
  }
}

// Response 401
{ "success": false, "error": "Invalid email or password" }
```

### GET `/api/auth/me`
```
Authorization: Bearer <accessToken>
```
```json
// Response 200
{
  "success": true,
  "data": {
    "user": { "id": "...", "email": "...", "name": "...", "role": "..." }
  }
}
```

### POST `/api/auth/logout`
```
Authorization: Bearer <accessToken>
```
```json
// Response 200
{ "success": true, "message": "Logged out successfully" }
```

### GET `/health`
```json
{ "success": true, "service": "VETLINK API", "version": "1.0.0" }
```

---

## 🛡️ Security Features

- **Helmet.js** — HTTP security headers
- **Rate limiting** — 100 req/15min global; 10 login attempts/15min
- **Joi validation** — Input sanitization on all endpoints
- **JWT verification** — Server-side Supabase JWT validation
- **RBAC** — Role middleware protects routes
- **RLS** — Row Level Security on Supabase tables
- **CORS** — Restricted to frontend URL
- **No secrets in code** — All via environment variables

---

## 🏗️ Architecture Decisions

| Decision | Choice | Reason |
|---|---|---|
| Auth | Supabase Auth | Handles JWT, refresh, MFA-ready |
| State | Zustand | Lightweight, no boilerplate |
| Validation | Joi | Schema-based, production-grade |
| HTTP client | Axios | Interceptors for token injection |
| Styling | Tailwind CSS | Utility-first, no CSS files |
| Admin client | Service Role Key | Bypasses RLS safely on server |

---

## 🗺️ Roadmap

| Phase | Features |
|-------|----------|
| ✅ **Phase 1 (current)** | Auth, RBAC, Role dashboards |
| 🔜 Phase 2 | Pet profiles, Owner management |
| 🔜 Phase 3 | Appointment scheduling + conflict prevention |
| 🔜 Phase 4 | Medical records + prescriptions |
| 🔜 Phase 5 | Notifications, reminders (email/SMS) |
| 🔜 Phase 6 | Analytics + reports |

---

## ☁️ Deployment

### Frontend → Vercel
```bash
cd frontend
vercel --prod
# Set env vars in Vercel dashboard
```

### Backend → Railway / Render / Supabase Edge Functions
```bash
# Set all .env vars in your platform dashboard
# Build: npm start
```

### Supabase (Database)
- Schema and RLS are already configured in your Supabase project
- Enable **Email Auth** in Authentication settings
