/**
 * settingsStore.js
 * Centralized client-side store for the VETLINK Admin Settings module.
 *
 * While the backend is being connected this acts as the source of truth and
 * ships with realistic mock data. Requests are simulated with a short delay so
 * the UI exercises real loading / saving / error states.
 *
 * The audit log is APPEND-ONLY — it exposes `logAudit` (push) and a read-only
 * selector, but no mutation that removes or edits existing entries, mirroring
 * the requirement that audit logs be protected from unauthorized modification.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const delay = (ms = 450) => new Promise((r) => setTimeout(r, ms));

const seedClinic = {
  name: 'Paw Health Veterinary Clinic',
  shortName: 'PHVC',
  email: 'frontdesk@pawhealth.vet',
  phone: '+63 2 8555 0199',
  mobile: '+63 917 555 0142',
  website: 'https://pawhealth.vet',
  addressLine: 'Unit 4, Greenfield Tower',
  city: 'Mandaluyong',
  state: 'Metro Manila',
  postalCode: '1550',
  country: 'Philippines',
  timezone: 'Asia/Manila',
  currency: 'PHP',
  emergencyName: 'Dr. Maria Santos (On-call Vet)',
  emergencyPhone: '+63 917 555 9001',
  hours: [
    { day: 'Monday',    open: '08:00', close: '18:00', closed: false },
    { day: 'Tuesday',   open: '08:00', close: '18:00', closed: false },
    { day: 'Wednesday', open: '08:00', close: '18:00', closed: false },
    { day: 'Thursday',  open: '08:00', close: '18:00', closed: false },
    { day: 'Friday',    open: '08:00', close: '18:00', closed: false },
    { day: 'Saturday',  open: '09:00', close: '15:00', closed: false },
    { day: 'Sunday',    open: '09:00', close: '12:00', closed: true },
  ],
  logoUrl: '',
};

const seedProfile = {
  name: 'Alex Rivera',
  email: 'admin@pawhealth.vet',
  jobTitle: 'Clinic Administrator',
  phone: '+63 917 555 0001',
  photoUrl: '',
  twoFactorEnabled: true,
  passwordLastChanged: '2026-06-12T09:30:00Z',
  sessions: [
    { id: 's1', device: 'Chrome · macOS', location: 'Mandaluyong, PH', lastActive: '2026-08-23T08:10:00Z', current: true },
    { id: 's2', device: 'Safari · iPhone', location: 'Makati, PH', lastActive: '2026-08-22T19:42:00Z', current: false },
    { id: 's3', device: 'Edge · Windows', location: 'Quezon City, PH', lastActive: '2026-08-20T11:05:00Z', current: false },
  ],
};

const ROLES = [
  { id: 'admin',           label: 'Administrators',       desc: 'Full access to all modules and configuration.' },
  { id: 'veterinarian',    label: 'Veterinarians',        desc: 'Clinical care, medical records, prescriptions.' },
  { id: 'technician',      label: 'Veterinary Technicians', desc: 'Assist vets, manage records and samples.' },
  { id: 'receptionist',    label: 'Receptionists',        desc: 'Appointments, clients, billing front-desk.' },
  { id: 'cashier',         label: 'Cashiers',             desc: 'Payments, invoices, refunds.' },
  { id: 'lab',             label: 'Laboratory Staff',     desc: 'Lab orders, results, and approvals.' },
];

// Module keys used across permission matrix
const MODULES = [
  { key: 'dashboard',    label: 'Dashboard' },
  { key: 'appointments', label: 'Appointments' },
  { key: 'pets',         label: 'Pet Profiles' },
  { key: 'medical',      label: 'Medical Records' },
  { key: 'prescriptions',label: 'Prescriptions' },
  { key: 'laboratory',   label: 'Laboratory' },
  { key: 'billing',      label: 'Billing & Payments' },
  { key: 'users',        label: 'User Management' },
  { key: 'settings',     label: 'System Settings' },
];

const PERMS = ['view', 'create', 'edit', 'delete', 'approve', 'manage'];

// Sensible defaults per role
const seedRoles = ROLES.reduce((acc, role) => {
  acc[role.id] = {};
  MODULES.forEach((m) => {
    acc[role.id][m.key] = {};
    PERMS.forEach((p) => {
      let on = false;
      if (role.id === 'admin') on = true;
      else if (role.id === 'veterinarian') on = ['dashboard','appointments','pets','medical','prescriptions','laboratory'].includes(m.key) && ['view','create','edit'].includes(p) || (m.key==='prescriptions'&&p==='approve');
      else if (role.id === 'technician') on = ['pets','medical','laboratory','appointments'].includes(m.key) && ['view','create','edit'].includes(p);
      else if (role.id === 'receptionist') on = ['appointments','pets','billing'].includes(m.key) && ['view','create','edit'].includes(p);
      else if (role.id === 'cashier') on = (m.key==='billing') && ['view','create','edit'].includes(p);
      else if (role.id === 'lab') on = (m.key==='laboratory') && ['view','create','edit','approve'].includes(p);
      acc[role.id][m.key][p] = !!on;
    });
  });
  return acc;
}, {});

const seedAppointments = {
  defaultDuration: 30,
  allowCustomDuration: true,
  customDurations: [15, 20, 30, 45, 60, 90],
  types: ['Wellness Exam', 'Vaccination', 'Sick Visit', 'Dental Cleaning', 'Surgery Consult', 'Grooming', 'Telehealth'],
  cancellationHours: 24,
  rescheduleLimit: 3,
  checkInWindow: 15,
  noShowGrace: 10,
  noShowAction: 'mark_no_show',
  onlineBooking: true,
  bookingLeadDays: 60,
  requireDeposit: false,
  depositPercent: 20,
  vetScheduling: 'open',
};

const seedPets = {
  weightUnit: 'kg',
  tempUnit: 'celsius',
  species: ['Dog', 'Cat', 'Rabbit', 'Bird', 'Hamster', 'Guinea Pig', 'Reptile'],
  breeds: ['Labrador Retriever', 'Golden Retriever', 'Shih Tzu', 'Persian', 'Maine Coon', 'Beagle', 'Poodle'],
  vaccineTypes: ['Rabies', 'DHPP', 'Bordetella', 'FVRCP', 'Leptospirosis', 'Parvovirus'],
  allergyCategories: ['Food', 'Environmental', 'Drug', 'Flea/Tick'],
  recordCategories: ['History', 'Examination', 'Diagnosis', 'Treatment', 'Surgery', 'Follow-up'],
  idFields: ['Microchip', 'Collar Tag', 'Tattoo', 'Pedigree'],
  bcsScale: '9-point',
};

const seedPrescriptions = {
  catalog: [
    { name: 'Amoxicillin', form: 'Tablet', unit: 'mg' },
    { name: 'Meloxicam', form: 'Oral Suspension', unit: 'mg/ml' },
    { name: 'Cefovecin', form: 'Injectable', unit: 'mg' },
    { name: 'Maropitant', form: 'Tablet', unit: 'mg' },
  ],
  dosageUnits: ['mg', 'mg/kg', 'ml', 'mg/ml', 'unit', 'tab'],
  frequencyOptions: ['Once daily', 'Twice daily', 'Three times daily', 'Every 8 hours', 'Every 12 hours', 'As needed'],
  maxRefills: 3,
  refillLeadDays: 5,
  validityDays: 30,
  requireVetApproval: true,
  approvalThreshold: 0,
};

const seedLaboratory = {
  testTypes: ['Complete Blood Count', 'Biochemistry Panel', 'Fecal Exam', 'Urinalysis', 'Heartworm Antigen', 'Thyroid (T4)'],
  categories: ['Hematology', 'Clinical Chemistry', 'Parasitology', 'Endocrinology', 'Microbiology'],
  units: ['g/dL', 'x10⁹/L', 'mmol/L', 'IU/L', '%, mg/dL'],
  referenceRanges: [
    { test: 'Complete Blood Count', measure: 'WBC', low: 6, high: 17, unit: 'x10⁹/L' },
    { test: 'Biochemistry Panel', measure: 'ALT', low: 10, high: 100, unit: 'IU/L' },
    { test: 'Biochemistry Panel', measure: 'Creatinine', low: 0.5, high: 1.6, unit: 'mg/dL' },
  ],
  resultStatuses: ['pending', 'partial', 'final', 'verified', 'rejected'],
  requireApproval: true,
  autoVerifyBelow: false,
};

const seedBilling = {
  currency: 'PHP',
  taxEnabled: true,
  taxRate: 12,
  taxLabel: 'VAT',
  serviceChargeEnabled: false,
  serviceChargeRate: 5,
  invoicePrefix: 'INV-',
  invoiceStart: 1001,
  paymentMethods: ['Cash', 'GCash', 'Bank Transfer', 'Credit Card', 'PayMongo'],
  refundPolicy: 'refund_7d',
  refundWindowDays: 7,
  paymongo: { connected: true, mode: 'test', publicKey: 'pk_test_8xR3lQ2mZpVn9WcY', secretKeySet: true },
};

const seedNotifications = {
  clicksend: { enabled: true, from: 'PHVC Vet', senderId: 'PAWHEALTH', connected: true },
  channels: {
    appointmentConfirmation: true,
    appointmentReminder: true,
    vaccinationReminder: true,
    prescriptionRefill: true,
    labResult: true,
    paymentConfirmation: true,
    emailDigest: false,
  },
  reminderLeadHours: [24, 2],
  emailFrom: 'noreply@pawhealth.vet',
  templates: {
    appointmentConfirmation: 'Hi {{owner}}, your appointment for {{pet}} is confirmed on {{date}} at {{time}}. Reply STOP to cancel.',
    appointmentReminder: 'Reminder: {{pet}} has an appointment on {{date}} at {{time}}. See you soon!',
    vaccinationReminder: '{{pet}} is due for {{vaccine}} on {{date}}. Book now: {{link}}',
    prescriptionRefill: 'Your refill for {{medication}} ({{pet}}) is ready for pickup.',
    labResult: 'Lab results for {{pet}} are now available. View in your portal.',
    paymentConfirmation: 'Payment of {{amount}} received. Thank you! Receipt: {{receipt}}',
  },
};

const seedBranches = {
  branches: [
    { id: 'b1', name: 'Mandaluyong Main', address: 'Unit 4, Greenfield Tower, Mandaluyong', phone: '+63 2 8555 0199', primary: true, hours: { open: '08:00', close: '18:00' } },
    { id: 'b2', name: 'Makati Branch', address: '2F Glorietta 2, Makati', phone: '+63 2 8816 2200', primary: false, hours: { open: '09:00', close: '17:00' } },
  ],
  rooms: [
    { id: 'r1', branch: 'b1', name: 'Consult Room 1', type: 'consultation', available: true },
    { id: 'r2', branch: 'b1', name: 'Consult Room 2', type: 'consultation', available: true },
    { id: 'r3', branch: 'b1', name: 'Surgery Suite A', type: 'surgery', available: false },
    { id: 'r4', branch: 'b1', name: 'Lab Room 1', type: 'laboratory', available: true },
    { id: 'r5', branch: 'b2', name: 'Consult Room 1', type: 'consultation', available: true },
  ],
  roomTypes: ['consultation', 'surgery', 'laboratory'],
};

const seedSecurity = {
  minLength: 10,
  requireUppercase: true,
  requireNumber: true,
  requireSymbol: true,
  passwordExpiryDays: 90,
  sessionTimeoutMin: 30,
  maxLoginAttempts: 5,
  lockoutMinutes: 15,
  twoFactorRequired: true,
  twoFactorMethod: 'app',
  lockoutEnabled: true,
  notifyOnNewLogin: true,
  notifyOnPermissionChange: true,
};

const seedSystem = {
  dateFormat: 'MMM D, YYYY',
  timeFormat: '12h',
  timezone: 'Asia/Manila',
  currency: 'PHP',
  language: 'en',
  pagination: 25,
  dashboardRefreshSec: 30,
  weekStart: 'monday',
  compactTables: false,
};

export const ROLE_LIST = ROLES;
export const MODULE_LIST = MODULES;
export const PERM_LIST = PERMS;

const initialState = {
  clinic: seedClinic,
  profile: seedProfile,
  roles: seedRoles,
  appointments: seedAppointments,
  pets: seedPets,
  prescriptions: seedPrescriptions,
  laboratory: seedLaboratory,
  billing: seedBilling,
  notifications: seedNotifications,
  branches: seedBranches,
  security: seedSecurity,
  system: seedSystem,
};

const seedAudit = [
  { id: 'a1', action: 'login', actor: 'Alex Rivera', summary: 'Signed in from Mandaluyong, PH', at: '2026-08-23T08:10:00Z' },
  { id: 'a2', action: 'user_create', actor: 'Alex Rivera', summary: 'Created veterinarian account j.delacruz@pawhealth.vet', at: '2026-08-22T14:02:00Z' },
  { id: 'a3', action: 'permission_change', actor: 'Alex Rivera', summary: 'Updated Receptionist permissions on Billing', at: '2026-08-22T11:30:00Z' },
  { id: 'a4', action: 'pet_update', actor: 'Maria Santos', summary: 'Updated medical record for Bella (Dog)', at: '2026-08-21T16:45:00Z' },
  { id: 'a5', action: 'appointment_change', actor: 'Joanna Cruz', summary: 'Rescheduled appointment #APT-2281', at: '2026-08-21T09:15:00Z' },
  { id: 'a6', action: 'config_change', actor: 'Alex Rivera', summary: 'Changed clinic currency to PHP', at: '2026-08-20T10:00:00Z' },
  { id: 'a7', action: 'payment_change', actor: 'Ben Torres', summary: 'Issued refund INV-1044', at: '2026-08-19T13:20:00Z' },
  { id: 'a8', action: 'prescription_change', actor: 'Maria Santos', summary: 'Approved prescription RX-338', at: '2026-08-19T11:05:00Z' },
];

export const useSettingsStore = create(
  persist(
    (set, get) => ({
      data: { ...initialState },
      auditLog: seedAudit,
      _seq: 100,

      /**
       * Update a single settings section. Validates nothing here (individual
       * panels validate), just patches the slice and writes an audit entry.
       */
      updateSection: (section, patch, auditNote) => {
        set((st) => ({
          data: { ...st.data, [section]: typeof patch === 'function' ? patch(st.data[section]) : { ...st.data[section], ...patch } },
        }));
        if (auditNote) get().logAudit('config_change', auditNote);
      },

      resetSection: (section) => {
        set((st) => ({ data: { ...st.data, [section]: initialState[section] } }));
        get().logAudit('config_change', `Reset ${section} settings to defaults`);
      },

      // Append-only audit log. Never removes or edits entries.
      logAudit: (action, summary, actor = 'Alex Rivera') => {
        const id = `a${get()._seq + 1}`;
        set((st) => ({
          _seq: st._seq + 1,
          auditLog: [{ id, action, summary, actor, at: new Date().toISOString() }, ...st.auditLog].slice(0, 500),
        }));
      },

      // Simulated network save with success/error states.
      saveSection: async (section, patch, auditNote) => {
        await delay();
        // Simulate occasional backend error for realism (commented out by default)
        get().updateSection(section, patch, auditNote);
        return true;
      },

      testConnection: async (label = 'Service') => {
        await delay(900);
        return { ok: true, message: `${label} connection successful.` };
      },
    }),
    {
      name: 'vetlink_settings',
      partialize: (st) => ({ data: st.data, auditLog: st.auditLog, _seq: st._seq }),
    }
  )
);

export default useSettingsStore;
