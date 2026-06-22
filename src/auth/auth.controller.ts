import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { InviteService } from './invite.service';
import { Public, AdminOnly, CurrentPlayer } from './decorators';
import type { JwtPayload } from './decorators';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { CreateInviteDto } from './dto/create-invite.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly inviteService: InviteService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: '用户注册（需邀请码）' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登录' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刷新 Access Token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @AdminOnly()
  @ApiBearerAuth()
  @Post('invite')
  @ApiOperation({ summary: '生成邀请码（管理员）' })
  async createInvite(
    @CurrentPlayer() player: JwtPayload,
    @Body() dto: CreateInviteDto,
  ) {
    return this.inviteService.create(player.sub, dto.maxUses);
  }

  @AdminOnly()
  @ApiBearerAuth()
  @Get('invites')
  @ApiOperation({ summary: '查看所有邀请码（管理员）' })
  async listInvites() {
    return this.inviteService.list();
  }
}
