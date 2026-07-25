const { supabaseAdmin } = require('../config/supabase');

const adminService = {
  /**
   * Aggregate counts for the Admin dashboard.
   */
  async getStats() {
    const [appts, pets, users] = await Promise.all([
      supabaseAdmin.from('appointments').select('id, status', { count: 'exact', head: false }),
      supabaseAdmin.from('pets').select('id', { count: 'exact', head: false }),
      supabaseAdmin.from('users').select('id, role, is_active', { count: 'exact', head: false }),
    ]);
    if (appts.error) throw new Error(appts.error.message);
    if (pets.error)  throw new Error(pets.error.message);
    if (users.error) throw new Error(users.error.message);

    const appointments = appts.data || [];
    const usersList    = users.data || [];

    const apptCounts = appointments.reduce((acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, {});

    const staffCount = usersList.filter(u => ['admin','veterinarian','staff'].includes(u.role) && u.is_active !== false).length;
    const clientCount = usersList.filter(u => u.role === 'client' && u.is_active !== false).length;

    return {
      totals: {
        appointments: appointments.length,
        pets:         pets.data?.length || 0,
        staff:        staffCount,
        clients:      clientCount,
      },
      appointmentsByStatus: {
        pending:   apptCounts.pending   || 0,
        confirmed: apptCounts.confirmed || 0,
        completed: apptCounts.completed || 0,
        cancelled: apptCounts.cancelled || 0,
      },
    };
  },

  /**
   * List all admin/vet/staff users with role + status.
   */
  async getStaff() {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, name, email, role, phone_number, is_active, is_verified, avatar_url, created_at, staff_profiles(license_number, specialization, position)')
      .in('role', ['admin','veterinarian','staff'])
      .order('role')
      .order('name');
    if (error) throw new Error(error.message);
    return data || [];
  },
};

module.exports = adminService;
