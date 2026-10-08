import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { PayslipService } from './payslip.service';

@Module({
  providers: [PayrollService, PayslipService],
  controllers: [PayrollController],
})
export class PayrollModule {}
