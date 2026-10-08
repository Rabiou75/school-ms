import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const path = join(root, 'apps/api/src/exams/report-card.service.ts');

const content = `import { Injectable, NotFoundException } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import PDFDocument from 'pdfkit';

const FONT_DIR = join(process.cwd(), 'apps', 'api', 'assets');
const AMIRI_REGULAR = join(FONT_DIR, 'Amiri-Regular.ttf');
const AMIRI_BOLD = join(FONT_DIR, 'Amiri-Bold.ttf');

function registerFonts(doc: PDFKit.PDFDocument): boolean {
  if (!existsSync(AMIRI_REGULAR) || !existsSync(AMIRI_BOLD)) return false;
  try {
    doc.registerFont('Amiri', AMIRI_REGULAR);
    doc.registerFont('Amiri-Bold', AMIRI_BOLD);
    return true;
  } catch {
    return false;
  }
}

/**
 * Naive bidi reversal for Arabic text runs.
 * PDFKit has no shaping engine, so this only reverses codepoint order
 * for Arabic ranges while keeping Latin/numerals in place. Readable but
 * not ligature-correct.
 */
function bidi(text: string): string {
  if (!text) return text;
  const re = /[\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF]+/g;
  const out: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(text.slice(last, m.index));
    out.push(m[0].split('').reverse().join(''));
    last = m.index + m[0].length;
  }
  out.push(text.slice(last));
  return out.join('');
}

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

    let weighted = 0, coefSum = 0;
    for (const m of marks) {
      const p20 = (m.score / m.maxScore) * 20;
      weighted += p20 * m.coefficient;
      coefSum += m.coefficient;
    }
    const average = coefSum > 0 ? weighted / coefSum : 0;
    const grade = gradeFor(average);

    // Rank within class
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

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const hasArabic = registerFonts(doc);
    const isAr = l === 'ar' && hasArabic;
    const fontName = isAr ? 'Amiri' : 'Helvetica';
    const fontBold = isAr ? 'Amiri-Bold' : 'Helvetica-Bold';
    const tr = (s: string) => (isAr ? bidi(s) : s);

    // Header
    doc.font(fontBold).fontSize(18).text(tr(school?.name ?? 'School'), { align: 'center' });
    if (school?.email) doc.font(fontName).fontSize(9).fillColor('#666').text(school.email, { align: 'center' });
    doc.moveDown(0.5);
    doc.fillColor('#000').font(fontBold).fontSize(15).text(tr(title), { align: 'center' });
    doc.moveDown(0.7);

    // Student block
    const top = doc.y;
    doc.font(fontName).fontSize(10);
    doc.text(tr(student.firstName + ' ' + student.lastName), 40, top);
    doc.fontSize(9).fillColor('#555');
    doc.text(tr(L.admission) + ': ' + student.admissionNo, 40, top + 14);
    doc.text(tr(L.class) + ': ' + tr(student.class?.name ?? '-'), 40, top + 28);
    doc.text(tr(L.exam) + ': ' + tr(exam.name), 40, top + 42);
    doc.fillColor('#000');
    doc.moveDown(4);

    // Table
    const startX = 40;
    const colX = [startX, startX + 200, startX + 250, startX + 300, startX + 350, startX + 400, startX + 460];
    const rowH = 20;
    let y = doc.y;

    doc.font(fontBold).fontSize(9).fillColor('#fff').rect(startX, y, 500, rowH).fill('#0f766e');
    doc.fillColor('#fff');
    doc.text(tr(L.subject), colX[0] + 4, y + 6, { width: 190 });
    doc.text(tr(L.coef), colX[1], y + 6, { width: 40, align: 'center' });
    doc.text(tr(L.score), colX[2], y + 6, { width: 40, align: 'center' });
    doc.text(tr(L.max), colX[3], y + 6, { width: 40, align: 'center' });
    doc.text(tr(L.weighted), colX[4], y + 6, { width: 50, align: 'center' });
    doc.text(tr(L.remark), colX[5], y + 6, { width: 90 });
    y += rowH;

    doc.fillColor('#000');
    for (const m of marks) {
      const p20 = (m.score / m.maxScore) * 20;
      const w = p20 * m.coefficient;
      const g = gradeFor(p20);

      if (y > 720) { doc.addPage(); y = 40; }
      doc.font(fontName).rect(startX, y, 500, rowH).stroke('#e5e7eb');
      doc.text(tr(m.subject.name), colX[0] + 4, y + 6, { width: 190 });
      doc.text(String(m.coefficient), colX[1], y + 6, { width: 40, align: 'center' });
      doc.text(m.score.toFixed(2), colX[2], y + 6, { width: 40, align: 'center' });
      doc.text(String(m.maxScore), colX[3], y + 6, { width: 40, align: 'center' });
      doc.text(w.toFixed(2), colX[4], y + 6, { width: 50, align: 'center' });
      const gradeText = g.letter + ' - ' + (l === 'en' ? g.en : l === 'ar' ? g.ar : g.fr);
      doc.text(tr(gradeText), colX[5], y + 6, { width: 90 });
      y += rowH;
    }
    doc.y = y + 10;

    // Summary box
    const sx = startX;
    const sw = 500;
    doc.rect(sx, doc.y, sw, 90).stroke('#0f766e');
    const sy = doc.y + 10;
    doc.font(fontName).fontSize(10).fillColor('#000');
    doc.text(tr(L.total) + ': ' + weighted.toFixed(2), sx + 10, sy);
    doc.text(tr(L.average) + ': ' + average.toFixed(2) + ' / 20', sx + 10, sy + 16);
    doc.text(tr(L.rank) + ': ' + rank + ' / ' + classSize, sx + 10, sy + 32);
    const decision = average >= 10 ? L.admitted : L.repeat;
    doc.font(fontBold).fontSize(12)
       .fillColor(average >= 10 ? '#0f766e' : '#b91c1c')
       .text(tr(L.decision) + ': ' + tr(decision), sx + 10, sy + 52);

    doc.font(fontName).fontSize(9).fillColor('#000')
       .text(tr(L.issued) + ': ' + new Date().toLocaleDateString(), sx + 320, sy + 16);
    doc.text(tr(L.signature) + ':', sx + 320, sy + 50);
    doc.moveTo(sx + 320, sy + 78).lineTo(sx + 470, sy + 78).stroke();

    doc.end();
    return doc;
  }
}
`;

writeFileSync(path, content, 'utf8');
console.log('✅ report-card.service.ts rewritten from scratch');
console.log('   Arabic support: Amiri fonts (loaded from apps/api/assets/)');
console.log('   Falls back to Helvetica if fonts missing.');