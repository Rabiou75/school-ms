import { BadRequestException, Controller, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'logos');
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

@UseGuards(JwtAuthGuard)
@Controller('settings/logo')
export class LogoController {
  constructor(private prisma: PrismaService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: UPLOAD_DIR,
      filename: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        cb(null, 'logo-' + Date.now() + ext);
      },
    }),
    limits: { fileSize: 2 * 1024 * 1024 },
  }))
  async upload(@Req() req: any, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('no_file');
    const publicUrl = '/uploads/logos/' + file.filename;
    await this.prisma.school.update({
      where: { id: req.user.schoolId },
      data: { logoUrl: publicUrl },
    });
    return { ok: true, logoUrl: publicUrl };
  }
}
