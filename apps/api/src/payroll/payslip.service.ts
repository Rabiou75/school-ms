import { NotFoundException, Injectable } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import PDFDocument from 'pdfkit';

const FONT_CANDIDATES = [
  join(__dirname, '..', '..', 'assets'),
  join(__dirname, '..', '..', '..', 'assets'),
  join(process.cwd(), 'assets'),
  join(process.cwd(), 'apps', 'api', 'assets'),
];
function findAssetsDir(): string {
  for (const d of FONT_CANDIDATES) {
    try { if (existsSync(join(d, 'Amiri-Regular.ttf'))) return d; } catch {}
  }
  return '';
}
const ASSETS_DIR = findAssetsDir();
const AMIRI_REGULAR = ASSETS_DIR ? join(ASSETS_DIR, 'Amiri-Regular.ttf') : '';
const AMIRI_BOLD = ASSETS_DIR ? join(ASSETS_DIR, 'Amiri-Bold.ttf') : '';

function registerFonts(doc: any): boolean {
  if (!AMIRI_REGULAR || !AMIRI_BOLD) return false;
  if (!existsSync(AMIRI_REGULAR) || !existsSync(AMIRI_BOLD)) return false;
  try {
    doc.registerFont('Amiri', AMIRI_REGULAR);
    doc.registerFont('Amiri-Bold', AMIRI_BOLD);
    return true;
  } catch { return false; }
}

function bidi(text: string): string {
  if (!text) return text;
  const re = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g;
  const out: string[] = [];
  let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(text.slice(last, m.index));
    out.push(m[0].split('').reverse().join(''));
    last = m.index + m[0].length;
  }
  out.push(text.slice(last));
  return out.join('');
}

