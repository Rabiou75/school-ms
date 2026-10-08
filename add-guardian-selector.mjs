import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const p = join(process.cwd(), 'apps/web/app/[locale]/dashboard/students/page.tsx');
let s = readFileSync(p, 'utf8');

// 1. Add guardians state (before filtered useMemo)
if (!s.includes('guardians')) {
  s = s.replace(
    "  const [classes, setClasses] = useState<Class[]>([]);",
    "  const [classes, setClasses] = useState<Class[]>([]);\n  const [guardians, setGuardians] = useState<any[]>([]);"
  );

  // 2. Load guardians in the initial useEffect
  s = s.replace(
    "      const [s, c] = await Promise.all([\n        apiFetch('/api/v1/students').then((r) => r.ok ? r.json() : Promise.reject(r.status)),\n        apiFetch('/api/v1/classes').then((r) => r.ok ? r.json() : []),\n      ]);\n      setRows(Array.isArray(s) ? s : []);\n      setClasses(Array.isArray(c) ? c : []);",
    "      const [s, c, g] = await Promise.all([\n        apiFetch('/api/v1/students').then((r) => r.ok ? r.json() : Promise.reject(r.status)),\n        apiFetch('/api/v1/classes').then((r) => r.ok ? r.json() : []),\n        apiFetch('/api/v1/guardians').then((r) => r.ok ? r.json() : []),\n      ]);\n      setRows(Array.isArray(s) ? s : []);\n      setClasses(Array.isArray(c) ? c : []);\n      setGuardians(Array.isArray(g) ? g : []);"
  );

  // 3. Pass guardians to the modal
  s = s.replace(
    "<StudentModal\n          student={editing}\n          classes={classes}",
    "<StudentModal\n          student={editing}\n          classes={classes}\n          guardians={guardians}"
  );

  // 4. Add guardians to modal props
  s = s.replace(
    "}: { student: Student | null; classes: Class[]; onClose: () => void; onSaved: () => void }) {",
    "  guardians,\n}: { student: Student | null; classes: Class[]; guardians: any[]; onClose: () => void; onSaved: () => void }) {"
  );

  // 5. Add guardianId to form state
  s = s.replace(
    "    classId:     student?.class?.id ?? (classes[0]?.id ?? ''),",
    "    classId:     student?.class?.id ?? (classes[0]?.id ?? ''),\n    guardianId:  (student as any)?.guardianId ?? (student as any)?.guardian?.id ?? '',"
  );

  // 6. Include guardianId in the submit payload
  s = s.replace(
    "        classId: form.classId || undefined,",
    "        classId: form.classId || undefined,\n        guardianId: form.guardianId || undefined,"
  );

  // 7. Add the parent dropdown after the Class field
  s = s.replace(
    /(<Field label=\{t\('class'\)\}>[\s\S]*?<\/Field>)/,
    `$1
          <Field label={t('parent') || 'Parent'}>
            <select value={(form as any).guardianId} onChange={set('guardianId' as any)}
                    className="w-full rounded border px-3 py-2">
              <option value="">— {t('noParent') || 'Aucun'} —</option>
              {guardians.map((g: any) => (
                <option key={g.id} value={g.id}>
                  {g.firstName} {g.lastName} · {g.relation} · {g.phone}
                </option>
              ))}
            </select>
          </Field>`
  );

  writeFileSync(p, s, 'utf8');
  console.log('OK students page — parent selector added');
} else {
  console.log('= students page already has guardian selector');
}