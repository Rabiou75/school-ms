import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

// ---------- 1. Ensure SchoolSetting model exists in schema ----------
const schemaPath = join(root, 'packages/database/prisma/schema.prisma');
let schema = readFileSync(schemaPath, 'utf8');

if (!schema.includes('model SchoolSetting')) {
  schema += `

model SchoolSetting {
  id        String   @id @default(cuid())
  schoolId  String
  key       String
  value     String
  updatedAt DateTime @updatedAt

  school School @relation(fields: [schoolId], references: [id], onDelete: Cascade)

  @@unique([schoolId, key])
}
`;
  console.log('  + model SchoolSetting added to schema');

  // Add reverse relation to School if missing
  const schoolMatch = schema.match(/model School \{[\s\S]*?\n\}/m);
  if (schoolMatch && !schoolMatch[0].includes('settings SchoolSetting[]')) {
    const idx = schoolMatch[0].lastIndexOf('\n}');
    const patched = schoolMatch[0].slice(0, idx) + '\n  settings SchoolSetting[]' + schoolMatch[0].slice(idx);
    schema = schema.replace(schoolMatch[0], patched);
    console.log('  + School.settings reverse relation');
  }

  writeFileSync(schemaPath, schema, 'utf8');
  console.log('  ✅ schema.prisma saved');
} else {
  console.log('  = SchoolSetting already in schema');
  // Make sure reverse relation is present
  const schoolMatch = schema.match(/model School \{[\s\S]*?\n\}/m);
  if (schoolMatch && !schoolMatch[0].includes('settings SchoolSetting[]')) {
    const idx = schoolMatch[0].lastIndexOf('\n}');
    const patched = schoolMatch[0].slice(0, idx) + '\n  settings SchoolSetting[]' + schoolMatch[0].slice(idx);
    schema = schema.replace(schoolMatch[0], patched);
    writeFileSync(schemaPath, schema, 'utf8');
    console.log('  + School.settings reverse relation (was missing)');
  } else {
    console.log('  = School.settings already present');
  }
}

// ---------- 2. Fix the settings service TS errors ----------
const svcPath = join(root, 'apps/api/src/settings/settings.service.ts');
let svc = readFileSync(svcPath, 'utf8');

// Fix line 28: annotate `r` in rows.map
svc = svc.replace(
  "const map: Record<string, string> = Object.fromEntries(rows.map((r) => [r.key, r.value]));",
  "const map: Record<string, string> = Object.fromEntries(\n      rows.map((r: { key: string; value: string }) => [r.key, r.value]),\n    );"
);

// Fix line 105: cast data as any so dynamic keys work
svc = svc.replace(
  "const data: any = {};\n    for (const k of ['firstName', 'lastName', 'phone', 'locale']) {\n      if (dto[k] !== undefined) data[k] = dto[k] || null;\n    }",
  "const data: Record<string, any> = {};\n    const allowed = ['firstName', 'lastName', 'phone', 'locale'] as const;\n    for (const k of allowed) {\n      if ((dto as any)[k] !== undefined) data[k] = (dto as any)[k] || null;\n    }"
);

writeFileSync(svcPath, svc, 'utf8');
console.log('  ✅ settings.service.ts TypeScript errors fixed');

console.log('\nDone. Next:');
console.log('  pnpm db:generate');
console.log('  pnpm db:migrate    (name: school_setting_model)');
console.log('  cd apps\\api && npx nest build && cd ..\\..');
console.log('  .\\kill-dev.ps1');
console.log('  pnpm dev');