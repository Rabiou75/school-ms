import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const path = join(process.cwd(), 'apps/web/app/[locale]/dashboard/settings/page.tsx');
let s = readFileSync(path, 'utf8');

const before = `      let d = {};
      try { d = JSON.parse(raw); } catch { d = { raw }; }
      if (r.ok && d.ok) {`;

const after = `      let d: any = {};
      try { d = JSON.parse(raw); } catch { d = { raw }; }
      if (r.ok && d.ok) {`;

if (s.includes(before)) {
  s = s.replace(before, after);
  writeFileSync(path, s, 'utf8');
  console.log('OK — typed as any');
} else if (s.includes('let d: any = {};')) {
  console.log('= already fixed');
} else {
  console.log('! anchor not found — inspecting nearby lines');
  const i = s.indexOf('let d = {}');
  if (i >= 0) console.log(s.slice(i - 100, i + 200));
}