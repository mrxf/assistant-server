import { Global, Module } from '@nestjs/common';
import { DevFileLoggerService } from './dev-file-logger.service';

/**
 * 全局通用能力模块。`@Global` 使其 provider 可在任意模块直接注入，无需重复 import。
 */
@Global()
@Module({
  providers: [DevFileLoggerService],
  exports: [DevFileLoggerService],
})
export class CommonModule {}
