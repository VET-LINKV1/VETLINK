/**
 * mockData.js — dashboard data contract
 *
 * The dashboard now runs on REAL data from the backend. `dashboardApi`
 * calls GET /api/dashboard/overview (one aggregate payload) and the
 * `unwrap()` helper splits it into the per-section shapes the components
 * expect. The resolved-data shapes below are the contract — keep them
 * stable so the 12 section components don't need to change.
 *
 * To fall back to synthetic data (e.g. offline), flip USE_MOCK below.
 */

import apiClient from '../../../services/apiClient';

const USE_MOCK = false; // set true to serve local synthetic data instead of live DB

/* ───────────────────────── Branches / clinic selector ─────────────────────── */
export const BRANCHES = [
  { id: 'main', name: 'PHVC — Mandaluyong (Main)', code: 'MNL' },
  { id: 'qc', name: 'PHVC — Quezon City', code: 'QCY' },
  { id: 'mkt', name: 'PHVC — Makati', code: 'MKT' },
];

/* ───────────────────────── Admin identity ─────────────────────────────────── */
export const ADMIN = {
  name: 'Maria Santos',
  role: 'Clinic Operations Lead',
  email: 'maria.santos@phvc.vet',
  initials: 'MS',
  avatarColor: 'bg-blue-600',
};

// Status → visual tone (shared by Today's Appointments + others).
export const STATUS = {
  Confirmed: { tone: 'blue', dot: '#0ea5e9' },
  'Checked-In': { tone: 'indigo', dot: '#6366f1' },
  'In Consultation': { tone: 'amber', dot: '#f59e0b' },
  Completed: { tone: 'emerald', dot: '#10b981' },
  Cancelled: { tone: 'red', dot: '#ef4444' },
  'No-Show': { tone: 'slate', dot: '#94a3b8' },
};

function unwrap(res) {
  const body = res?.data || res;
  if (body && body.success && body.data !== undefined) return body.data;
  if (body && body.data !== undefined) return body.data;
  return body;
}

