import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const files = {};
const put = (p, c) => { files[p] = c; };

put('apps/api/package.json', `{
  "name": "api",
  "version": "0.1.0",
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main.js"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.4",
    "@nestjs/config": "^3.2.3",
    "@nestjs/core": "^10.4.4",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/platform-express": "^10.4.4",
    "@prisma/client": "^5.22.0",
    "@school/database": "workspace:*",
    "@school/shared": "workspace:*",
    "bcryptjs": "^2.4.3",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.5",
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^22.7.5",
    "@types/passport-jwt": "^4.0.1",
    "typescript": "^5.6.3"
  }
}
`);

put('apps/api/tsconfig.json', `{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "outDir": "./dist",
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "target": "ES2021"
  },
  "include": ["src"]
}
`);

put('apps/api/nest-cli.json', `{ "$schema": "https://json.schemastore.org/nest-cli", "collection": "@nestjs/schematics", "sourceRoot": "src" }
`);

put('apps/api/src/main.ts', `import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = process.env.API_PORT || 4000;
  await app.listen(port);
  console.log('API on http://localhost:' + port + '/api/v1');
}
bootstrap();
`);

put('apps/api/src/app.module.ts', `import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { StudentsModule } from './students/students.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    PrismaModule,
    AuthModule,
    StudentsModule,
  ],
})
export class AppModule {}
`);

put('apps/api/src/prisma/prisma.service.ts', `import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@school/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
`);

put('apps/api/src/prisma/prisma.module.ts', `import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
`);

put('apps/api/src/auth/auth.module.ts', `import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'dev_secret',
      signOptions: { expiresIn: process.env.JWT_ACCESS_TTL || '15m' },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
`);

put('apps/api/src/auth/auth.service.ts', `import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) throw new UnauthorizedException('invalid_credentials');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('invalid_credentials');

    const payload = { sub: user.id, email: user.email, role: user.role, schoolId: user.schoolId };
    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'dev_refresh',
      expiresIn: process.env.JWT_REFRESH_TTL || '7d',
    });
    const { passwordHash, ...safe } = user;
    return { accessToken, refreshToken, user: safe };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const { passwordHash, ...safe } = user;
    return safe;
  }
}
`);

put('apps/api/src/auth/auth.controller.ts', `import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { loginSchema } from '@school/shared';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login')
  login(@Body(new ZodValidationPipe(loginSchema)) dto: any) {
    return this.auth.login(dto.email, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: any) { return this.auth.me(req.user.sub); }
}
`);

put('apps/api/src/auth/strategies/jwt.strategy.ts', `import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_ACCESS_SECRET || 'dev_secret',
    });
  }
  validate(payload: any) { return payload; }
}
`);

put('apps/api/src/common/guards/jwt-auth.guard.ts', `import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
`);

put('apps/api/src/common/pipes/zod.pipe.ts', `import { PipeTransform, BadRequestException } from '@nestjs/common';

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: any) {}
  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return result.data;
  }
}
`);

put('apps/api/src/students/students.module.ts', `import { Module } from '@nestjs/common';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';

@Module({ providers: [StudentsService], controllers: [StudentsController] })
export class StudentsModule {}
`);

put('apps/api/src/students/students.service.ts', `import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  list(schoolId: string) {
    return this.prisma.student.findMany({
      where: { schoolId },
      include: { class: true, guardian: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async get(id: string) {
    const s = await this.prisma.student.findUnique({
      where: { id },
      include: { class: true, guardian: true },
    });
    if (!s) throw new NotFoundException('student_not_found');
    return s;
  }

  create(schoolId: string, dto: any) {
    return this.prisma.student.create({
      data: { ...dto, schoolId, dateOfBirth: new Date(dto.dateOfBirth) },
    });
  }

  update(id: string, dto: any) {
    return this.prisma.student.update({
      where: { id },
      data: dto.dateOfBirth ? { ...dto, dateOfBirth: new Date(dto.dateOfBirth) } : dto,
    });
  }

  remove(id: string) {
    return this.prisma.student.update({ where: { id }, data: { isActive: false } });
  }
}
`);

put('apps/api/src/students/students.controller.ts', `import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { StudentsService } from './students.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { createStudentSchema, updateStudentSchema } from '@school/shared';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';

@UseGuards(JwtAuthGuard)
@Controller('students')
export class StudentsController {
  constructor(private svc: StudentsService) {}

  @Get()
  list(@Req() req: any) { return this.svc.list(req.user.schoolId); }

  @Get(':id')
  get(@Param('id') id: string) { return this.svc.get(id); }

  @Post()
  create(@Req() req: any, @Body(new ZodValidationPipe(createStudentSchema)) dto: any) {
    return this.svc.create(req.user.schoolId, dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateStudentSchema)) dto: any) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.svc.remove(id); }
}
`);

let n = 0;
for (const [rel, content] of Object.entries(files)) {
  const full = join(root, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf8');
  n++;
  console.log('  + ' + rel);
}
console.log('\n✅ API: wrote ' + n + ' files');