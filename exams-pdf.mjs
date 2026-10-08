import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const put = (p, c) => {
  const full = join(root, p);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, c, 'utf8');
  console.log('  + ' + p);
};

// ============================================================
// 1) Add pdfkit to api package.json
// ============================================================
const apiPkgPath = join(root, 'apps/api/package.json');
const apiPkg = JSON.parse(readFileSync(apiPkgPath, 'utf8'));
apiPkg.dependencies = apiPkg.dependencies || {};
apiPkg.dependencies['pdfkit'] = '^0.15.0';
apiPkg.devDependencies = apiPkg.devDependencies || {};
apiPkg.devDependencies['@types/pdfkit'] = '^0.13.4';
writeFileSync(apiPkgPath, JSON.stringify(apiPkg, null, 2) + '\n', 'utf8');
console.log('  ~ apps/api/package.json (pdfkit added)');

// ============================================================
// 2) Report card service
// ============================================================
put('apps/api/src/exams/report-card.service.ts', `import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import PDFDocument from 'pdfkit';

const GRADES = [
  { min: 16, letter: 'A', fr: 'Excellent', en: 'Excellent', ar: 'ممتاز' },
  { min: 14, letter: 'B', fr: 'Tres bien', en: 'Very good', ar: 'جيد جدا' },
  { min: 12, letter: 'C', fr: 'Bien',      en: 'Good',      ar: 'جيد' },
  { min: 10, letter: 'D', fr: 'Passable',  en: 'Pass',      ar: 'مقبول' },
  { min: 0,  letter: 'F', fr: 'Insuffisant', en: 'Fail',    ar: 'راسب' },
];

function gradeFor(avg: number) {
  return GRADES.find((g) => avg >= g.min) ?? GRADES[GRADES.length - 1];
}

const TITLES = {
  en: 'REPORT CARD',
  fr: 'BULLETIN DE NOTES',
  ar: 'كشف النقاط',
};

const LABELS = {
  en: {
    admission: 'Admission no', class: 'Class', exam: 'Exam',
    subject: 'Subject', coef: 'Coef', score: 'Score', max: 'Max',
    weighted: 'Weighted', remark: 'Remark',
    total: 'Total', average: 'Average', rank: 'Rank', decision: 'Decision',
    admitted: 'Admitted', repeat: 'Must repeat', signature: 'Signature & Stamp',
    issued: 'Issued on',
  },
  fr: {
    admission: 'Matricule', class: 'Classe', exam: 'Examen',
    subject: 'Matiere', coef: 'Coef', score: 'Note', max: 'Max',
    weighted: 'Ponderee', remark: 'Appreciation',
    total: 'Total', average: 'Moyenne', rank: 'Rang', decision: 'Decision',
    admitted: 'Admis', repeat: 'Redouble', signature: 'Signature & Cachet',
    issued: 'Emis le',
  },
  ar: {
    admission: 'رقم التسجيل', class: 'الفصل', exam: 'الامتحان',
    subject: 'المادة', coef: 'المعامل', score: 'العلامة', max: 'الاقصى',
    weighted: 'الموزونة', remark: 'ملاحظة',
    total: 'المجموع', average: 'المعدل', rank: 'الترتيب', decision: 'القرار',
    admitted: 'ناجح', repeat: 'يعيد السنة', signature: 'التوقيع والخاتم',
    issued: 'صدر في',
  },
};

function loc(v: string): 'en' | 'fr' | 'ar' {
  return v === 'en' || v === 'ar' ? v : 'fr';
}

@Injectable()
export class ReportCardService {
  constructor(private prisma: PrismaService) {}

  async render(examId: string, studentId: string, locale = 'fr'): Promise<NodeJS.ReadableStream> {
    const l = loc(locale);
    const L = LABELS[l];
    const title = TITLES[l];

    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: { class: true },
    });
    if (!exam) throw new NotFoundException('exam_not_found');

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { class: true },
    });
    if (!student) throw new NotFoundException('student_not_found');

    const school = await this.prisma.school.findUnique({ where: { id: exam.schoolId } });

    const marks = await this.prisma.mark.findMany({
      where: { examId, studentId },
      include: { subject: true },
    });

    // Compute average and rank
    let weighted = 0, coefSum = 0;
    for (const m of marks) {
      const p20 = (m.score / m.maxScore) * 20;
      weighted += p20 * m.coefficient;
      coefSum += m.coefficient;
    }
    const average = coefSum > 0 ? weighted / coefSum : 0;
    const grade = gradeFor(average);

    // Rank
    const classmates = await this.prisma.student.findMany({
      where: { classId: student.classId ?? undefined, isActive: true },
      select: { id: true },
    });
    const allMarks = await this.prisma.mark.findMany({
      where: { examId, studentId: { in: classmates.map((c) => c.id) } },
    });
    const byStudent = new Map<string, { w: number; c: number }>();
    for (const m of allMarks) {
      const p = byStudent.get(m.studentId) ?? { w: 0, c: 0 };
      p.w += (m.score / m.maxScore) * 20 * m.coefficient;
      p.c += m.coefficient;
      byStudent.set(m.studentId, p);
    }
    const ranking = Array.from(byStudent.entries())
      .map(([id, v]) => ({ id, avg: v.c > 0 ? v.w / v.c : 0 }))
      .sort((a, b) => b.avg - a.avg);
    const rank = ranking.findIndex((r) => r.id === studentId) + 1;
    const classSize = ranking.length;

    // Build PDF
    const doc = new PDFDocument({ size: 'A4', margin: 40 });

    // Header
    doc.fontSize(18).text(school?.name ?? 'School', { align: 'center' });
    if (school?.email) doc.fontSize(9).fillColor('#666').text(school.email, { align: 'center' });
    doc.moveDown(0.5);
    doc.fillColor('#000').fontSize(15).text(title, { align: 'center' });
    doc.moveDown(0.7);

    // Student block
    const top = doc.y;
    doc.fontSize(10);
    doc.text(student.firstName + ' ' + student.lastName, 40, top);
    doc.fontSize(9).fillColor('#555');
    doc.text(L.admission + ': ' + student.admissionNo, 40, top + 14);
    doc.text(L.class + ': ' + (student.class?.name ?? '-'), 40, top + 28);
    doc.text(L.exam + ': ' + exam.name, 40, top + 42);
    doc.fillColor('#000');
    doc.moveDown(4);

    // Table
    const startX = 40;
    const colX = [startX, startX + 200, startX + 250, startX + 300, startX + 350, startX + 400, startX + 460];
    const rowH = 20;
    let y = doc.y;

    doc.fontSize(9).fillColor('#fff').rect(startX, y, 500, rowH).fill('#0f766e');
    doc.fillColor('#fff');
    doc.text(L.subject, colX[0] + 4, y + 6, { width: 190 });
    doc.text(L.coef, colX[1], y + 6, { width: 40, align: 'center' });
    doc.text(L.score, colX[2], y + 6, { width: 40, align: 'center' });
    doc.text(L.max, colX[3], y + 6, { width: 40, align: 'center' });
    doc.text(L.weighted, colX[4], y + 6, { width: 50, align: 'center' });
    doc.text(L.remark, colX[5], y + 6, { width: 90 });
    y += rowH;

    doc.fillColor('#000');
    for (const m of marks) {
      const p20 = (m.score / m.maxScore) * 20;
      const w = p20 * m.coefficient;
      const g = gradeFor(p20);

      if (y > 720) { doc.addPage(); y = 40; }
      doc.rect(startX, y, 500, rowH).stroke('#e5e7eb');
      doc.text(m.subject.name, colX[0] + 4, y + 6, { width: 190 });
      doc.text(String(m.coefficient), colX[1], y + 6, { width: 40, align: 'center' });
      doc.text(m.score.toFixed(2), colX[2], y + 6, { width: 40, align: 'center' });
      doc.text(String(m.maxScore), colX[3], y + 6, { width: 40, align: 'center' });
      doc.text(w.toFixed(2), colX[4], y + 6, { width: 50, align: 'center' });
      doc.text(g.letter + ' - ' + (l === 'en' ? g.en : g.fr), colX[5], y + 6, { width: 90 });
      y += rowH;
    }
    doc.y = y + 10;

    // Summary box
    const sx = startX;
    const sw = 500;
    doc.rect(sx, doc.y, sw, 90).stroke('#0f766e');
    const sy = doc.y + 10;
    doc.fontSize(10).fillColor('#000');
    doc.text(L.total + ': ' + weighted.toFixed(2), sx + 10, sy);
    doc.text(L.average + ': ' + average.toFixed(2) + ' / 20', sx + 10, sy + 16);
    doc.text(L.rank + ': ' + rank + ' / ' + classSize, sx + 10, sy + 32);
    const decision = average >= 10 ? L.admitted : L.repeat;
    doc.fontSize(12).fillColor(average >= 10 ? '#0f766e' : '#b91c1c')
       .text(L.decision + ': ' + decision, sx + 10, sy + 52);

    doc.fontSize(9).fillColor('#000')
       .text(L.issued + ': ' + new Date().toLocaleDateString(), sx + 320, sy + 16);
    doc.text(L.signature + ':', sx + 320, sy + 50);
    doc.moveTo(sx + 320, sy + 78).lineTo(sx + 470, sy + 78).stroke();

    doc.end();
    return doc;
  }
}
`);

