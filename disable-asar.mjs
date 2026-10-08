import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const path = join(process.cwd(), 'desktop/electron-builder.yml');
let s = readFileSync(path, 'utf8');

// 1. Turn off asar
if (/^asar:\s*true/m.test(s)) {
  s = s.replace(/^asar:\s*true/m, 'asar: false');
  console.log('  + asar: false');
} else if (/^asar:\s*false/m.test(s)) {
  console.log('  = asar already false');
} else {
  // Add if missing
  s = s.replace(/^files:/m, 'asar: false\n\nfiles:');
  console.log('  + inserted asar: false');
}

// 2. Remove the now-unnecessary asarUnpack block
s = s.replace(/\nasarUnpack:\n(?:  - [^\n]+\n)+/g, '\n');
console.log('  + removed asarUnpack block');

writeFileSync(path, s, 'utf8');
console.log('\nOK electron-builder.yml updated');