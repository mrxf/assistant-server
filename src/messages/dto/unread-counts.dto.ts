import {
  IsArray,
  ArrayNotEmpty,
  ArrayMaxSize,
  IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UnreadCountsDto {
  @ApiProperty({
    description: '要查询未读消息数的玩家 ID 列表',
    type: [String],
    example: ['xiaoman'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  playerIds!: string[];
}
