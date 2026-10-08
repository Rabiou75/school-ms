import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const put = (p, c) => {
  const full = join(root, p);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, c, 'utf8');
  console.log('  + ' + p);
};

// ============================================================
// 1) Patch schema.prisma
// ============================================================
const schemaPath = join(root, 'packages/database/prisma/schema.prisma');
let schema = readFileSync(schemaPath, 'utf8');

function addModel(name, body) {
  const re = new RegExp(`model ${name} \\{`, 'm');
  if (re.test(schema)) { console.log('  = model ' + name + ' exists'); return; }
  schema += '\n' + body.trim() + '\n';
  console.log('  + model ' + name);
}

function addField(modelName, fieldLine) {
  const fieldName = fieldLine.trim().split(/\s+/)[0];
  const re = new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`, 'm');
  const m = schema.match(re);
  if (!m) { console.log('  ! ' + modelName + ' not found'); return; }
  const body = m[0];
  if (new RegExp(`\\n\\s*${fieldName}\\s`).test(body)) { console.log('  = ' + modelName + '.' + fieldName); return; }
  const idx = body.lastIndexOf('\n}');
  const next = body.slice(0, idx) + '\n  ' + fieldLine + body.slice(idx);
  schema = schema.replace(body, next);
  console.log('  + ' + modelName + '.' + fieldName);
}

addModel('Term', `
model Term {
  id             String   @id @default(cuid())
  academicYearId String
  name           String
  startDate      DateTime
  endDate        DateTime
  isCurrent      Boolean  @default(false)

  academicYear AcademicYear @relation(fields: [academicYearId], references: [id], onDelete: Cascade)
  exams        Exam[]

  @@index([academicYearId])
}`);

addModel('Exam', `
model Exam {
  id             String    @id @default(cuid())
  schoolId       String
  academicYearId String
  termId         String?
  classId        String?
  name           String
  type           String    @default("MID_TERM")
  startDate      DateTime
  endDate        DateTime
  publishedAt    DateTime?
  createdAt      DateTime  @default(now())

  school       School       @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  academicYear AcademicYear @relation(fields: [academicYearId], references: [id])
  term         Term?        @relation(fields: [termId], references: [id])
  class        Class?       @relation(fields: [classId], references: [id])
  marks        Mark[]

  @@index([schoolId, academicYearId])
}`);

addModel('Mark', `
model Mark {
  id          String   @id @default(cuid())
  examId      String
  studentId   String
  subjectId   String
  score       Float
  maxScore    Float    @default(20)
  coefficient Float    @default(1)
  remarks     String?
  recordedBy  String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  exam    Exam    @relation(fields: [examId], references: [id], onDelete: Cascade)
  student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  subject Subject @relation(fields: [subjectId], references: [id])

  @@unique([examId, studentId, subjectId])
  @@index([studentId])
}`);

addField('AcademicYear', 'terms Term[]');
addField('AcademicYear', 'exams Exam[]');
addField('Class',        'exams Exam[]');
addField('Subject',      'marks Mark[]');
addField('Student',      'marks Mark[]');
addField('School',       'exams Exam[]');

writeFileSync(schemaPath, schema, 'utf8');
console.log('  ✅ schema.prisma saved');

// ============================================================
// 2) Shared schemas
// ============================================================
put('packages/shared/src/schemas/exam.ts', `import { z } from 'zod';

export const examTypes = ['QUIZ','MID_TERM','FINAL','MOCK','CONTINUOUS'] as const;

export const createExamSchema = z.object({
  name: z.string().min(1),
  type: z.enum(examTypes).default('MID_TERM'),
  classId: z.string().optional(),
  termId: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
});

export const markEntrySchema = z.object({
  studentId: z.string().min(1),
  subjectId: z.string().min(1),
  score: z.number().min(0),
  maxScore: z.number().positive().default(20),
  coefficient: z.number().positive().default(1),
});

export const saveMarksSchema = z.object({
  entries: z.array(markEntrySchema),
});

export type CreateExamDto = z.infer<typeof createExamSchema>;
export type MarkEntryDto = z.infer<typeof markEntrySchema>;
export type SaveMarksDto = z.infer<typeof saveMarksSchema>;
`);

put('packages/shared/src/index.ts', `export * from './schemas/auth';
export * from './schemas/student';
export * from './schemas/finance';
export * from './schemas/attendance';
export * from './schemas/exam';
export * from './constants';
`);

// ============================================================
// 3) Exams service
// ============================================================
put('apps/api/src/exams/exams.service.ts', `import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExamDto, MarkEntryDto } from '@school/shared';

@Injectable()
export class ExamsService {
  constructor(private prisma: PrismaService) {}

