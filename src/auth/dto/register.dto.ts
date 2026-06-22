import { IsString, IsNotEmpty, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ description: '用户名（即 Player ID）', example: 'zhangsan' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: '用户名只能包含字母、数字、下划线和连字符' })
  username: string;

  @ApiProperty({ description: '密码（至少 8 位）', example: 'mypassword123' })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password: string;

  @ApiProperty({ description: '邀请码', example: 'ABC123' })
  @IsString()
  @IsNotEmpty()
  inviteCode: string;

  @ApiPropertyOptional({ description: '玩家昵称', example: '张三' })
  @IsOptional()
  @IsString()
  nickname?: string;
}
