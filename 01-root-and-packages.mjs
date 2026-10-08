import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const files = {};
const put = (p, c) => { files[p] = c; };

// ---- ROOT ----
put('package.json', `{
  "name": "school-ms",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "db:generate": "pnpm --filter @school/database generate",
    "db:migrate": "pnpm --filter @school/database migrate",
    "db:seed": "pnpm --filter @school/database seed",
    "db:studio": "pnpm --filter @school/database studio",
    "docker:dev": "docker compose -f docker/docker-compose.yml up -d",
    "docker:prod": "docker compose -f docker/docker-compose.prod.yml up -d --build"
  },
  "devDependencies": { "turbo": "^2.3.0", "typescript": "^5.6.3" },
  "engines": { "node": ">=20" }
}
`);

put('pnpm-workspace.yaml', `packages:
  - "apps/*"
  - "packages/*"
`);

put('turbo.json', `{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**", "!.next/cache/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": {},
    "generate": { "cache": false }
  }
}
`);

put('tsconfig.base.json', `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "sourceMap": true
  }
}
`);

put('.env.example', `NODE_ENV=development
DATABASE_URL=postgresql://school:school@localhost:5432/school_ms?schema=public
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=change_me_access_secret_min_32_chars
JWT_REFRESH_SECRET=change_me_refresh_secret_min_32_chars
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
API_PORT=4000
API_URL=http://localhost:4000
WEB_URL=http://localhost:3000
API_INTERNAL_URL=http://localhost:4000
DEFAULT_LOCALE=fr
SUPPORTED_LOCALES=en,fr,ar
POSTGRES_USER=school
POSTGRES_PASSWORD=school
POSTGRES_DB=school_ms
`);

put('.gitignore', `node_modules
.next
dist
.env
.env.local
*.log
.turbo
coverage
`);

put('README.md', `# School Management System

pnpm + Turborepo monorepo. NestJS API + Next.js web. PostgreSQL + Prisma.
Multilingual EN/FR/AR. XAF currency.

## Quick start
pnpm install
pnpm docker:dev
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev

Web http://localhost:3000 | API http://localhost:4000/api/v1
Admin admin@demo-school.cm / Admin@1234
`);

// ---- packages/database ----
put('packages/database/package.json', `{
  "name": "@school/database",
  "version": "0.1.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "generate": "prisma generate",
    "migrate": "prisma migrate dev",
    "migrate:deploy": "prisma migrate deploy",
    "seed": "tsx prisma/seed.ts",
    "studio": "prisma studio"
  },
  "prisma": { "seed": "tsx prisma/seed.ts" },
  "dependencies": { "@prisma/client": "^5.22.0", "bcryptjs": "^2.4.3" },
  "devDependencies": { "prisma": "^5.22.0", "tsx": "^4.19.2", "typescript": "^5.6.3" }
}
`);

put('packages/database/tsconfig.json', `{ "extends": "../../tsconfig.base.json", "include": ["src", "prisma"] }
`);

put('packages/database/src/index.ts', `import { PrismaClient } from '@prisma/client';

const g = globalThis;
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') g.prisma = prisma;
export * from '@prisma/client';
`);

