import fs from 'fs';
import * as parser from '@babel/parser';
const f = 'src/components/dashboard/AdminDashboard.jsx';
try {
  parser.parse(fs.readFileSync(f,'utf8'), { sourceType:'module', plugins:['jsx','importMeta','topLevelAwait'] });
  console.log('AdminDashboard.jsx: ✓ syntax OK');
} catch(e) {
  console.log('AdminDashboard.jsx: ✗', e.message.split('\n')[0]);
}
