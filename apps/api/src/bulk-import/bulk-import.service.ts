import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BulkImportService {
  private readonly logger = new Logger(BulkImportService.name);
  constructor(private prisma: PrismaService) {}

  private normGender(g?: string): 'MALE' | 'FEMALE' | 'OTHER' {
    const v = (g || 'MALE').toUpperCase().trim();
    if (v.startsWith('F') || v === 'FEMME') return 'FEMALE';
    if (v.startsWith('M') || v === 'HOMME') return 'MALE';
    return 'OTHER';
  }

  async importStudents(schoolId: string, rows: any[]) {
    if (!Array.isArray(rows) || rows.length === 0) throw new BadRequestException('no_rows');
    if (rows.length > 2000) throw new BadRequestException('too_many_rows_max_2000');
    const classes = await this.prisma.class.findMany({ where: { schoolId } });
    const classByName = new Map(classes.map((c) => [c.name.toLowerCase().trim(), c.id]));
    const results = { created: 0, skipped: 0, errors: [] as any[], parentAccountsCreated: 0 };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.firstName || !row.lastName) {
          results.errors.push({ row: i + 1, reason: 'missing_name' });
          continue;
        }
        let admissionNo = (row.admissionNo || '').trim();
        if (!admissionNo) {
          const prefix = 'STU-' + new Date().getFullYear() + '-';
          const last = await this.prisma.student.findFirst({
            where: { schoolId, admissionNo: { startsWith: prefix } },
            orderBy: { admissionNo: 'desc' },
          });
          const n = last ? parseInt(last.admissionNo.slice(prefix.length), 10) + 1 : 1;
          admissionNo = prefix + String(n).padStart(4, '0');
        }
        const exists = await this.prisma.student.findUnique({
          where: { schoolId_admissionNo: { schoolId, admissionNo } },
        });
        if (exists) {
          results.skipped++;
          results.errors.push({ row: i + 1, reason: 'duplicate_admission_no' });
          continue;
        }
        let guardianId: string | null = null;
        if (row.guardianFirstName && row.guardianPhone) {
          const g = await this.prisma.guardian.findFirst({
            where: { schoolId, firstName: row.guardianFirstName, phone: row.guardianPhone },
          });
          if (g) guardianId = g.id;
          else {
            const created = await this.prisma.guardian.create({
              data: {
                schoolId,
                firstName: row.guardianFirstName,
                lastName: row.guardianLastName || row.lastName,
                relation: row.guardianRelation || 'Pere',
                phone: row.guardianPhone,
              },
            });
            guardianId = created.id;
          }
        }
        const classId = row.className ? classByName.get(row.className.toLowerCase().trim()) ?? null : null;
        const dob = row.dateOfBirth ? new Date(row.dateOfBirth) : new Date(2010, 0, 1);
        await this.prisma.student.create({
          data: {
            schoolId,
            admissionNo,
            firstName: row.firstName.trim(),
            lastName: row.lastName.trim(),
            gender: this.normGender(row.gender),
            dateOfBirth: isNaN(dob.getTime()) ? new Date(2010, 0, 1) : dob,
            classId,
            guardianId,
            phone: row.phone?.trim() || null,
            email: row.email?.trim() || null,
          },
        });
        results.created++;
      } catch (e: any) {
        results.errors.push({ row: i + 1, reason: e.message || 'unknown' });
      }
    }
    return results;
  }

  async previewStudents(schoolId: string, rows: any[]) {
    const classes = await this.prisma.class.findMany({ where: { schoolId } });
    const classByName = new Map(classes.map((c) => [c.name.toLowerCase().trim(), c.name]));
    return rows.map((r, i) => {
      const issues: string[] = [];
      if (!r.firstName) issues.push('missing firstName');
      if (!r.lastName) issues.push('missing lastName');
      if (r.className && !classByName.has(r.className.toLowerCase().trim())) issues.push('unknown class: ' + r.className);
      return { row: i + 1, input: r, issues, willCreate: issues.length === 0 };
    });
  }

  async generateParentAccounts(schoolId: string) {
    const guardians = await this.prisma.guardian.findMany({
      where: { schoolId, userId: null },
      include: { students: { where: { isActive: true }, select: { id: true } } },
    });
    const generated: any[] = [];
    const skipped: any[] = [];
    for (const g of guardians) {
      try {
        if (!g.phone) { skipped.push({ guardian: g.firstName + ' ' + g.lastName, reason: 'no_phone' }); continue; }
        const base = (g.firstName + '.' + g.lastName).toLowerCase().replace(/[^a-z0-9]/g, '');
        const suffix = (g.phone || '').replace(/\D/g, '').slice(-4) || String(Math.floor(Math.random() * 9000) + 1000);
        let email = base + suffix + '@school.local';
        let attempt = 0;
        while (await this.prisma.user.findUnique({ where: { email } })) {
          attempt++;
          email = base + suffix + '-' + attempt + '@school.local';
          if (attempt > 5) throw new Error('could_not_generate_unique_email');
        }
        const rawPw = this.generatePassword();
        const hash = await bcrypt.hash(rawPw, 10);
        const user = await this.prisma.user.create({
          data: {
            schoolId,
            email,
            passwordHash: hash,
            firstName: g.firstName,
            lastName: g.lastName,
            phone: g.phone,
            role: 'PARENT',
            locale: 'fr',
          },
        });
        await this.prisma.guardian.update({ where: { id: g.id }, data: { userId: user.id } });
        generated.push({ guardian: g.firstName + ' ' + g.lastName, email, password: rawPw, childCount: g.students.length });
      } catch (e: any) {
        skipped.push({ guardian: g.firstName + ' ' + g.lastName, reason: e.message });
      }
    }
    return { generated, skipped, totalGuardiansWithoutAccount: guardians.length };
  }

  private generatePassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let s = '';
    for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }
}
