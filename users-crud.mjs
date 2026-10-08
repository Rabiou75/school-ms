import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

// ============================================================
// 1. Extend SettingsService with user CRUD
// ============================================================
const svcPath = join(root, 'apps/api/src/settings/settings.service.ts');
let svc = readFileSync(svcPath, 'utf8');

// Add ConflictException to imports if missing
if (!svc.includes('ConflictException')) {
  svc = svc.replace(
    "import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';",
    "import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';"
  );
}

// Replace the existing user-related methods with the full set
const oldBlock = `  // ---------- Users & roles ----------
  listUsers(schoolId: string) {
    return this.prisma.user.findMany({
      where: { schoolId },
      select: {
        id: true, email: true, phone: true,
        firstName: true, lastName: true,
        role: true, isActive: true,
        lastLoginAt: true, createdAt: true,
      },
      orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
    });
  }

  async updateUser(id: string, dto: { role?: string; isActive?: boolean }) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('user_not_found');
    const data: any = {};
    if (dto.role) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    return this.prisma.user.update({ where: { id }, data });
  }

  async resetUserPassword(id: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) throw new BadRequestException('password_too_short');
    const hash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id }, data: { passwordHash: hash } });
    return { ok: true };
  }`;

const newBlock = `  // ---------- Users & roles ----------
  listUsers(schoolId: string) {
    return this.prisma.user.findMany({
      where: { schoolId },
      select: {
        id: true, email: true, phone: true,
        firstName: true, lastName: true, locale: true,
        role: true, isActive: true,
        lastLoginAt: true, createdAt: true,
      },
      orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
    });
  }

  async createUser(schoolId: string, dto: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: string;
    phone?: string;
    locale?: string;
  }) {
    if (!dto.email) throw new BadRequestException('email_required');
    if (!dto.password || dto.password.length < 8) throw new BadRequestException('password_too_short');
    if (!dto.firstName || !dto.lastName) throw new BadRequestException('name_required');

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('email_already_registered');

    const hash = await bcrypt.hash(dto.password, 10);
    const u = await this.prisma.user.create({
      data: {
        schoolId,
        email: dto.email,
        passwordHash: hash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role as any,
        phone: dto.phone || null,
        locale: dto.locale || 'fr',
      },
    });
    const { passwordHash, ...safe } = u;
    return safe;
  }

  async updateUser(id: string, dto: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    role?: string;
    isActive?: boolean;
    locale?: string;
  }, currentUserId: string) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('user_not_found');

    // Guardrail: cannot demote yourself from SUPER_ADMIN
    if (u.id === currentUserId && u.role === 'SUPER_ADMIN' && dto.role && dto.role !== 'SUPER_ADMIN') {
      throw new BadRequestException('cannot_demote_self');
    }
    // Guardrail: cannot deactivate yourself
    if (u.id === currentUserId && dto.isActive === false) {
      throw new BadRequestException('cannot_deactivate_self');
    }
    // Guardrail: cannot demote the last active SUPER_ADMIN
    if (u.role === 'SUPER_ADMIN' && dto.role && dto.role !== 'SUPER_ADMIN') {
      const count = await this.prisma.user.count({
        where: { schoolId: u.schoolId, role: 'SUPER_ADMIN', isActive: true },
      });
      if (count <= 1) throw new BadRequestException('last_super_admin');
    }

    const data: any = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.phone !== undefined) data.phone = dto.phone || null;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.locale !== undefined) data.locale = dto.locale;

    if (dto.email !== undefined && dto.email !== u.email) {
      const dup = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (dup) throw new ConflictException('email_already_registered');
      data.email = dto.email;
    }

    const updated = await this.prisma.user.update({ where: { id }, data });
    const { passwordHash, ...safe } = updated;
    return safe;
  }

  async deleteUser(id: string, currentUserId: string) {
    if (id === currentUserId) throw new BadRequestException('cannot_delete_self');

    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('user_not_found');

    if (u.role === 'SUPER_ADMIN') {
      const count = await this.prisma.user.count({
        where: { schoolId: u.schoolId, role: 'SUPER_ADMIN', isActive: true },
      });
      if (count <= 1) throw new BadRequestException('last_super_admin');
    }

    // Check for linked records that would block a hard delete
    const [guardians, staff, students] = await Promise.all([
      this.prisma.guardian.count({ where: { userId: id } }),
      this.prisma.staff.count({ where: { userId: id } }),
      this.prisma.student.count({ where: { userId: id } }),
    ]);

    if (guardians + staff + students > 0) {
      // Cannot hard-delete — deactivate instead so history is preserved
      await this.prisma.user.update({ where: { id }, data: { isActive: false } });
      return {
        ok: true,
        mode: 'deactivated',
        reason: 'has_linked_records',
        linked: { guardians, staff, students },
      };
    }

    await this.prisma.user.delete({ where: { id } });
    return { ok: true, mode: 'deleted' };
  }

  async resetUserPassword(id: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) throw new BadRequestException('password_too_short');
    const hash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id }, data: { passwordHash: hash } });
    return { ok: true };
  }`;

