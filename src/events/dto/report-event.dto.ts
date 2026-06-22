import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReportEventDto {
  @ApiProperty({
    description: '事件类型',
    example: 'reminder',
    enum: [
      'reminder',
      'login_after_absence',
      'festival', 'birthday',
      'custom',
    ],
  })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({
    description: '事件描述文本',
    example: '宝宝该打疫苗了，预约时间是明天上午',
  })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiPropertyOptional({
    description: '事件附加元数据，作为生成主动消息时的上下文，由调用方自定义。',
    example: {
      childName: '乐乐',
      dueDate: '2026-06-23',
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
