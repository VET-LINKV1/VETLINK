import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { useAuthStore } from './store/authStore';
import { supabase } from './services/supabaseClient';
import { authService } from './services/authService';

import LoginPage              from './pages/LoginPage';
import RegisterPage           from './pages/RegisterPage';
import DashboardPage          from './pages/DashboardPage';
import ProfilePage            from './pages/ProfilePage';
import StaffRegisterPage      from './pages/staff/StaffRegisterPage';
import StaffVerifyOTPPage     from './pages/staff/StaffVerifyOTPPage';
import StaffAppointmentsPage  from './pages/staff/StaffAppointmentsPage';
import VetSchedulePage        from './pages/vet/VetSchedulePage';
import VetMedicalRecordsPage  from './pages/vet/VetMedicalRecordsPage';

import ClientLayout           from './layouts/ClientLayout';
import DashboardLayout        from './layouts/DashboardLayout';
import ClientOverviewPage     from './pages/client/ClientOverviewPage';
import ClientAppointmentsPage from './pages/client/ClientAppointmentsPage';
import ClientPetsPage         from './pages/client/ClientPetsPage';
import ClientAnalyticsPage    from './pages/client/ClientAnalyticsPage';
import ClientRemindersPage    from './pages/client/ClientRemindersPage';
import HealthCheckPage        from './pages/HealthCheckPage';
import DiagnosticAnalyticsPage from './pages/diagnostic/DiagnosticAnalyticsPage';
import PredictiveAnalyticsPage from './pages/predictive/PredictiveAnalyticsPage';
import PrescriptiveAnalyticsPage from './pages/prescriptive/PrescriptiveAnalyticsPage';
import EMRPage               from './pages/emr/EMRPage';
import ClientEMRPage         from './pages/emr/ClientEMRPage';
import PassportDashboardPage from './pages/passport/PassportDashboardPage';
import PetPassportPage       from './pages/passport/PetPassportPage';
import SharedPassportPage    from './pages/passport/SharedPassportPage';
import IntakeSubmitPage      from './pages/booking/IntakeSubmitPage';
import VetIntakeReviewPage   from './pages/booking/VetIntakeReviewPage';
import ClientPostCarePage    from './pages/postcare/ClientPostCarePage';
import ClinicPharmacyPage    from './pages/postcare/ClinicPharmacyPage';
import VetDischargePage      from './pages/postcare/VetDischargePage';
import ClientCommunicationsPage from './pages/comms/ClientCommunicationsPage';
import ClientMessagesPage    from './pages/comms/ClientMessagesPage';
import CommunicationsPage    from './pages/comms/CommunicationsPage';
import StaffMessagesPage     from './pages/comms/StaffMessagesPage';
import TelehealthPage        from './pages/comms/TelehealthPage';
import ConsultationsListPage from './pages/comms/ConsultationsListPage';
import UserManagementPage    from './pages/admin/UserManagementPage';
import AdminPetRecordsPage   from './pages/admin/AdminPetRecordsPage';
import ServicesAdminPage     from './pages/admin/ServicesAdminPage';
import SettingsPage          from './pages/admin/SettingsPage';
import PaymentSuccessPage    from './pages/client/PaymentSuccessPage';
import PaymentFailedPage     from './pages/client/PaymentFailedPage';
import ProtectedRoute         from './components/ProtectedRoute';
import LoadingScreen          from './components/ui/LoadingScreen';

export function defaultRouteForRole(role) {
  if (role === 'client') return '/client';
  if (role === 'admin' || role === 'veterinarian' || role === 'staff') return '/dashboard';
  return '/login';
}

