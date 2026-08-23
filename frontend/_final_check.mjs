import fs from 'fs';
import * as parser from '@babel/parser';

const allFiles = [
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

console.log('=== SYNTAX (Babel parser) ===');
let synErr = 0;
for (const f of allFiles) {
  try { parser.parse(fs.readFileSync(f, 'utf8'), { sourceType: 'module', plugins: ['jsx', 'importMeta', 'topLevelAwait'] }); console.log('  ✓', f); } 
  catch(e) { console.log('  ✗', f, e.message.split('\n')[0]); synErr++; }
}

console.log('\n=== IMPORTS RESOLVE ===');
function res(imp, impt) {
  if (!impt.startsWith('.')) return true;
  const t = path.resolve(path.dirname(imp), impt);
  return fs.existsSync(t) || fs.existsSync(t+'.js') || fs.existsSync(t+'.jsx') || fs.existsSync(path.join(t,'index.js')) || fs.existsSync(path.join(t,'index.jsx'));
}
const path = await import('path');
let impErr = 0;
for (const f of allFiles) {
  const re = /from\s+['"]([^'"]+)['"]/g; let m;
  while ((m = re.exec(fs.readFileSync(f, 'utf8')))) if (!res(f, m[1])) { console.log('  ✗', f, '->', m[1]); impErr++; }
}
if (impErr === 0) console.log('  All OK');

console.log('\n=== SUMMARY ===');
console.log('Files:', allFiles.length);
console.log('Syntax errors:', synErr);
console.log('Import errors:', impErr);
console.log('Status:', synErr === 0 && impErr === 0 ? 'READY' : 'NEEDS FIX');
