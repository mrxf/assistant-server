import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Agent, BaseEmotionState } from '@innerlife/agent';

@Injectable()
export class EmotionPersistenceService {
  private readonly logger = new Logger(EmotionPersistenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async save(agent: Agent, playerId: string): Promise<void> {
    const state = agent.baseMood;
    const serialized = state.serialize();

    await this.prisma.emotionState.upsert({
      where: { id: playerId },
      create: {
        id: playerId,
        baseMoodState: JSON.stringify(serialized.state),
        baseline: JSON.stringify(serialized.baseline),
      },
      update: {
        baseMoodState: JSON.stringify(serialized.state),
        baseline: JSON.stringify(serialized.baseline),
      },
    });

    this.logger.debug(`Emotion persisted for player: ${playerId}`);
  }

  async restore(playerId: string): Promise<{ state: Record<string, number>; baseline: Record<string, number> } | null> {
    const row = await this.prisma.emotionState.findUnique({
      where: { id: playerId },
    });

    if (!row) return null;

    return {
      state: JSON.parse(row.baseMoodState),
      baseline: JSON.parse(row.baseline),
    };
  }

  async getCurrentEmotion(playerId: string): Promise<BaseEmotionState | null> {
    const row = await this.prisma.emotionState.findUnique({
      where: { id: playerId },
    });

    if (!row) return null;
    return JSON.parse(row.baseMoodState);
  }

  async reset(playerId: string): Promise<void> {
    await this.prisma.emotionState.deleteMany({ where: { id: playerId } });
    this.logger.log(`Emotion reset for player: ${playerId}`);
  }
}
