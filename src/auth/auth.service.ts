import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AgentPoolService } from '../agent/agent-pool.service';
import { FIRST_GREETING } from '../agent/agent.constants';
import { InviteService } from './invite.service';
import type { RegisterDto } from './dto/register.dto';
import type { JwtPayload } from './decorators/current-player.decorator';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends TokenPair {
  player: { id: string; nickname: string; isAdmin: boolean };
}

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  private readonly refreshSecret: string;
  private readonly refreshTtl: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly agentPool: AgentPoolService,
    private readonly inviteService: InviteService,
  ) {
    this.refreshSecret = this.configService.get<string>('auth.jwtRefreshSecret')!;
    this.refreshTtl = this.configService.get<number>('auth.refreshTokenTtl')!;
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    await this.inviteService.validateAndConsume(dto.inviteCode);

    const existing = await this.prisma.player.findUnique({ where: { id: dto.username } });
    if (existing) {
      throw new ConflictException(`用户名 "${dto.username}" 已被占用`);
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const player = await this.prisma.player.create({
      data: {
        id: dto.username,
        passwordHash,
        nickname: dto.nickname ?? '',
      },
    });

    await this.agentPool.createAgent(dto.username);
    await this.prisma.dialogueEntry.create({
      data: { playerId: dto.username, role: 'outgoing', content: FIRST_GREETING, turnIndex: 0 },
    });

    const tokens = await this.issueTokenPair(player.id, player.isAdmin);

    return {
      ...tokens,
      player: { id: player.id, nickname: player.nickname, isAdmin: player.isAdmin },
    };
  }

  async login(username: string, password: string): Promise<AuthResponse> {
    const player = await this.prisma.player.findUnique({ where: { id: username } });
    if (!player) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const valid = await bcrypt.compare(password, player.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const tokens = await this.issueTokenPair(player.id, player.isAdmin);

    return {
      ...tokens,
      player: { id: player.id, nickname: player.nickname, isAdmin: player.isAdmin },
    };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const record = await this.prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!record || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh Token 无效或已过期');
    }

    let payload: { sub: string; isAdmin: boolean };
    try {
      payload = this.jwtService.verify(refreshToken, { secret: this.refreshSecret });
    } catch {
      throw new UnauthorizedException('Refresh Token 无效');
    }

    await this.prisma.refreshToken.delete({ where: { id: record.id } });

    return this.issueTokenPair(payload.sub, payload.isAdmin);
  }

  private async issueTokenPair(playerId: string, isAdmin: boolean): Promise<TokenPair> {
    const jwtPayload: Omit<JwtPayload, 'sub'> & { sub: string } = {
      sub: playerId,
      username: playerId,
      isAdmin,
    };

    const accessToken = this.jwtService.sign(jwtPayload);

    const refreshToken = this.jwtService.sign(
      { sub: playerId, isAdmin },
      { secret: this.refreshSecret, expiresIn: this.refreshTtl },
    );

    await this.cleanExpiredTokens(playerId);

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        playerId,
        expiresAt: new Date(Date.now() + this.refreshTtl * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  private async cleanExpiredTokens(playerId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { playerId, expiresAt: { lt: new Date() } },
    });
  }
}
