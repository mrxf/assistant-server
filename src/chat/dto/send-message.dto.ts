import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ description: '玩家发送的消息内容', example: '今天天气不错' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;
}
