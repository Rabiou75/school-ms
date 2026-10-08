import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ExamsService } from './exams.service';
import { ReportCardService } from './report-card.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import { createExamSchema, saveMarksSchema, CreateExamDto, SaveMarksDto } from '@school/shared';

@UseGuards(JwtAuthGuard)
@Controller('exams')
export class ExamsController {
  constructor(
    private svc: ExamsService,
    private reportCard: ReportCardService,
  ) {}

  @Get()
  list(@Req() req: any) { return this.svc.list(req.user.schoolId); }

  @Get(':id')
  get(@Param('id') id: string) { return this.svc.get(id); }

  @Post()
  create(@Req() req: any, @Body(new ZodValidationPipe(createExamSchema)) dto: CreateExamDto) {
    return this.svc.create(req.user.schoolId, dto);
  }

  @Get(':id/grid')
  grid(@Param('id') id: string, @Query('classId') classId: string) {
    return this.svc.grid(id, classId);
  }

  @Post(':id/marks')
  saveMarks(
    @Req() req: any,
    @Param('id') examId: string,
    @Body(new ZodValidationPipe(saveMarksSchema)) dto: SaveMarksDto,
  ) {
    return this.svc.saveMarks(req.user.sub, examId, dto.entries);
  }

  @Get(':id/results')
  results(@Param('id') id: string, @Query('classId') classId: string) {
    return this.svc.results(id, classId);
  }

  @Get(':id/report-card/:studentId')
  async reportCardPdf(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @Query('locale') locale: string,
    @Res() res: Response,
  ) {
    const buffer = await this.reportCard.render(id, studentId, locale || 'fr');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Content-Disposition', 'attachment; filename="bulletin-' + studentId + '.pdf"');
    res.end(buffer);
  }
}
