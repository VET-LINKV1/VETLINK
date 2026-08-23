import fs from 'fs';
import path from 'path';
const files = [
  'src/components/dashboard/AdminDashboard.jsx',
  'src/components/dashboard/admin/WelcomeHeader.jsx',
  'src/components/dashboard/admin/KpiSummary.jsx',
  'src/components/dashboard/admin/TodaysAppointments.jsx',
  'src/components/dashboard/admin/ActionRequired.jsx',
  'src/components/dashboard/admin/AppointmentTrends.jsx',
  'src/components/dashboard/admin/RevenueOverview.jsx',
  'src/components/dashboard/admin/VetAvailability.jsx',
  'src/components/dashboard/admin/LabStatus.jsx',
  'src/components/dashboard/admin/PrescriptionRequests.jsx',
  'src/components/dashboard/admin/ClinicCapacity.jsx',
  'src/components/dashboard/admin/RecentActivity.jsx',
  'src/components/dashboard/admin/SystemStatus.jsx',
  'src/components/dashboard/admin/primitives.jsx',
  'src/components/dashboard/admin/mockData.js',
];
function resolve(importer, imported) {
  if (imported.startsWith('.')) {
    const target = path.resolve(path.dirname(importer), imported);
    for (const ext of ['', '.js', '.jsx', '/index.js', '/index.jsx']) {
      if (fs.existsSync(target + ext)) return true;
    }
    return false;
  }
  return true; // external
}
let err = 0;
for (const f of files) {
  const code = fs.readFileSync(f, 'utf8');
  const re = /from\s+['"]([^'"]+)['"]/g; let m;
  while ((m = re.exec(code))) { if (!resolve(f, m[1])) { console.log('MISSING', f, '->', m[1]); err++; } }
}
console.log(err === 0 ? 'ALL IMPORTS RESOLVE OK' : err + ' missing');