if (svc.includes(oldBlock)) {
  svc = svc.replace(oldBlock, newBlock);
  console.log('  + settings.service.ts — user CRUD extended');
} else if (svc.includes('async createUser(')) {
  console.log('  = user CRUD already present');
} else {
  console.log('  ! could not locate Users block — manual inspection needed');
}

writeFileSync(svcPath, svc, 'utf8');

// ============================================================
// 2. Extend controller with the new endpoints
// ============================================================
const ctrlPath = join(root, 'apps/api/src/settings/settings.controller.ts');
let ctrl = readFileSync(ctrlPath, 'utf8');

const oldCtrl = `  // --- Users & roles ---
  @Get('users')
  listUsers(@Req() req: any) { return this.svc.listUsers(req.user.schoolId); }

  @Put('users/:id')
  updateUser(@Param('id') id: string, @Body() dto: any) { return this.svc.updateUser(id, dto); }

  @Post('users/:id/reset-password')
  resetPassword(@Param('id') id: string, @Body() body: { newPassword: string }) {
    return this.svc.resetUserPassword(id, body.newPassword);
  }`;

const newCtrl = `  // --- Users & roles ---
  @Get('users')
  listUsers(@Req() req: any) { return this.svc.listUsers(req.user.schoolId); }

  @Post('users')
  createUser(@Req() req: any, @Body() dto: any) {
    return this.svc.createUser(req.user.schoolId, dto);
  }

  @Put('users/:id')
  updateUser(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateUser(id, dto, req.user.sub);
  }

  @Delete('users/:id')
  deleteUser(@Req() req: any, @Param('id') id: string) {
    return this.svc.deleteUser(id, req.user.sub);
  }

  @Post('users/:id/reset-password')
  resetPassword(@Param('id') id: string, @Body() body: { newPassword: string }) {
    return this.svc.resetUserPassword(id, body.newPassword);
  }`;

if (ctrl.includes(oldCtrl)) {
  ctrl = ctrl.replace(oldCtrl, newCtrl);
  console.log('  + settings.controller.ts — new routes added');
} else if (ctrl.includes('createUser')) {
  console.log('  = controller already extended');
}

// Ensure Delete is imported
if (!ctrl.match(/import\s*\{[^}]*Delete[^}]*\}\s*from\s*'@nestjs\/common'/)) {
  ctrl = ctrl.replace(
    /import\s*\{([^}]*)\}\s*from\s*'@nestjs\/common';/,
    (_m, names) => `import { ${names.trim()}, Delete } from '@nestjs/common';`
  );
  console.log('  + Delete import added');
}

writeFileSync(ctrlPath, ctrl, 'utf8');

console.log('\n✅ Backend user CRUD written');
console.log('\nNext:');
console.log('  cd apps\\api && npx nest build && cd ..\\..');
console.log('  .\\kill-dev.ps1 ; pnpm dev');
console.log('  Then run users-crud-ui.mjs (I will send next)');