function App() {
  const { isLoading, isAuthenticated, user, setAuth, logout, setLoading } = useAuthStore();
  const initializing = useRef(true);

  useEffect(() => {
    const init = async () => {
      try {
        console.log('[Auth] init: checking Supabase session...');
        const { data: { session } } = await supabase.auth.getSession();
        let activeSession = session;

        if (!activeSession) {
          const stored = useAuthStore.getState();
          if (stored.accessToken) {
            try {
              console.log('[Auth] init: restoring session from store');
              const { data: restored, error: restoreErr } = await supabase.auth.setSession({
                access_token:  stored.accessToken,
                refresh_token: stored.refreshToken || undefined,
              });
              if (!restoreErr && restored?.session) activeSession = restored.session;
            } catch (e) {
              console.warn('[Auth] init: restore failed', e?.message);
            }
          }
        }

        if (!activeSession) {
          console.log('[Auth] init: no Supabase session — clearing local state');
          logout();
          return;
        }

        useAuthStore.setState({
          accessToken:  activeSession.access_token,
          refreshToken: activeSession.refresh_token,
        });

        try {
          const u = await authService.getMe();
          setAuth({
            user: u,
            session: { accessToken: activeSession.access_token, refreshToken: activeSession.refresh_token },
          });
        } catch (err) {
          const status = err?.response?.status;
          if (status === 401 || status === 403) {
            try { await supabase.auth.signOut(); } catch (_) {}
            logout();
            return;
          }
          const stored = useAuthStore.getState();
          if (stored.user) {
            setAuth({
              user: stored.user,
              session: { accessToken: activeSession.access_token, refreshToken: activeSession.refresh_token },
            });
          } else {
            logout();
          }
        }
      } catch (err) {
        console.error('[Auth] init error:', err?.message);
        logout();
      } finally {
        initializing.current = false;
        setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (initializing.current) return;
      if (event === 'SIGNED_OUT') logout();
      if (event === 'TOKEN_REFRESHED' && session) {
        useAuthStore.setState({
          accessToken:  session.access_token,
          refreshToken: session.refresh_token,
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isLoading) return <LoadingScreen />;

  const role = user?.role;
  const defaultDash = defaultRouteForRole(role);

  const Staff = ({ roles, children }) => (
    <ProtectedRoute allowedRoles={roles}>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );

  return (
    <Routes>
      <Route path="/login"            element={isAuthenticated ? <Navigate to={defaultDash} replace /> : <LoginPage />} />
      <Route path="/register"         element={isAuthenticated ? <Navigate to={defaultDash} replace /> : <RegisterPage />} />
      <Route path="/staff/register"   element={isAuthenticated ? <Navigate to={defaultDash} replace /> : <StaffRegisterPage />} />
      <Route path="/staff/verify-otp" element={<StaffVerifyOTPPage />} />

      <Route path="/dashboard" element={
        <ProtectedRoute allowedRoles={['admin','veterinarian','staff']}>
          <DashboardPage />
        </ProtectedRoute>
      } />

      <Route path="/schedule" element={
        <Staff roles={['veterinarian','admin']}><VetSchedulePage /></Staff>
      } />
      <Route path="/medical-records" element={
        <Staff roles={['veterinarian','admin','staff']}><VetMedicalRecordsPage /></Staff>
      } />
      <Route path="/records" element={<Navigate to="/medical-records" replace />} />

      <Route path="/emr" element={
        <Staff roles={['admin','veterinarian','staff']}><EMRPage /></Staff>
      } />
      <Route path="/client/emr" element={
        <ProtectedRoute allowedRoles={['client']}>
          <ClientLayout><ClientEMRPage /></ClientLayout>
        </ProtectedRoute>
      } />

      {/* Public, token-gated shared passport — must NOT be inside any ProtectedRoute */}
      <Route path="/passport/share/:token" element={<SharedPassportPage />} />

      {/* Staff passport */}
      <Route path="/passport" element={
        <Staff roles={['admin','veterinarian','staff']}><PassportDashboardPage /></Staff>
      } />
      <Route path="/passport/pets/:petId" element={
        <Staff roles={['admin','veterinarian','staff']}><PetPassportPage /></Staff>
      } />

      {/* Client passport */}
      <Route path="/client/passport" element={
        <ProtectedRoute allowedRoles={['client']}>
          <ClientLayout><PassportDashboardPage /></ClientLayout>
        </ProtectedRoute>
      } />
      <Route path="/client/passport/pets/:petId" element={
        <ProtectedRoute allowedRoles={['client']}>
          <ClientLayout><PetPassportPage /></ClientLayout>
        </ProtectedRoute>
      } />

      {/* Intake form — layout depends on role */}
      <Route path="/intake/:appointmentId" element={
        <ProtectedRoute>
          {role === 'client'
            ? <ClientLayout><IntakeSubmitPage /></ClientLayout>
            : <DashboardLayout><IntakeSubmitPage /></DashboardLayout>}
        </ProtectedRoute>
      } />

      {/* Vet pre-visit review */}
      <Route path="/vet/intake-review" element={
        <Staff roles={['veterinarian','admin','staff']}><VetIntakeReviewPage /></Staff>
      } />

      {/* Post-care & Pharmacy */}
      <Route path="/client/postcare" element={
        <ProtectedRoute allowedRoles={['client']}>
          <ClientLayout><ClientPostCarePage /></ClientLayout>
        </ProtectedRoute>
      } />
      <Route path="/pharmacy" element={
        <Staff roles={['admin']}><ClinicPharmacyPage /></Staff>
      } />
      <Route path="/discharge/:appointmentId" element={
        <Staff roles={['admin']}><VetDischargePage /></Staff>
      } />

      {/* Direct Support & Communication Channels — VET + CLIENT only */}
      <Route path="/messages" element={
        <Staff roles={['veterinarian']}><CommunicationsPage /></Staff>
      } />
      <Route path="/telehealth" element={
        <Staff roles={['veterinarian']}><CommunicationsPage /></Staff>
      } />
      <Route path="/communications" element={
        <Staff roles={['veterinarian']}><CommunicationsPage /></Staff>
      } />
      <Route path="/telehealth/:id" element={
        <ProtectedRoute>
          {role === 'client'
            ? <ClientLayout><TelehealthPage /></ClientLayout>
            : <DashboardLayout><TelehealthPage /></DashboardLayout>}
        </ProtectedRoute>
      } />
      <Route path="/client/messages" element={
        <ProtectedRoute allowedRoles={['client']}>
          <ClientLayout><ClientCommunicationsPage /></ClientLayout>
        </ProtectedRoute>
      } />
      <Route path="/client/telehealth" element={
        <ProtectedRoute allowedRoles={['client']}>
          <ClientLayout><ClientCommunicationsPage /></ClientLayout>
        </ProtectedRoute>
      } />
      <Route path="/client/communications" element={
        <ProtectedRoute allowedRoles={['client']}>
          <ClientLayout><ClientCommunicationsPage /></ClientLayout>
        </ProtectedRoute>
      } />

      {/* User Management (admin only) */}
      <Route path="/admin/users" element={
        <Staff roles={['admin']}><UserManagementPage /></Staff>
      } />
      <Route path="/users" element={<Navigate to="/admin/users" replace />} />

      {/* Services Management (all clinical staff) */}
      <Route path="/admin/services" element={
        <Staff roles={['admin','staff','veterinarian']}><ServicesAdminPage /></Staff>
      } />

      <Route path="/settings" element={
        <Staff roles={['admin']}><SettingsPage /></Staff>
      } />

      <Route path="/appointments" element={
        <Staff roles={['admin','staff','veterinarian']}><StaffAppointmentsPage /></Staff>
      } />

      <Route path="/health-check" element={
        <Staff roles={['admin','veterinarian','staff']}><HealthCheckPage /></Staff>
      } />

      <Route path="/diagnostic-analytics" element={
        <Staff roles={['admin']}><DiagnosticAnalyticsPage /></Staff>
      } />
      <Route path="/root-cause" element={<Navigate to="/diagnostic-analytics" replace />} />

      <Route path="/predictive-analytics" element={
        <Staff roles={['admin']}><PredictiveAnalyticsPage /></Staff>
      } />
      <Route path="/predictions" element={<Navigate to="/predictive-analytics" replace />} />

      <Route path="/prescriptive-analytics" element={
        <Staff roles={['admin']}><PrescriptiveAnalyticsPage /></Staff>
      } />
      <Route path="/action-plan" element={<Navigate to="/prescriptive-analytics" replace />} />

      <Route path="/pets" element={
        <Staff roles={['admin','staff','veterinarian']}><AdminPetRecordsPage /></Staff>
      } />

      <Route path="/profile" element={
        <ProtectedRoute>
          {role === 'client'
            ? <ClientLayout><ProfilePage /></ClientLayout>
            : <DashboardLayout><ProfilePage /></DashboardLayout>}
        </ProtectedRoute>
      } />

      <Route path="/client" element={
        <ProtectedRoute allowedRoles={['client']}>
          <ClientLayout><ClientOverviewPage /></ClientLayout>
        </ProtectedRoute>
      } />
      <Route path="/client/appointments" element={
        <ProtectedRoute allowedRoles={['client']}>
          <ClientLayout><ClientAppointmentsPage /></ClientLayout>
        </ProtectedRoute>
      } />
      <Route path="/client/pets" element={
        <ProtectedRoute allowedRoles={['client']}>
          <ClientLayout><ClientPetsPage /></ClientLayout>
        </ProtectedRoute>
      } />
      <Route path="/client/analytics" element={
        <ProtectedRoute allowedRoles={['client']}>
          <ClientLayout><ClientAnalyticsPage /></ClientLayout>
        </ProtectedRoute>
      } />
      <Route path="/client/reminders" element={
        <ProtectedRoute allowedRoles={['client']}>
          <ClientLayout><ClientRemindersPage /></ClientLayout>
        </ProtectedRoute>
      } />
      <Route path="/client/health-check" element={
        <ProtectedRoute allowedRoles={['client']}>
          <ClientLayout><HealthCheckPage /></ClientLayout>
        </ProtectedRoute>
      } />

      <Route path="/client/payment/success" element={
        <ProtectedRoute allowedRoles={['client']}>
          <ClientLayout><PaymentSuccessPage /></ClientLayout>
        </ProtectedRoute>
      } />
      <Route path="/client/payment/failed" element={
        <ProtectedRoute allowedRoles={['client']}>
          <ClientLayout><PaymentFailedPage /></ClientLayout>
        </ProtectedRoute>
      } />

      <Route path="/" element={<Navigate to={isAuthenticated ? defaultDash : '/login'} replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