put('packages/database/prisma/schema.prisma', `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model School {
  id            String   @id @default(cuid())
  name          String
  slug          String   @unique
  country       String   @default("CM")
  currency      String   @default("XAF")
  defaultLocale String   @default("fr")
  email         String?
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  users         User[]
  academicYears AcademicYear[]
  classes       Class[]
  subjects      Subject[]
  students      Student[]
  guardians     Guardian[]
  staff         Staff[]
  fees          Fee[]
  invoices      Invoice[]
  payments      Payment[]
  expenses      Expense[]
  announcements Announcement[]
  messages      Message[]
}

enum UserRole {
  SUPER_ADMIN
  ADMIN
  PRINCIPAL
  TEACHER
  STUDENT
  PARENT
  ACCOUNTANT
  LIBRARIAN
}

model User {
  id             String   @id @default(cuid())
  schoolId       String?
  email          String   @unique
  phone          String?
  passwordHash   String
  firstName      String
  lastName       String
  locale         String   @default("fr")
  role           UserRole
  isActive       Boolean  @default(true)
  lastLoginAt    DateTime?
  failedAttempts Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  school  School?  @relation(fields: [schoolId], references: [id])
  student Student?
  staff   Staff?
}

model AcademicYear {
  id        String   @id @default(cuid())
  schoolId  String
  name      String
  startDate DateTime
  endDate   DateTime
  isCurrent Boolean  @default(false)
  school    School   @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  classes   Class[]
  @@unique([schoolId, name])
}

model Class {
  id             String       @id @default(cuid())
  schoolId       String
  academicYearId String
  name           String
  level          String?
  capacity       Int          @default(40)
  school         School       @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  academicYear   AcademicYear @relation(fields: [academicYearId], references: [id])
  students       Student[]
  @@index([schoolId, academicYearId])
}

model Subject {
  id       String  @id @default(cuid())
  schoolId String
  code     String
  name     String
  nameFr   String?
  nameAr   String?
  school   School  @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  @@unique([schoolId, code])
}

enum Gender { MALE FEMALE OTHER }

model Student {
  id          String   @id @default(cuid())
  schoolId    String
  userId      String?  @unique
  admissionNo String
  firstName   String
  lastName    String
  gender      Gender
  dateOfBirth DateTime
  classId     String?
  guardianId  String?
  phone       String?
  email       String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  school   School    @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  user     User?     @relation(fields: [userId], references: [id])
  class    Class?    @relation(fields: [classId], references: [id])
  guardian Guardian? @relation(fields: [guardianId], references: [id])
  invoices Invoice[]
  @@unique([schoolId, admissionNo])
}

model Guardian {
  id        String  @id @default(cuid())
  schoolId  String
  firstName String
  lastName  String
  relation  String
  phone     String
  email     String?
  school    School  @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  students  Student[]
}

model Staff {
  id         String   @id @default(cuid())
  schoolId   String
  userId     String?  @unique
  employeeNo String
  firstName  String
  lastName   String
  gender     Gender
  position   String
  hireDate   DateTime
  baseSalary Int
  isActive   Boolean  @default(true)
  school     School   @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  user       User?    @relation(fields: [userId], references: [id])
  @@unique([schoolId, employeeNo])
}

model Fee {
  id       String  @id @default(cuid())
  schoolId String
  name     String
  amount   Int
  classId  String?
  isActive Boolean @default(true)
  school   School  @relation(fields: [schoolId], references: [id], onDelete: Cascade)
}

model Invoice {
  id         String   @id @default(cuid())
  schoolId   String
  studentId  String
  invoiceNo  String
  issuedDate DateTime @default(now())
  dueDate    DateTime
  total      Int
  amountPaid Int      @default(0)
  balance    Int
  status     String   @default("UNPAID")
  school  School  @relation(fields: [schoolId], references: [id])
  student Student @relation(fields: [studentId], references: [id])
  @@unique([schoolId, invoiceNo])
}

model Payment {
  id        String   @id @default(cuid())
  schoolId  String
  invoiceId String
  studentId String
  amount    Int
  method    String
  status    String   @default("SUCCESS")
  reference String?
  paidAt    DateTime @default(now())
  school    School   @relation(fields: [schoolId], references: [id])
}

model Expense {
  id          String   @id @default(cuid())
  schoolId    String
  category    String
  description String
  amount      Int
  paidAt      DateTime
  school      School   @relation(fields: [schoolId], references: [id])
}

model Announcement {
  id          String    @id @default(cuid())
  schoolId    String
  title       String
  body        String
  audience    String    @default("ALL")
  publishedAt DateTime?
  createdAt   DateTime  @default(now())
  school      School    @relation(fields: [schoolId], references: [id], onDelete: Cascade)
}

model Message {
  id          String    @id @default(cuid())
  schoolId    String
  senderId    String
  recipientId String
  subject     String?
  body        String
  readAt      DateTime?
  createdAt   DateTime  @default(now())
  school      School    @relation(fields: [schoolId], references: [id])
}
`);

put('packages/database/prisma/seed.ts', `import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.upsert({
    where: { slug: 'demo-school' },
    update: {},
    create: {
      name: 'Demo Bilingual School',
      slug: 'demo-school',
      country: 'CM',
      currency: 'XAF',
      defaultLocale: 'fr',
      email: 'info@demo-school.cm',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@demo-school.cm' },
    update: {},
    create: {
      schoolId: school.id,
      email: 'admin@demo-school.cm',
      passwordHash: await bcrypt.hash('Admin@1234', 10),
      firstName: 'Super',
      lastName: 'Admin',
      role: UserRole.SUPER_ADMIN,
      locale: 'fr',
    },
  });

  console.log('Seed complete');
}

main().finally(() => prisma.$disconnect());
`);

// ---- packages/shared ----
put('packages/shared/package.json', `{
  "name": "@school/shared",
  "version": "0.1.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": { "zod": "^3.23.8" }
}
`);

put('packages/shared/src/index.ts', `export * from './schemas/auth';
export * from './schemas/student';
export * from './constants';
`);

put('packages/shared/src/constants.ts', `export const SUPPORTED_LOCALES = ['en', 'fr', 'ar'];
export const DEFAULT_LOCALE = 'fr';
export const CURRENCY = 'XAF';
export const RTL_LOCALES = ['ar'];

export const formatXAF = (amount, locale = 'fr') =>
  new Intl.NumberFormat(locale === 'ar' ? 'ar-CM' : locale + '-CM', {
    style: 'currency',
    currency: 'XAF',
    maximumFractionDigits: 0,
  }).format(amount);
`);

put('packages/shared/src/schemas/auth.ts', `import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
`);

put('packages/shared/src/schemas/student.ts', `import { z } from 'zod';

export const createStudentSchema = z.object({
  admissionNo: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  dateOfBirth: z.string(),
  classId: z.string().optional(),
  guardianId: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

export const updateStudentSchema = createStudentSchema.partial();
`);

// ---- WRITE ----
let written = 0;
for (const [rel, content] of Object.entries(files)) {
  const full = join(root, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf8');
  written++;
  console.log('  + ' + rel);
}
console.log('\n✅ Wrote ' + written + ' files (root + packages)');