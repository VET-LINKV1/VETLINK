import fs from 'fs';
import path from 'path';
import babel from '@babel/core';

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

let ok = 0, fail = 0;
for (const f of files) {
  const code = fs.readFileSync(f, 'utf8');
  try {
    babel.transformSync(code, {
      filename: f,
      presets: [['@babel/preset-react', { runtime: 'automatic' }]],
      configFile: false,
      babelrc: false,
    });
    console.log('OK   ' + f);
    ok++;
  } catch (e) {
    console.log('FAIL ' + f + ' :: ' + (e.message.split('\n')[0]));
    fail++;
  }
}
console.log(`\n${ok} ok, ${fail} failed`);
