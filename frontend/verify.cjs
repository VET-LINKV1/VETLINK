const parser = require('@babel/parser');
const fs = require('fs');

const files = [
  'src/pages/admin/AdminPetRecordsPage.jsx',
  'src/components/admin/pets/PetRecordsTable.jsx',
  'src/components/admin/pets/PetFormDialog.jsx',
  'src/components/admin/pets/PetRecordDrawer.jsx',
  'src/components/admin/pets/RecentPetActivity.jsx',
  'src/services/adminPetService.js',
  'src/pages/admin/adminPetMock.js',
];

let failed = 0;
for (const f of files) {
  try {
    const code = fs.readFileSync(f, 'utf8');
    parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'decorators-legacy', 'classProperties', 'importMeta'],
    });
    console.log('OK  ', f);
  } catch (e) {
    failed++;
    console.log('FAIL', f, '->', e.message.split('\n')[0]);
  }
}
console.log(failed ? `\n${failed} file(s) failed` : '\nAll files parse cleanly');
