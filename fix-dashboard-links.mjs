import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const path = join(root, 'apps/web/app/[locale]/dashboard/page.tsx');
let src = readFileSync(path, 'utf8');

const fixes = [
  {
    before: `<BigCard label={t('staff')} value={stats.staff} icon="👩‍🏫" tone="violet" />`,
    after:  `<BigCard label={t('staff')} value={stats.staff} icon="👩‍🏫" tone="violet" href={'/' + locale + '/dashboard/staff'} />`,
  },
  {
    before: `<BigCard label={t('classes')} value={stats.classes} icon="🏫" tone="sky" />`,
    after:  `<BigCard label={t('classes')} value={stats.classes} icon="🏫" tone="sky" href={'/' + locale + '/dashboard/classes'} />`,
  },
  {
    before: `<BigCard label={t('subjects')} value={stats.subjects} icon="📚" tone="amber" />`,
    after:  `<BigCard label={t('subjects')} value={stats.subjects} icon="📚" tone="amber" href={'/' + locale + '/dashboard/subjects'} />`,
  },
];

let changed = 0;
for (const f of fixes) {
  if (src.includes(f.before)) {
    src = src.replace(f.before, f.after);
    changed++;
    console.log('  + linked ' + f.before.match(/label=\{t\('([^']+)'\)\}/)[1]);
  } else if (src.includes("'/dashboard/" + f.before.match(/label=\{t\('([^']+)'\)\}/)[1] + "'")) {
    console.log('  = already linked: ' + f.before.match(/label=\{t\('([^']+)'\)\}/)[1]);
  } else {
    console.log('  ! anchor not found for ' + f.before.match(/label=\{t\('([^']+)'\)\}/)[1]);
  }
}

writeFileSync(path, src, 'utf8');
console.log('\n✅ ' + changed + ' card(s) linked');