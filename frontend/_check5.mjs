import fs from 'fs';
import * as parser from '@babel/parser';

// Collect named exports per local module
function getExports(file) {
  const code = fs.readFileSync(file, 'utf8');
  const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx'], strictMode: false });
  const names = new Set();
  for (const n of ast.program.body) {
    if (n.type === 'ExportNamedDeclaration') {
      if (n.declaration) {
        for (const d of (n.declaration.declarations || [n.declaration])) {
          if (d.id?.name) names.add(d.id.name);
        }
      }
      for (const s of (n.specifiers || [])) names.add(s.exported.name);
    } else if (n.type === 'ExportDefaultDeclaration') names.add('default');
  }
  return names;
}

const mods = {
  './primitives': 'src/components/dashboard/admin/primitives.jsx',
  './mockData': 'src/components/dashboard/admin/mockData.js',
  '../../hooks/useAuth': 'src/hooks/useAuth.js',
};
const exportsCache = {};
for (const [k, f] of Object.entries(mods)) exportsCache[k] = getExports(f);

// Now verify each admin file's named imports from these modules exist
const files = fs.readdirSync('src/components/dashboard/admin').filter(f => f.endsWith('.jsx') && f !== 'primitives.jsx' && f !== 'mockData.js');
let err = 0;
for (const file of files) {
  const fp = 'src/components/dashboard/admin/' + file;
  const code = fs.readFileSync(fp, 'utf8');
  const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx'], strictMode: false });
  for (const n of ast.program.body) {
    if (n.type === 'ImportDeclaration') {
      const src = n.source.value;
      if (exportsCache[src]) {
        const avail = exportsCache[src];
        for (const s of n.specifiers) {
          if (s.type === 'ImportSpecifier' && !avail.has(s.imported.name)) {
            console.log(`MISSING export "${s.imported.name}" from ${src} (imported by ${file})`);
            err++;
          }
        }
      }
    }
  }
}
console.log(err === 0 ? 'ALL NAMED IMPORTS MATCH EXPORTS' : err + ' mismatches');
