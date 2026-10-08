import { Module } from '@nestjs/common';
import { BulkImportService } from './bulk-import.service';
import { BulkImportController } from './bulk-import.controller';

@Module({ providers: [BulkImportService], controllers: [BulkImportController] })
export class BulkImportModule {}
