import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

    async login(email: string, password: string) {
    console.log('[LOGIN] email:', email, 'password length:', password?.length);
    const user = await this.prisma.user.findUnique({ where: { email } });
    console.log('[LOGIN] user found:', !!user, 'isActive:', user?.isActive);
    if (!user || !user.isActive) throw new UnauthorizedException('invalid_credentials');
    const ok = await bcrypt.compare(password, user.passwordHash);
    console.log('[LOGIN] password match:', ok);
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