async function bufferFromDoc(doc: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

const TITLES = { en: 'PAYSLIP', fr: 'BULLETIN DE PAIE', ar: 'قسيمة الراتب' };

const LABELS = {
  en: {
    payslipNo: 'Payslip no', period: 'Period', issued: 'Issued on',
    employee: 'Employee', id: 'Employee no', position: 'Position',
    hireDate: 'Hire date', bank: 'Bank transfer',
    gross: 'Gross salary', deductions: 'Deductions', net: 'Net pay',
    amount: 'Amount', label: 'Label',
    total: 'Total net', signature: 'Signature & Stamp',
    confidential: 'Confidential document — for the employee only.',
  },
  fr: {
    payslipNo: 'Bulletin no', period: 'Periode', issued: 'Emis le',
    employee: 'Employe', id: 'Matricule', position: 'Poste',
    hireDate: 'Embauche', bank: 'Virement bancaire',
    gross: 'Salaire brut', deductions: 'Retenues', net: 'Net a payer',
    amount: 'Montant', label: 'Libelle',
    total: 'Net total', signature: 'Signature & Cachet',
    confidential: 'Document confidentiel — reserve a l\'employe.',
  },
  ar: {
    payslipNo: 'رقم القسيمة', period: 'الفترة', issued: 'صدر في',
    employee: 'الموظف', id: 'الرقم الوظيفي', position: 'المنصب',
    hireDate: 'تاريخ التعيين', bank: 'تحويل بنكي',
    gross: 'الراتب الإجمالي', deductions: 'الاستقطاعات', net: 'صافي الراتب',
    amount: 'المبلغ', label: 'البيان',
    total: 'الصافي', signature: 'التوقيع والخاتم',
    confidential: 'وثيقة سرية — للموظف فقط.',
  },
};

const MONTHS = {
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  fr: ['Janvier','Fevrier','Mars','Avril','Mai','Juin','Juillet','Aout','Septembre','Octobre','Novembre','Decembre'],
  ar: ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'],
};

function loc(v: string): 'en' | 'fr' | 'ar' {
  return v === 'en' || v === 'ar' ? v : 'fr';
}

function normalizeXAF(s: string): string {
  // Replace narrow/no-break spaces (U+202F, U+00A0, U+2009) with regular space
  // so Helvetica/Amiri can render them properly in the PDF.
  return s.replace(/[\u202F\u00A0\u2009]/g, ' ');
}

function fmtXAF(n: number) {
  const s = new Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(n);
  return normalizeXAF(s);
}

@Injectable()
export class PayslipService {
  constructor(private prisma: PrismaService) {}

  async render(itemId: string, locale = 'fr'): Promise<Buffer> {
    const l = loc(locale);
    const Lb = LABELS[l];
    const item = await this.prisma.payrollItem.findUnique({
      where: { id: itemId },
      include: { staff: true },
    });
    if (!item) throw new NotFoundException('payroll_item_not_found');

    const school = await this.prisma.school.findFirst({ where: { id: item.schoolId } });
    const s = item.staff;

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const hasArabic = registerFonts(doc);
    const isAr = String(l).trim().toLowerCase() === 'ar' && hasArabic;
    const fontName = isAr ? 'Amiri' : 'Helvetica';
    const fontBold = isAr ? 'Amiri-Bold' : 'Helvetica-Bold';
    const tr = (x: string) => (isAr ? bidi(x) : x);

    // Header
    doc.font(fontBold).fontSize(18).text(tr(school?.name ?? 'School'), { align: 'center' });
    if (school?.email) doc.font(fontName).fontSize(9).fillColor('#666').text(school.email, { align: 'center' });
    if (school?.address) doc.font(fontName).fontSize(9).fillColor('#666').text(school.address, { align: 'center' });
    doc.moveDown(0.5);
    doc.fillColor('#000').font(fontBold).fontSize(15).text(tr(TITLES[l]), { align: 'center' });
    doc.moveDown(0.7);

    // Payslip meta
    const year = item.year;
    const monthName = MONTHS[l][item.month - 1] || String(item.month);
    const payslipNo = 'PAY-' + year + '-' + String(item.month).padStart(2, '0') + '-' + s.employeeNo;

    const topY = doc.y;
    doc.font(fontName).fontSize(10);
    doc.text(tr(Lb.payslipNo) + ': ' + payslipNo, 40, topY);
    doc.text(tr(Lb.period) + ': ' + tr(monthName) + ' ' + year, 40, topY + 14);
    doc.text(tr(Lb.issued) + ': ' + new Date().toLocaleDateString(), 40, topY + 28);
    doc.moveTo(40, topY + 46).lineTo(555, topY + 46).stroke('#0f766e');
    doc.y = topY + 58;

    // Employee block
    const eY = doc.y;
    doc.font(fontBold).fontSize(11);
    doc.text(tr(s.firstName + ' ' + s.lastName), 40, eY);
    doc.font(fontName).fontSize(9).fillColor('#555');
    doc.text(tr(Lb.id) + ': ' + s.employeeNo, 40, eY + 16);
    doc.text(tr(Lb.position) + ': ' + tr(s.position), 40, eY + 30);
    doc.text(tr(Lb.hireDate) + ': ' + new Date(s.hireDate).toLocaleDateString(), 40, eY + 44);
    doc.fillColor('#000');
    doc.y = eY + 66;

    // Amount table
    const startX = 40;
    const rowH = 24;
    let y = doc.y;

    // Header row
    doc.rect(startX, y, 515, rowH).fill('#0f766e');
    doc.fillColor('#fff').font(fontBold).fontSize(10);
    doc.text(tr(Lb.label), startX + 8, y + 7);
    doc.text(tr(Lb.amount), 0, y + 7, { width: 555 - 8, align: 'right' });
    doc.fillColor('#000');
    y += rowH;

    const row = (label: string, value: string, bold = false) => {
      doc.rect(startX, y, 515, rowH).stroke('#e5e7eb');
      doc.font(bold ? fontBold : fontName).fontSize(10);
      doc.text(tr(label), startX + 8, y + 7);
      doc.text(value, 0, y + 7, { width: 555 - 8, align: 'right' });
      y += rowH;
    };

    row(Lb.gross, fmtXAF(item.grossPay));
    if (item.deductions > 0) row(Lb.deductions, '− ' + fmtXAF(item.deductions));

    // Net row (highlighted)
    doc.rect(startX, y, 515, rowH).fill('#e6fffa');
    doc.fillColor('#0f766e').font(fontBold).fontSize(12);
    doc.text(tr(Lb.net), startX + 8, y + 6);
    doc.text(fmtXAF(item.netPay), 0, y + 6, { width: 555 - 8, align: 'right' });
    doc.fillColor('#000');
    y += rowH;

    doc.y = y + 20;

    // Notes
    if (item.notes) {
      doc.font(fontName).fontSize(9).fillColor('#555').text(tr(item.notes), 40, doc.y);
      doc.fillColor('#000');
      doc.moveDown(1);
    }

    // Signature block
    const fY = Math.max(doc.y, 620);
    doc.font(fontName).fontSize(9).fillColor('#555');
    doc.text(tr(Lb.signature) + ':', 350, fY);
    doc.moveTo(350, fY + 30).lineTo(500, fY + 30).stroke();

    doc.fontSize(8).fillColor('#999').text(tr(Lb.confidential), 40, fY + 70, { align: 'center', width: 515 });

    return bufferFromDoc(doc);
  }
}
