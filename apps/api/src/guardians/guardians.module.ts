import { Module } from '@nestjs/common';
import { GuardiansService } from './guardians.service';
import { GuardiansController } from './guardians.controller';

@Module({
  providers: [GuardiansService],
  controllers: [GuardiansController],
})
export class GuardiansModule {}
