import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const path = join(root, 'apps/web/app/[locale]/dashboard/page.tsx');
let src = readFileSync(path, 'utf8');

const before = `<BigCard label={t('announcements')} value={stats.announcements} icon="📢" tone="amber" />`;
const after  = `<BigCard label={t('announcements')} value={stats.announcements} icon="📢" tone="amber" href={'/' + locale + '/dashboard/announcements'} />`;

if (src.includes(before)) {
  src = src.replace(before, after);
  writeFileSync(path, src, 'utf8');
  console.log('  + dashboard card now links to /dashboard/announcements');
} else if (src.includes("'/dashboard/announcements'")) {
  console.log('  = card already linked');
} else {
  console.log('  ! anchor not found — inspect page.tsx manually');
}