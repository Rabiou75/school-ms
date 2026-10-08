import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import PDFDocument from 'pdfkit';

import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Robust font lookup: tries multiple locations relative to compiled output
const FONT_CANDIDATES = [
  join(__dirname, '..', '..', 'assets'),       // dist/payments -> apps/api/assets
  join(__dirname, '..', '..', '..', 'assets'), // dist/subdir/payments -> apps/api/assets
  join(process.cwd(), 'assets'),
  join(process.cwd(), 'apps', 'api', 'assets'),
];

function findAssetsDir(): string {
  for (const dir of FONT_CANDIDATES) {
    try { if (existsSync(join(dir, 'Amiri-Regular.ttf'))) return dir; } catch {}
  }
  return '';
}

const ASSETS_DIR = findAssetsDir();
const AMIRI_REGULAR = ASSETS_DIR ? join(ASSETS_DIR, 'Amiri-Regular.ttf') : '';
const AMIRI_BOLD    = ASSETS_DIR ? join(ASSETS_DIR, 'Amiri-Bold.ttf')    : '';

if (!ASSETS_DIR) console.warn('[pdf] Amiri fonts not found — Arabic will be garbled');
else console.log('[pdf] Amiri fonts loaded from: ' + ASSETS_DIR);

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


const TITLES = {
  en: 'PAYMENT RECEIPT',
  fr: 'RECU DE PAIEMENT',
  ar: 'ايصال دفع',
};

