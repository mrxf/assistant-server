import { Module } from '@nestjs/common';
import { MemoryImportService } from './memory-import.service';

@Module({
  providers: [MemoryImportService],
  exports: [MemoryImportService],
})
export class MemoryImportModule {}
