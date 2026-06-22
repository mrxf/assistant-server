import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePlayerDto {
  @ApiProperty({ description: 'Player 唯一标识', example: 'zhangsan' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiPropertyOptional({ description: '玩家昵称', example: '张三' })
  @IsOptional()
  @IsString()
  nickname?: string;
}
