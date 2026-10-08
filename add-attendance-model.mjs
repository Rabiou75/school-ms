import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const schemaPath = join(process.cwd(), 'packages/database/prisma/schema.prisma');
let schema = readFileSync(schemaPath, 'utf8');

// 1) Add Attendance enum + model if missing
if (!schema.includes('model Attendance')) {
  schema += `

enum AttendanceStatus {
  PRESENT
  ABSENT
  LATE
  EXCUSED
}

model Attendance {
  id         String           @id @default(cuid())
  studentId  String
  date       DateTime
  status     AttendanceStatus
  remarks    String?
  recordedBy String?
  createdAt  DateTime         @default(now())

  student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([studentId, date])
  @@index([date, status])
}
`;
  console.log('  + model Attendance');
} else {
  console.log('  = model Attendance already present');
}

// 2) Add attendance relation to Student if missing
const studentRelRegex = /(model Student \{[\s\S]*?)(\n\s*invoices\s+Invoice\[\])/;
if (!schema.match(/model Student[\s\S]*?attendance\s+Attendance\[\]/)) {
  schema = schema.replace(studentRelRegex, (m, head, tail) => head + '\n  attendance Attendance[]' + tail);
  console.log('  + Student.attendance relation');
} else {
  console.log('  = Student.attendance relation already present');
}

writeFileSync(schemaPath, schema, 'utf8');
console.log('\n✅ schema.prisma updated');