  list(schoolId: string) {
    return this.prisma.exam.findMany({
      where: { schoolId },
      include: {
        class: { select: { id: true, name: true } },
        term: { select: { id: true, name: true } },
        _count: { select: { marks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const e = await this.prisma.exam.findUnique({
      where: { id },
      include: { class: true, term: true },
    });
    if (!e) throw new NotFoundException('exam_not_found');
    return e;
  }

  async create(schoolId: string, dto: CreateExamDto) {
    const year = await this.prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
    });
    if (!year) throw new BadRequestException('no_current_academic_year');
    return this.prisma.exam.create({
      data: {
        schoolId,
        academicYearId: year.id,
        termId: dto.termId ?? null,
        classId: dto.classId ?? null,
        name: dto.name,
        type: dto.type,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
    });
  }

  async grid(examId: string, classId: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundException('exam_not_found');
    const klass = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!klass) throw new NotFoundException('class_not_found');

    const students = await this.prisma.student.findMany({
      where: { classId, isActive: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    const subjects = await this.prisma.subject.findMany({
      where: { schoolId: exam.schoolId },
      orderBy: { name: 'asc' },
    });
    const marks = await this.prisma.mark.findMany({
      where: { examId, studentId: { in: students.map((s) => s.id) } },
    });

    const byKey = new Map(marks.map((m) => [m.studentId + ':' + m.subjectId, m]));

    return {
      exam,
      klass,
      subjects: subjects.map((s) => ({ id: s.id, name: s.name, code: s.code })),
      students: students.map((s) => ({
        student: {
          id: s.id,
          admissionNo: s.admissionNo,
          firstName: s.firstName,
          lastName: s.lastName,
        },
        marks: subjects.reduce((acc, sub) => {
          const m = byKey.get(s.id + ':' + sub.id);
          if (m) acc[sub.id] = { score: m.score, maxScore: m.maxScore, coefficient: m.coefficient };
          return acc;
        }, {} as Record<string, { score: number; maxScore: number; coefficient: number }>),
      })),
    };
  }

  async saveMarks(userId: string, examId: string, entries: MarkEntryDto[]) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundException('exam_not_found');

    const results = await Promise.all(
      entries.map((e) =>
        this.prisma.mark.upsert({
          where: {
            examId_studentId_subjectId: {
              examId,
              studentId: e.studentId,
              subjectId: e.subjectId,
            },
          },
          update: { score: e.score, maxScore: e.maxScore, coefficient: e.coefficient, recordedBy: userId },
          create: {
            examId,
            studentId: e.studentId,
            subjectId: e.subjectId,
            score: e.score,
            maxScore: e.maxScore,
            coefficient: e.coefficient,
            recordedBy: userId,
          },
        }),
      ),
    );
    return { count: results.length };
  }

  async results(examId: string, classId: string) {
    const students = await this.prisma.student.findMany({
      where: { classId, isActive: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    const marks = await this.prisma.mark.findMany({
      where: { examId, studentId: { in: students.map((s) => s.id) } },
      include: { subject: true },
    });
    const byStudent = new Map<string, typeof marks>();
    for (const m of marks) {
      if (!byStudent.has(m.studentId)) byStudent.set(m.studentId, []);
      byStudent.get(m.studentId)!.push(m);
    }

    const rows = students.map((s) => {
      const ms = byStudent.get(s.id) ?? [];
      let weighted = 0, coef = 0;
      for (const m of ms) {
        const pct20 = (m.score / m.maxScore) * 20;
        weighted += pct20 * m.coefficient;
        coef += m.coefficient;
      }
      const average = coef > 0 ? Number((weighted / coef).toFixed(2)) : null;
      return {
        student: {
          id: s.id,
          admissionNo: s.admissionNo,
          firstName: s.firstName,
          lastName: s.lastName,
        },
        subjectCount: ms.length,
        average,
        marks: ms.map((m) => ({
          subject: m.subject.name,
          code: m.subject.code,
          score: m.score,
          maxScore: m.maxScore,
          coefficient: m.coefficient,
        })),
      };
    });

    const ranked = rows
      .filter((r) => r.average !== null)
      .sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
    const rankMap = new Map(ranked.map((r, i) => [r.student.id, i + 1]));

    return {
      examId,
      classId,
      rows: rows.map((r) => ({ ...r, rank: rankMap.get(r.student.id) ?? null })),
    };
  }
}
`);

// ============================================================
// 4) Exams controller
// ============================================================
put('apps/api/src/exams/exams.controller.ts', `import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import { createExamSchema, saveMarksSchema, CreateExamDto, SaveMarksDto } from '@school/shared';

@UseGuards(JwtAuthGuard)
@Controller('exams')
export class ExamsController {
  constructor(private svc: ExamsService) {}

  @Get()
  list(@Req() req: any) {
    return this.svc.list(req.user.schoolId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Post()
  create(@Req() req: any, @Body(new ZodValidationPipe(createExamSchema)) dto: CreateExamDto) {
    return this.svc.create(req.user.schoolId, dto);
  }

  @Get(':id/grid')
  grid(@Param('id') id: string, @Query('classId') classId: string) {
    if (!classId) throw new Error('classId_required');
    return this.svc.grid(id, classId);
  }

  @Post(':id/marks')
  saveMarks(
    @Req() req: any,
    @Param('id') examId: string,
    @Body(new ZodValidationPipe(saveMarksSchema)) dto: SaveMarksDto,
  ) {
    return this.svc.saveMarks(req.user.sub, examId, dto.entries);
  }

  @Get(':id/results')
  results(@Param('id') id: string, @Query('classId') classId: string) {
    if (!classId) throw new Error('classId_required');
    return this.svc.results(id, classId);
  }
}
`);

put('apps/api/src/exams/exams.module.ts', `import { Module } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { ExamsController } from './exams.controller';

@Module({
  providers: [ExamsService],
  controllers: [ExamsController],
})
export class ExamsModule {}
`);

// ============================================================
// 5) Register in app.module
// ============================================================
put('apps/api/src/app.module.ts', `import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { StudentsModule } from './students/students.module';
import { FinanceModule } from './finance/finance.module';
import { AttendanceModule } from './attendance/attendance.module';
import { ClassesModule } from './classes/classes.module';
import { ExamsModule } from './exams/exams.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    PrismaModule,
    AuthModule,
    StudentsModule,
    FinanceModule,
    AttendanceModule,
    ClassesModule,
    ExamsModule,
  ],
})
export class AppModule {}
`);

console.log('\n✅ Exams backend files written');