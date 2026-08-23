const esbuild = require('esbuild');
const fs = require('fs');

const files = [
  'src/components/settings/NotificationSettings.jsx',
  'src/components/settings/SecuritySettings.jsx',
  'src/components/settings/BranchSettings.jsx',
];

(async () => {
  for (const f of files) {
    try {
      const code = fs.readFileSync(f, 'utf8');
      const r = await esbuild.transform(code, { loader: 'jsx', jsx: 'automatic' });
      console.log('OK   ' + f + '  (' + r.code.length + ' chars)');
    } catch (e) {
      console.log('FAIL ' + f);
      console.log('   ' + e.message.split('\n').slice(0, 6).join('\n   '));
    }
  }
})();