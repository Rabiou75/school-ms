import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const path = join(process.cwd(), 'desktop/package.json');
const pkg = JSON.parse(readFileSync(path, 'utf8'));

// Correct version
pkg.dependencies = pkg.dependencies || {};
pkg.dependencies['embedded-postgres'] = '^18.4.0-beta.17';

writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log('OK embedded-postgres set to ^18.4.0-beta.17');
console.log('   package.json updated');