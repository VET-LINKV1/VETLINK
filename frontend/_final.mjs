import fs from 'fs';
import * as parser from '@babel/parser';
import path from 'path';

const files = fs.readdirSync('src/components/dashboard/admin').filter(f => f.endsWith('.jsx') || f.endsWith('.js'));
files.push('../AdminDashboard.jsx');
const all = files.map(f => 'src/components/dashboard/admin/' + f);

let synErr = 0, impErr = 0;
function res(imp, impt) {
  if (!impt.startsWith('.')) return true;
  const t = path.resolve(path.dirname(imp), impt);
  return ['', '.js', '.jsx', '/index.js', '/index.jsx'].some(e => fs.existsSync(t + e));
}
for (const f of all) {
  try { parser.parse(fs.readFileSync(f,'utf8'), { sourceType:'module', plugins:['jsx','importMeta','topLevelAwait'] }); }
  catch(e) { console.log('SYNTAX ✗', f, '::', e.message.split('\n')[0]); synErr++; }
  const re = /from\s+['"]([^'"]+)['"]/g; let m;
  const code = fs.readFileSync(f,'utf8');
  while ((m = re.exec(code))) if (!res(f, m[1])) { console.log('IMPORT ✗', f, '->', m[1]); impErr++; }
}
if (synErr === 0 && impErr === 0) console.log('ALL ' + all.length + ' FILES OK');
else console.log(`\n${synErr} syntax errors, ${impErr} import errors`);
