import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LibraryService {
  constructor(private prisma: PrismaService) {}

  listBooks(schoolId: string, q?: string) {
    const where: any = { schoolId };
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { author: { contains: q, mode: 'insensitive' } },
        { isbn: { contains: q } },
        { category: { contains: q, mode: 'insensitive' } },
      ];
    }
    return this.prisma.book.findMany({ where, orderBy: { title: 'asc' }, take: 500 });
  }

  async createBook(schoolId: string, dto: any) {
    const total = Number(dto.totalCopies) || 1;
    return this.prisma.book.create({
      data: {
        schoolId,
        isbn: dto.isbn || null,
        title: dto.title,
        author: dto.author || null,
        publisher: dto.publisher || null,
        category: dto.category || null,
        shelf: dto.shelf || null,
        totalCopies: total,
        available: total,
      },
    });
  }

  async updateBook(id: string, dto: any) {
    const b = await this.prisma.book.findUnique({ where: { id } });
    if (!b) throw new NotFoundException('book_not_found');
    const data: any = {};
    for (const k of ['isbn', 'title', 'author', 'publisher', 'category', 'shelf']) {
      if (dto[k] !== undefined) data[k] = dto[k] || null;
    }
    if (dto.totalCopies !== undefined) {
      const borrowed = b.totalCopies - b.available;
      const newTotal = Number(dto.totalCopies);
      if (newTotal < borrowed) throw new BadRequestException('fewer_than_borrowed');
      data.totalCopies = newTotal;
      data.available = newTotal - borrowed;
    }
    return this.prisma.book.update({ where: { id }, data });
  }

  async removeBook(id: string) {
    const active = await this.prisma.bookLoan.count({ where: { bookId: id, status: 'BORROWED' } });
    if (active > 0) throw new BadRequestException('book_has_active_loans');
    await this.prisma.book.delete({ where: { id } });
    return { ok: true };
  }

  listLoans(schoolId: string, status?: string) {
    const where: any = { schoolId };
    if (status) where.status = status;
    return this.prisma.bookLoan.findMany({
      where,
      include: {
        book: { select: { id: true, title: true, author: true } },
        student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } },
      },
      orderBy: { borrowedAt: 'desc' },
      take: 500,
    });
  }

  async issue(schoolId: string, dto: any) {
    const book = await this.prisma.book.findUnique({ where: { id: dto.bookId } });
    if (!book) throw new NotFoundException('book_not_found');
    if (book.available <= 0) throw new BadRequestException('no_copies_available');
    const due = dto.dueDate ? new Date(dto.dueDate) : (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d; })();
    const loan = await this.prisma.bookLoan.create({
      data: { schoolId, bookId: dto.bookId, studentId: dto.studentId, dueDate: due, status: 'BORROWED', notes: dto.notes || null },
    });
    await this.prisma.book.update({ where: { id: book.id }, data: { available: book.available - 1 } });
    return loan;
  }

  async returnLoan(id: string, fine = 0) {
    const loan = await this.prisma.bookLoan.findUnique({ where: { id } });
    if (!loan) throw new NotFoundException('loan_not_found');
    if (loan.status === 'RETURNED') throw new BadRequestException('already_returned');
    await this.prisma.$transaction([
      this.prisma.bookLoan.update({
        where: { id },
        data: { status: 'RETURNED', returnedAt: new Date(), fine: Number(fine) || 0 },
      }),
      this.prisma.book.update({ where: { id: loan.bookId }, data: { available: { increment: 1 } } }),
    ]);
    return { ok: true };
  }

  async markOverdue(schoolId: string) {
    const now = new Date();
    const overdue = await this.prisma.bookLoan.findMany({
      where: { schoolId, status: 'BORROWED', dueDate: { lt: now } },
    });
    for (const l of overdue) {
      const daysLate = Math.floor((now.getTime() - l.dueDate.getTime()) / 86400000);
      const fine = daysLate * 100;
      await this.prisma.bookLoan.update({ where: { id: l.id }, data: { status: 'OVERDUE', fine } });
    }
    return { updated: overdue.length };
  }
}
