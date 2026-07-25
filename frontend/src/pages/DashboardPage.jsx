import { useAuth } from '../hooks/useAuth';
import DashboardLayout from '../layouts/DashboardLayout';
import AdminDashboard from '../components/dashboard/AdminDashboard';
import VetDashboard from '../components/dashboard/VetDashboard';
import StaffDashboard from '../components/dashboard/StaffDashboard';

const DASHBOARD_COMPONENTS = {
  admin: AdminDashboard,
  veterinarian: VetDashboard,
  staff: StaffDashboard,
};

function DashboardPage() {
  const { user, role } = useAuth();
  const DashboardContent = DASHBOARD_COMPONENTS[role] || StaffDashboard;

  return (
    <DashboardLayout>
      <DashboardContent user={user} />
    </DashboardLayout>
  );
}

export default DashboardPage;