// Local synthetic fallback (used only when USE_MOCK === true).
const MOCK = {
  kpis: {
    todaysAppointments: 34, totalActivePets: 1284, registeredOwners: 942, activeVets: 6,
    todaysRevenue: 48250, pendingLabResults: 12, refillRequests: 8, pendingActions: 5,
    deltas: { todaysAppointments: 12.5, totalActivePets: 3.1, registeredOwners: 1.8, activeVets: 0, todaysRevenue: 8.4, pendingLabResults: -9.0, refillRequests: 14.0, pendingActions: -20.0 },
  },
  appointments: [
    { id: 'A-2041', time: '08:30', pet: 'Bella', species: 'Dog', owner: 'Ana Reyes', vet: 'Dr. Cruz', type: 'Wellness Exam', room: 'Main', status: 'Completed' },
    { id: 'A-2042', time: '08:45', pet: 'Max', species: 'Dog', owner: 'Luis Gomez', vet: 'Dr. Tan', type: 'Vaccination', room: 'Main', status: 'Completed' },
    { id: 'A-2043', time: '09:00', pet: 'Luna', species: 'Cat', owner: 'Mara Diaz', vet: 'Dr. Cruz', type: 'Dental Cleaning', room: 'Main', status: 'In Consultation' },
    { id: 'A-2044', time: '09:15', pet: 'Rocky', species: 'Dog', owner: 'Pedro Cruz', vet: 'Dr. Lim', type: 'Sick Visit', room: 'Main', status: 'Checked-In' },
    { id: 'A-2045', time: '09:30', pet: 'Coco', species: 'Dog', owner: 'Jane Lao', vet: 'Dr. Tan', type: 'Wellness Exam', room: 'Main', status: 'Confirmed' },
    { id: 'A-2051', time: '11:00', pet: 'Thor', species: 'Dog', owner: 'Ben Cruz', vet: 'Dr. Lim', type: 'Sick Visit', room: 'Main', status: 'Cancelled' },
    { id: 'A-2048', time: '10:15', pet: 'Panda', species: 'Cat', owner: 'Tom Santos', vet: 'Dr. Cruz', type: 'Vaccination', room: 'Main', status: 'No-Show' },
  ],
  actions: [
    { id: 'ACT-1', kind: 'overdue', title: 'Overdue appointment follow-up', detail: 'Missed 2 reminders', severity: 'high', action: 'Contact owner', to: '/appointments' },
    { id: 'ACT-2', kind: 'lab', title: '12 pending laboratory results', detail: '3 flagged urgent', severity: 'high', action: 'Review labs', to: '/pharmacy' },
    { id: 'ACT-3', kind: 'refill', title: '8 prescription refill requests', detail: '5 awaiting approval', severity: 'medium', action: 'Open queue', to: '/pharmacy' },
    { id: 'ACT-4', kind: 'invoice', title: '5 unpaid invoices', detail: '₱6,420 outstanding', severity: 'medium', action: 'Send reminders', to: '/billing' },
    { id: 'ACT-5', kind: 'no-show', title: '1 no-show this morning', detail: 'Slot automatically freed', severity: 'low', action: 'Mark resolved', to: '/appointments' },
  ],
  trends: {
    '7 Days': ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d, i) => ({ label: d, completed: 28 + i, cancelled: 3, rescheduled: 2, noShow: 1 + (i % 2) })),
    '30 Days': Array.from({ length: 30 }, (_, i) => ({ label: `D${i + 1}`, completed: 30, cancelled: 3, rescheduled: 2, noShow: 1 })),
    '3 Months': Array.from({ length: 12 }, (_, i) => ({ label: `Wk ${i + 1}`, completed: 190, cancelled: 40, rescheduled: 24, noShow: 12 })),
    '6 Months': ['Jan','Feb','Mar','Apr','May','Jun'].map((m) => ({ label: m, completed: 820, cancelled: 120, rescheduled: 60, noShow: 40 })),
    '1 Year': ['Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun'].map((m) => ({ label: m, completed: 760, cancelled: 110, rescheduled: 55, noShow: 38 })),
  },
  revenue: {
    today: 48250, monthly: 1184300, outstanding: 64200, refunds: 8750,
    trend: ['Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun'].map((m, i) => ({ label: m, value: [982,1041,997,1120,1188,1345,1012,1066,1104,1150,1172,1184][i] })),
  },
  vets: [
    { id: 'v1', name: 'Dr. Elena Cruz', status: 'In Consultation', appointments: 7, nextFree: '10:45' },
    { id: 'v2', name: 'Dr. Raphael Tan', status: 'Available', appointments: 5, nextFree: 'Now' },
    { id: 'v3', name: 'Dr. Sofia Lim', status: 'In Consultation', appointments: 6, nextFree: '11:30' },
    { id: 'v4', name: 'Dr. Marco Bautista', status: 'Off Duty', appointments: 0, nextFree: '—' },
  ],
  lab: { pending: 12, processing: 7, readyForReview: 5, reviewed: 41 },
  prescriptions: { new: 8, underReview: 5, approved: 14, rejected: 2 },
  capacity: {
    totalRooms: 5, available: 3, occupied: 2, utilization: 40,
    branches: [
      { id: 'exam', name: 'Exam Rooms', rooms: 2, available: 1, utilization: 50 },
      { id: 'surgery', name: 'Surgery Suite', rooms: 1, available: 1, utilization: 0 },
      { id: 'isolation', name: 'Isolation Room', rooms: 1, available: 1, utilization: 0 },
      { id: 'dental', name: 'Dental Bay', rooms: 1, available: 0, utilization: 100 },
    ],
  },
  activity: [
    { id: 'ac1', type: 'owner', text: 'New pet owner registered', who: 'Jane Lao', meta: 'Coco · Shih Tzu', time: '2 min ago' },
    { id: 'ac2', type: 'pet', text: 'New pet added to record', who: 'Boomer', meta: 'Golden Retriever', time: '18 min ago' },
    { id: 'ac3', type: 'appointment', text: 'Appointment completed', who: 'Luna', meta: 'Dental Cleaning', time: '34 min ago' },
    { id: 'ac4', type: 'payment', text: 'Payment received', who: '₱2,400', meta: 'Wellness Exam', time: '41 min ago' },
    { id: 'ac5', type: 'refill', text: 'Refill request submitted', who: 'Shadow', meta: 'Gabapentin', time: '1 hr ago' },
  ],
  system: [
    { id: 'db', label: 'Database', status: 'operational', detail: 'Primary healthy', latencyMs: 12 },
    { id: 'api', label: 'API Gateway', status: 'operational', detail: 'All routes 200', latencyMs: 38 },
    { id: 'sms', label: 'SMS Notifications', status: 'operational', detail: 'Provider connected', latencyMs: 0 },
    { id: 'pay', label: 'Payment Gateway', status: 'operational', detail: 'PayMongo connected', latencyMs: 210 },
    { id: 'email', label: 'Email Service', status: 'operational', detail: 'SMTP configured', latencyMs: 95 },
    { id: 'backup', label: 'Latest Backup', status: 'ok', detail: 'Snapshots enabled', latencyMs: 0 },
  ],
};

// Cache the single overview call so the 12 sections don't each hit the API.
// Trends depend on the selected period, so we refetch when it changes.
let _overviewPromise = null;
let _overviewPeriod = null;
function getOverview(period) {
  if (USE_MOCK) return Promise.resolve(MOCK);
  if (_overviewPromise && period === _overviewPeriod) return _overviewPromise;
  _overviewPeriod = period;
  _overviewPromise = apiClient
    .get('/dashboard/overview', period ? { params: { period } } : undefined)
    .then(unwrap)
    .catch((e) => {
      _overviewPromise = null;
      _overviewPeriod = null;
      throw e;
    });
  return _overviewPromise;
}

/* ───────────────────────── Loaders ────────────────────────────────────────── */
export const dashboardApi = {
  getKpis: async () => (await getOverview()).kpis,
  getAppointments: async () => (await getOverview()).appointments,
  getActions: async () => (await getOverview()).actions,
  getTrends: async (period) => {
    const ov = await getOverview(period);
    // Backend returns the trend for the requested period; if it doesn't match
    // (e.g. period changed), refetch.
    return ov.trends;
  },
  getRevenue: async () => (await getOverview()).revenue,
  getVets: async () => (await getOverview()).vets,
  getLab: async () => (await getOverview()).lab,
  getPrescriptions: async () => (await getOverview()).prescriptions,
  getCapacity: async () => (await getOverview()).capacity,
  getActivity: async () => (await getOverview()).activity,
  getSystem: async () => (await getOverview()).system,
};
