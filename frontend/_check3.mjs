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

function resolveImport(importer, imported) {
  // Handle relative imports
  if (imported.startsWith('.')) {
    const base = path.dirname(importer);
    let target = path.resolve(base, imported);
    // Try exact, then +.js, then +.jsx
    if (fs.existsSync(target)) return target;
    if (fs.existsSync(target + '.js')) return target + '.js';
    if (fs.existsSync(target + '.jsx')) return target + '.jsx';
    if (fs.existsSync(path.join(target, 'index.js'))) return path.join(target, 'index.js');
    if (fs.existsSync(path.join(target, 'index.jsx'))) return path.join(target, 'index.jsx');
    return null;
  }
  // Handle absolute aliases (@/...)
  if (imported.startsWith('@/')) {
    const target = path.resolve('src', imported.slice(2));
    if (fs.existsSync(target)) return target;
    if (fs.existsSync(target + '.js')) return target + '.js';
    if (fs.existsSync(target + '.jsx')) return target + '.jsx';
    return null;
  }
  // External package - skip
  return 'external';
}

function checkFile(f) {
  const code = fs.readFileSync(f, 'utf8');
  const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
  let m, errors = 0;
  while ((m = importRegex.exec(code)) !== null) {
    const imp = m[1];
    const resolved = resolveImport(f, imp);
    if (resolved === null) {
      console.log(`  MISSING: ${f} -> ${imp}`);
      errors++;
    }
  }
  // Also check export/default export
  if (!/export\s+default/.test(code) && !/export\s+\{/.test(code)) {
    // Some files may be module-side-effect only
  }
  return errors;
}

let totalErr = 0;
for (const f of files) {
  totalErr += checkFile(f);
}
console.log(`\nImport resolution: ${totalErr === 0 ? 'ALL OK' : totalErr + ' missing'}`);
