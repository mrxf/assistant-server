import { IsOptional, IsInt, Min, Max, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export type MessageStatusFilter = 'all' | 'read' | 'unread';

export class ListMessagesQueryDto {
  @ApiPropertyOptional({ description: '页码', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页条数', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @ApiPropertyOptional({
    description: '按已读状态筛选：all=全部，read=已读，unread=未读',
    enum: ['all', 'read', 'unread'],
    default: 'all',
  })
  @IsOptional()
  @IsIn(['all', 'read', 'unread'])
  status?: MessageStatusFilter = 'all';
}