// ============================================================
// 3) Patch ExamsModule to include ReportCardService
// ============================================================
put('apps/api/src/exams/exams.module.ts', `import { Module } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { ExamsController } from './exams.controller';
import { ReportCardService } from './report-card.service';

@Module({
  providers: [ExamsService, ReportCardService],
  controllers: [ExamsController],
})
export class ExamsModule {}
`);

// ============================================================
// 4) Patch ExamsController — inject ReportCardService + add route
// ============================================================
put('apps/api/src/exams/exams.controller.ts', `import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ExamsService } from './exams.service';
import { ReportCardService } from './report-card.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import { createExamSchema, saveMarksSchema, CreateExamDto, SaveMarksDto } from '@school/shared';

@UseGuards(JwtAuthGuard)
@Controller('exams')
export class ExamsController {
  constructor(
    private svc: ExamsService,
    private reportCard: ReportCardService,
  ) {}

  @Get()
  list(@Req() req: any) { return this.svc.list(req.user.schoolId); }

  @Get(':id')
  get(@Param('id') id: string) { return this.svc.get(id); }

  @Post()
  create(@Req() req: any, @Body(new ZodValidationPipe(createExamSchema)) dto: CreateExamDto) {
    return this.svc.create(req.user.schoolId, dto);
  }

  @Get(':id/grid')
  grid(@Param('id') id: string, @Query('classId') classId: string) {
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
    return this.svc.results(id, classId);
  }

  @Get(':id/report-card/:studentId')
  async reportCardPdf(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @Query('locale') locale: string,
    @Res() res: Response,
  ) {
    const stream = await this.reportCard.render(id, studentId, locale || 'fr');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="bulletin-' + studentId + '.pdf"');
    stream.pipe(res);
  }
}
`);

console.log('\n✅ Report card PDF backend written');