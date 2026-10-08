import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { LibraryService } from './library.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('library')
export class LibraryController {
  constructor(private svc: LibraryService) {}

  @Get('books')
  listBooks(@Req() req: any, @Query('q') q?: string) { return this.svc.listBooks(req.user.schoolId, q); }

  @Post('books')
  createBook(@Req() req: any, @Body() dto: any) { return this.svc.createBook(req.user.schoolId, dto); }

  @Put('books/:id')
  updateBook(@Param('id') id: string, @Body() dto: any) { return this.svc.updateBook(id, dto); }

  @Delete('books/:id')
  removeBook(@Param('id') id: string) { return this.svc.removeBook(id); }

  @Get('loans')
  listLoans(@Req() req: any, @Query('status') status?: string) { return this.svc.listLoans(req.user.schoolId, status); }

  @Post('loans')
  issue(@Req() req: any, @Body() dto: any) { return this.svc.issue(req.user.schoolId, dto); }

  @Post('loans/:id/return')
  returnLoan(@Param('id') id: string, @Body() body: { fine?: number }) { return this.svc.returnLoan(id, body.fine); }

  @Post('loans/mark-overdue')
  markOverdue(@Req() req: any) { return this.svc.markOverdue(req.user.schoolId); }
}
