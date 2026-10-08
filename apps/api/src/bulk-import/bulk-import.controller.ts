import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { BulkImportService } from './bulk-import.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('bulk-import')
export class BulkImportController {
  constructor(private svc: BulkImportService) {}

  @Post('students/preview')
  preview(@Req() req: any, @Body() body: { rows: any[] }) {
    return this.svc.previewStudents(req.user.schoolId, body.rows || []);
  }

  @Post('students')
  importStudents(@Req() req: any, @Body() body: { rows: any[] }) {
    return this.svc.importStudents(req.user.schoolId, body.rows || []);
  }

  @Post('parents/generate')
  generateParents(@Req() req: any) {
    return this.svc.generateParentAccounts(req.user.schoolId);
  }
}
