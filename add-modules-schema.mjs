import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const path = join(root, 'packages/database/prisma/schema.prisma');
let schema = readFileSync(path, 'utf8');

function addModel(name, block) {
  if (schema.includes('model ' + name + ' {')) {
    console.log('  = model ' + name + ' exists');
    return;
  }
  schema += '\n' + block.trim() + '\n';
  console.log('  + model ' + name);
}

function addField(modelName, fieldLine) {
  const re = new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`, 'm');
  const m = schema.match(re);
  if (!m) { console.log('  ! ' + modelName + ' not found'); return; }
  const fname = fieldLine.trim().split(/\s+/)[0];
  if (new RegExp(`\\n\\s*${fname}\\s`).test(m[0])) { console.log('  = ' + modelName + '.' + fname); return; }
  const idx = m[0].lastIndexOf('\n}');
  schema = schema.replace(m[0], m[0].slice(0, idx) + '\n  ' + fieldLine + m[0].slice(idx));
  console.log('  + ' + modelName + '.' + fname);
}

// ---------- TimetableSlot ----------
addModel('TimetableSlot', `
model TimetableSlot {
  id         String @id @default(cuid())
  schoolId   String
  classId    String
  subjectId  String
  teacherId  String?
  dayOfWeek  Int
  startTime  String
  endTime    String
  room       String?
  createdAt  DateTime @default(now())

  school  School  @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  class   Class   @relation(fields: [classId], references: [id], onDelete: Cascade)
  subject Subject @relation(fields: [subjectId], references: [id])
  teacher Staff?  @relation(fields: [teacherId], references: [id])

  @@unique([classId, dayOfWeek, startTime])
  @@index([schoolId, classId])
  @@index([teacherId, dayOfWeek])
}`);

// ---------- Book ----------
addModel('Book', `
model Book {
  id          String   @id @default(cuid())
  schoolId    String
  isbn        String?
  title       String
  author      String?
  publisher   String?
  category    String?
  totalCopies Int      @default(1)
  available   Int      @default(1)
  shelf       String?
  createdAt   DateTime @default(now())

  school School     @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  loans  BookLoan[]

  @@index([schoolId, title])
}`);

// ---------- BookLoan ----------
addModel('BookLoan', `
model BookLoan {
  id         String    @id @default(cuid())
  schoolId   String
  bookId     String
  studentId  String
  borrowedAt DateTime  @default(now())
  dueDate    DateTime
  returnedAt DateTime?
  status     String    @default("BORROWED")
  fine       Int       @default(0)
  notes      String?

  book    Book    @relation(fields: [bookId], references: [id])
  student Student @relation(fields: [studentId], references: [id])

  @@index([schoolId, status])
  @@index([studentId])
}`);

// ---------- PayrollItem ----------
addModel('PayrollItem', `
model PayrollItem {
  id         String    @id @default(cuid())
  schoolId   String
  staffId    String
  month      Int
  year       Int
  grossPay   Int
  deductions Int       @default(0)
  netPay     Int
  paidAt     DateTime?
  notes      String?
  createdAt  DateTime  @default(now())

  staff Staff @relation(fields: [staffId], references: [id], onDelete: Cascade)

  @@unique([staffId, month, year])
  @@index([schoolId, year, month])
}`);

// Reverse relations
addField('School', 'timetables TimetableSlot[]');
addField('School', 'books       Book[]');
addField('School', 'loans       BookLoan[]');
addField('School', 'payroll     PayrollItem[]');
addField('Class',  'timetables  TimetableSlot[]');
addField('Subject', 'timetables TimetableSlot[]');
addField('Staff',  'timetables  TimetableSlot[]');
addField('Staff',  'payroll     PayrollItem[]');
addField('Student', 'bookLoans  BookLoan[]');

writeFileSync(path, schema, 'utf8');
console.log('\n✅ All schemas added');