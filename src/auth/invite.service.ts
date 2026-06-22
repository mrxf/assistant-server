import { Injectable, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface InviteCodeInfo {
  id: string;
  code: string;
  maxUses: number;
  usedCount: number;
  remaining: number;
  createdBy: string;
  createdAt: string;
}

@Injectable()
export class InviteService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createdBy: string, maxUses = 5): Promise<InviteCodeInfo> {
    const code = this.generateCode();
    const invite = await this.prisma.inviteCode.create({
      data: { code, maxUses, createdBy },
    });

    return this.toInfo(invite);
  }

  async list(): Promise<InviteCodeInfo[]> {
    const invites = await this.prisma.inviteCode.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return invites.map((inv) => this.toInfo(inv));
  }

  async validateAndConsume(code: string): Promise<void> {
    const invite = await this.prisma.inviteCode.findUnique({ where: { code } });

    if (!invite) {
      throw new BadRequestException('邀请码无效');
    }

    if (invite.usedCount >= invite.maxUses) {
      throw new BadRequestException('该邀请码已达到使用上限');
    }

    await this.prisma.inviteCode.update({
      where: { id: invite.id },
      data: { usedCount: { increment: 1 } },
    });
  }

  private generateCode(): string {
    return randomBytes(4).toString('hex').toUpperCase();
  }

  private toInfo(invite: {
    id: string;
    code: string;
    maxUses: number;
    usedCount: number;
    createdBy: string;
    createdAt: Date;
  }): InviteCodeInfo {
    return {
      id: invite.id,
      code: invite.code,
      maxUses: invite.maxUses,
      usedCount: invite.usedCount,
      remaining: invite.maxUses - invite.usedCount,
      createdBy: invite.createdBy,
      createdAt: invite.createdAt.toISOString(),
    };
  }
}
