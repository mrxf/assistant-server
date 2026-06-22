import { IsOptional, IsInt, Min, Max, IsISO8601 } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ChatHistoryQueryDto {
  @ApiPropertyOptional({
    description:
      '游标：当前已加载列表中最旧一条的 timestamp（ISO 8601）。不传 = 拉取最新的一批（首屏）。',
    example: '2026-06-16T08:30:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  before?: string;

  @ApiPropertyOptional({ description: '本次返回条数', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
