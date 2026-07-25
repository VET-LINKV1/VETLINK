import axios from 'axios';

// Default to a relative '/api' so the request stays on the same origin the
// browser loaded from. In dev, Vite proxies '/api' → http://localhost:5000.
// In production behind a reverse proxy, the API mounts at /api as well.
// This also means a phone on the LAN that loads http://<laptop-ip>:5173
// will correctly call http://<laptop-ip>:5173/api/... (no localhost-baking).
// You can still override via VITE_API_URL if you really need an absolute URL.
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
});

function getToken() {
  try {
    const stored = localStorage.getItem('vetlink_auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      const token = parsed?.state?.accessToken || parsed?.accessToken;
      if (token) return token;
    }
  } catch (_) {}
  return null;
}

const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/verify-otp',
  '/client/register',
  '/staff/register',
  '/staff/verify-otp',
  '/staff/resend-otp',
];
const isPublic = (url = '') => PUBLIC_PATHS.some((p) => url.includes(p));

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (!isPublic(config.url)) {
    console.warn('[API] No token for protected request:', config.method?.toUpperCase(), config.url);
  }
  console.debug('[API] →', config.method?.toUpperCase(), config.url);
  return config;
});

// Track recent 401s. If we see one right after a successful login, swallow
// it once instead of immediately killing the session — backend may have
// taken a moment to recognize the new token, or the dashboard fired
// requests before the token landed in localStorage.
let _redirecting = false;
let _consecutive401 = 0;
let _last401At = 0;

function forceLogoutAndRedirect() {
  if (_redirecting) return;
  _redirecting = true;
  console.warn('[API] Token invalid — clearing session and redirecting to /login');
  try { localStorage.removeItem('vetlink_auth'); } catch (_) {}
  try { localStorage.removeItem('vetlink_supabase'); } catch (_) {}
  if (window.location.pathname !== '/login') {
    setTimeout(() => { window.location.href = '/login'; }, 50);
  }
}

apiClient.interceptors.response.use(
  (res) => {
    // Clear the 401 counter on any successful response — we're healthy
    _consecutive401 = 0;
    console.debug('[API] ←', res.status, res.config.method?.toUpperCase(), res.config.url);
    return res;
  },
  (err) => {
    const url = err.config?.url || '';
    const status = err.response?.status;
    const message = err.response?.data?.error || err.message;
    console.warn('[API] ✖', status || 'NETWORK', err.config?.method?.toUpperCase(), url, '—', message);

    if (status === 401 && !url.includes('/auth/login') && !isPublic(url)) {
      const now = Date.now();
      // Reset counter if last 401 was a while ago — these are independent errors
      if (now - _last401At > 5000) _consecutive401 = 0;
      _consecutive401 += 1;
      _last401At = now;

      // Only force-redirect after 2 consecutive 401s within 5s.
      // A single transient 401 right after login is tolerable; a wall of
      // them means the token is genuinely dead.
      if (_consecutive401 >= 2) {
        forceLogoutAndRedirect();
      } else {
        console.warn('[API] First 401 — tolerating once before forcing logout');
      }
    }

    return Promise.reject(err);
  }
);

export default apiClient;
