import { IsString, IsOptional, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: '玩家昵称/称号', example: '刘皇叔' })
  @IsOptional()
  @IsString()
  nickname?: string;

  @ApiPropertyOptional({ description: '生日 (YYYY-MM-DD)', example: '1990-03-15' })
  @IsOptional()
  @IsString()
  birthday?: string;

  @ApiPropertyOptional({
    description: '自定义字段',
    example: { army_size: 50000, territory: '荆州' },
  })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