const LABELS = {
  en: {
    receipt: 'Receipt no', date: 'Date',
    student: 'Student', admission: 'Admission no', class: 'Class',
    invoice: 'Invoice', method: 'Payment method', reference: 'Reference',
    invoiceTotal: 'Invoice total', paidBefore: 'Previously paid',
    amountNow: 'Amount received', balanceAfter: 'Remaining balance',
    totalPaid: 'Total paid on this invoice',
    thankYou: 'Thank you for your payment.', signature: 'Signature & Stamp', cashier: 'Cashier',
  },
  fr: {
    receipt: 'Recu no', date: 'Date',
    student: 'Eleve', admission: 'Matricule', class: 'Classe',
    invoice: 'Facture', method: 'Moyen de paiement', reference: 'Reference',
    invoiceTotal: 'Total facture', paidBefore: 'Deja paye',
    amountNow: 'Montant recu', balanceAfter: 'Solde restant',
    totalPaid: 'Total paye sur cette facture',
    thankYou: 'Merci pour votre paiement.', signature: 'Signature & Cachet', cashier: 'Caissier',
  },
  ar: {
    receipt: 'رقم الإيصال', date: 'التاريخ',
    student: 'الطالب', admission: 'رقم التسجيل', class: 'الفصل',
    invoice: 'الفاتورة', method: 'طريقة الدفع', reference: 'المرجع',
    invoiceTotal: 'إجمالي الفاتورة', paidBefore: 'المدفوع سابقاً',
    amountNow: 'المبلغ المستلم', balanceAfter: 'الرصيد المتبقي',
    totalPaid: 'إجمالي المدفوع',
    thankYou: 'شكراً لدفعكم.', signature: 'التوقيع والخاتم', cashier: 'أمين الصندوق',
  },
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

function methodLabel(m: string): string {
  const map: Record<string, string> = {
    CASH: 'Especes / Cash',
    MTN_MOMO: 'MTN Mobile Money',
    ORANGE_MONEY: 'Orange Money',
    BANK_TRANSFER: 'Virement / Bank transfer',
    MOBILE_MONEY_MTN: 'MTN Mobile Money',
    MOBILE_MONEY_ORANGE: 'Orange Money',
    CHEQUE: 'Cheque',
    CARD: 'Carte / Card',
    OTHER: 'Autre / Other',
  };
  return map[m] || m;
}

@Injectable()
export class ReceiptService {
  constructor(private prisma: PrismaService) {}

  async render(paymentId: string, locale = 'fr'): Promise<Buffer> {
    const l = loc(locale);
    const TT = TITLES[l];
    const Lb = LABELS[l];

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        invoice: { include: { student: { include: { class: true } } } },
      },
    });
    if (!payment) throw new NotFoundException('payment_not_found');

    const invoice = payment.invoice;
    const student = invoice.student;
    const school = await this.prisma.school.findUnique({ where: { id: invoice.schoolId } });

    const allPayments = await this.prisma.payment.findMany({
      where: { invoiceId: invoice.id, status: 'SUCCESS' },
      orderBy: { paidAt: 'asc' },
    });
    let before = 0;
    for (const p of allPayments) {
      if (p.paidAt < payment.paidAt) before += p.amount;
    }
    const totalPaid = before + payment.amount;
    const balanceAfter = Math.max(0, invoice.total - totalPaid);

    const year = new Date(payment.paidAt).getFullYear();
    const seqCount = await this.prisma.payment.count({
      where: { schoolId: invoice.schoolId, paidAt: { lte: payment.paidAt } },
    });
    const receiptNo = 'RCP-' + year + '-' + String(seqCount).padStart(5, '0');

    const doc = new PDFDocument({ size: 'A5', margin: 40 });
    const hasArabic = registerFonts(doc);
    const isAr = String(l).trim().toLowerCase() === 'ar' && hasArabic;
    const fontName = isAr ? 'Amiri' : 'Helvetica';
    const fontBold = isAr ? 'Amiri-Bold' : 'Helvetica-Bold';
    const tr = (s: string) => (isAr ? bidi(s) : s);

    doc.font(fontBold).fontSize(16).text(tr(school?.name ?? 'School'), { align: 'center' });
    if (school?.email) doc.font(fontName).fontSize(8).fillColor('#666').text(school.email, { align: 'center' });
    doc.moveDown(0.5);
    doc.fillColor('#000').font(fontBold).fontSize(13).text(tr(TT), { align: 'center' });
    doc.moveDown(0.8);

    const topY = doc.y;
    doc.font(fontName).fontSize(9);
    doc.text(tr(Lb.receipt) + ': ' + receiptNo, 40, topY);
    doc.text(tr(Lb.date) + ': ' + new Date(payment.paidAt).toLocaleString(), 40, topY + 14);
    doc.moveTo(40, topY + 32).lineTo(555, topY + 32).stroke('#0f766e');
    doc.y = topY + 44;

    const sY = doc.y;
    doc.font(fontName).fontSize(10);
    doc.text(tr(student.firstName + ' ' + student.lastName), 40, sY);
    doc.fontSize(9).fillColor('#555');
    doc.text(tr(Lb.admission) + ': ' + student.admissionNo, 40, sY + 16);
    doc.text(tr(Lb.class) + ': ' + tr(student.class?.name ?? '-'), 40, sY + 30);
    doc.text(tr(Lb.invoice) + ': ' + invoice.invoiceNo, 40, sY + 44);
    doc.fillColor('#000');
    doc.y = sY + 62;

    const rowH = 22;
    const startX = 40;
    let y = doc.y;

    const row = (label: string, value: string, bold = false) => {
      doc.rect(startX, y, 515, rowH).stroke('#e5e7eb');
      doc.font(bold ? fontBold : fontName).fontSize(10);
      doc.text(tr(label), startX + 8, y + 6);
      doc.text(value, 0, y + 6, { width: 555 - 8, align: 'right' });
      y += rowH;
    };

    doc.rect(startX, y, 515, rowH).fill('#0f766e');
    doc.fillColor('#fff').font(fontBold).fontSize(10);
    doc.text(tr(Lb.amountNow), startX + 8, y + 6);
    doc.text(fmtXAF(payment.amount), 0, y + 6, { width: 555 - 8, align: 'right' });
    doc.fillColor('#000');
    y += rowH;

    row(Lb.invoiceTotal, fmtXAF(invoice.total));
    row(Lb.paidBefore, fmtXAF(before));
    row(Lb.totalPaid, fmtXAF(totalPaid), true);
    row(Lb.balanceAfter, fmtXAF(balanceAfter), true);

    doc.y = y + 12;

    doc.font(fontName).fontSize(9);
    doc.text(tr(Lb.method) + ': ' + methodLabel(payment.method), 40, doc.y);
    if (payment.reference) doc.text(tr(Lb.reference) + ': ' + payment.reference, 40, doc.y + 14);
    doc.moveDown(3);

    const fY = doc.y;
    doc.font(fontName).fontSize(9).fillColor('#555').text(tr(Lb.cashier) + ':', 40, fY + 20);
    doc.moveTo(40, fY + 46).lineTo(200, fY + 46).stroke();
    doc.text(tr(Lb.signature) + ':', 350, fY + 20);
    doc.moveTo(350, fY + 46).lineTo(500, fY + 46).stroke();
    doc.fontSize(8).fillColor('#999').text(tr(Lb.thankYou), 40, fY + 80, { align: 'center', width: 515 });

    return bufferFromDoc(doc);
  }
}
