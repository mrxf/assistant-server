import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentPoolService } from '../agent/agent-pool.service';
import { EmotionPersistenceService } from '../agent/emotion/emotion-persistence.service';
import { RelationshipPersistenceService } from '../agent/relationship/relationship-persistence.service';
import { WorldBookLoaderService } from '../agent/worldbook/worldbook-loader.service';

@Injectable()
export class DebugService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agentPool: AgentPoolService,
    private readonly emotionPersistence: EmotionPersistenceService,
    private readonly relationshipPersistence: RelationshipPersistenceService,
    private readonly worldbookLoader: WorldBookLoaderService,
  ) {}

  async getMemory(playerId: string) {
    const semanticFacts = await this.prisma.semanticFact.findMany({
      where: { playerId },
      orderBy: { updatedAt: 'desc' },
    });
    const episodes = await this.prisma.episodeRecord.findMany({
      where: { playerId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      semantic: semanticFacts,
      episodic: episodes.map((e) => ({
        ...e,
        emotionSnap: e.emotionSnap ? JSON.parse(e.emotionSnap) : null,
        actors: JSON.parse(e.actors),
      })),
    };
  }

  async getEmotion(playerId: string) {
    return this.emotionPersistence.getCurrentEmotion(playerId);
  }

  async getRelationship(playerId: string) {
    return this.relationshipPersistence.getCurrentRelationship(playerId);
  }

  async getWorldBook() {
    const entries = await this.worldbookLoader.loadAll();
    return {
      totalEntries: entries.length,
      entries: entries.map((e) => ({
        id: (e as any).id,
        name: (e as any).name,
        keywords: e.keywords,
        visibility: e.visibility,
        contentPreview: e.content?.substring(0, 100),
      })),
    };
  }

  async reset(playerId: string) {
    await this.agentPool.resetAgent(playerId);
    return { success: true, message: `Player ${playerId} data reset, agent re-initialized` };
  }

  async resetAll() {
    await this.agentPool.resetAll();
    return { success: true, message: 'All player data reset, agents re-initialized' };
  }
}
