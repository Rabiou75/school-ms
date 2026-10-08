import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const put = (p, c) => {
  const full = join(root, p);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, c, 'utf8');
  console.log('  + ' + p);
};

put('apps/api/src/classes/classes.service.ts', `import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClassesService {
  constructor(private prisma: PrismaService) {}

  async list(schoolId: string) {
    const classes = await this.prisma.class.findMany({
      where: { schoolId },
      include: {
        academicYear: { select: { name: true } },
        _count: { select: { students: true } },
      },
      orderBy: { name: 'asc' },
    });
    return classes.map((c) => ({
      id: c.id,
      name: c.name,
      level: c.level,
      capacity: c.capacity,
      academicYear: c.academicYear?.name ?? null,
      studentCount: c._count.students,
    }));
  }
}
`);

put('apps/api/src/classes/classes.controller.ts', `import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('classes')
export class ClassesController {
  constructor(private svc: ClassesService) {}

  @Get()
  list(@Req() req: any) {
    return this.svc.list(req.user.schoolId);
  }
}
`);

put('apps/api/src/classes/classes.module.ts', `import { Module } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { ClassesController } from './classes.controller';

@Module({
  providers: [ClassesService],
  controllers: [ClassesController],
})
export class ClassesModule {}
`);

put('apps/api/src/app.module.ts', `import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { StudentsModule } from './students/students.module';
import { FinanceModule } from './finance/finance.module';
import { AttendanceModule } from './attendance/attendance.module';
import { ClassesModule } from './classes/classes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    PrismaModule,
    AuthModule,
    StudentsModule,
    FinanceModule,
    AttendanceModule,
    ClassesModule,
  ],
})
export class AppModule {}
`);

console.log('\n✅ Classes module written');