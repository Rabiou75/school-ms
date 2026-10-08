import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto, UpdateStaffDto } from '@school/shared';

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  list(schoolId: string) {
    return this.prisma.staff.findMany({
      where: { schoolId },
      include: { user: { select: { email: true, role: true } } },
      orderBy: [{ isActive: 'desc' }, { lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async create(schoolId: string, dto: CreateStaffDto) {
    const dup = await this.prisma.staff.findUnique({
      where: { schoolId_employeeNo: { schoolId, employeeNo: dto.employeeNo } },
    });
    if (dup) throw new ConflictException('employee_no_exists');
    return this.prisma.staff.create({
      data: {
        schoolId,
        employeeNo: dto.employeeNo,
        firstName: dto.firstName,
        lastName: dto.lastName,
        gender: dto.gender,
        position: dto.position,
        hireDate: new Date(dto.hireDate),
        baseSalary: dto.baseSalary,
      },
    });
  }

  async update(id: string, dto: UpdateStaffDto) {
    const exists = await this.prisma.staff.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('staff_not_found');
    return this.prisma.staff.update({
      where: { id },
      data: {
        ...dto,
        hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
      },
    });
  }

  async remove(id: string) {
    const exists = await this.prisma.staff.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('staff_not_found');
    return this.prisma.staff.update({ where: { id }, data: { isActive: false } });
  }
}
