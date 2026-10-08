import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

for (const rel of [
  'apps/web/app/[locale]/dashboard/layout.tsx',
  'apps/web/app/[locale]/parent/layout.tsx',
  'apps/web/app/[locale]/student/layout.tsx',
]) {
  const p = join(root, rel);
  let s;
  try { s = readFileSync(p, 'utf8'); } catch { console.log('  ! missing ' + rel); continue; }

  if (s.includes('SchoolLogo')) {
    console.log('  = ' + rel + ' already has SchoolLogo');
    continue;
  }

  // Add import
  s = s.replace(
    "import NotificationBell from '@/components/NotificationBell';",
    "import NotificationBell from '@/components/NotificationBell';\nimport SchoolLogo from '@/components/SchoolLogo';"
  );

  // Replace the SMS + subtitle block
  s = s.replace(
    /<span className="text-lg font-bold text-brand-600">SMS<\/span>\s*\n\s*<span className="ml-2 text-xs text-gray-400">[^<]*<\/span>/,
    "<SchoolLogo />"
  );

  writeFileSync(p, s, 'utf8');
  console.log('  + ' + rel);
}

console.log('\nOK logo-2 done');