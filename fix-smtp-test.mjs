import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const path = join(process.cwd(), 'apps/web/app/[locale]/dashboard/settings/page.tsx');
let s = readFileSync(path, 'utf8');

const before = `      const r = await apiFetch('/api/v1/notifications/test-email', {
        method: 'POST',
        body: JSON.stringify({ to: testTo }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) {
        setTestResult('OK - email envoye a ' + testTo);
      } else if (r.ok) {
        setTestResult('ECHEC: ' + (d.error || 'inconnu'));
      } else {
        const txt = await r.text();
        setTestResult('ERREUR: ' + txt.slice(0, 200));
      }`;

const after = `      const r = await apiFetch('/api/v1/notifications/test-email', {
        method: 'POST',
        body: JSON.stringify({ to: testTo }),
      });
      const raw = await r.text();
      let d = {};
      try { d = JSON.parse(raw); } catch { d = { raw }; }
      if (r.ok && d.ok) {
        setTestResult('OK - email envoye a ' + testTo);
      } else if (r.ok) {
        setTestResult('ECHEC: ' + (d.error || 'inconnu'));
      } else {
        setTestResult('ERREUR: ' + (d.message || raw).slice(0, 200));
      }`;

if (s.includes(before)) {
  s = s.replace(before, after);
  writeFileSync(path, s, 'utf8');
  console.log('OK patched settings/page.tsx');
} else if (s.includes('const raw = await r.text();')) {
  console.log('= already patched');
} else {
  console.log('! anchor not found');
}