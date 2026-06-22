import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Agent, RelationshipData } from '@innerlife/agent';
import { INITIAL_RELATIONSHIP } from '../agent.constants';

export interface RelationshipSnapshot {
  trustLevel: number;
  cooperationLevel: number;
  affinity: number;
  speakingStyle: string;
  overlayData: RelationshipData;
}

@Injectable()
export class RelationshipPersistenceService {
  private readonly logger = new Logger(RelationshipPersistenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async save(agent: Agent, playerId: string): Promise<void> {
    const overlay = agent.getRelationship(playerId);
    if (!overlay) return;

    const data = overlay.serialize();

    await this.prisma.relationshipState.upsert({
      where: { id: playerId },
      create: {
        id: playerId,
        trustLevel: data.trustLevel ?? INITIAL_RELATIONSHIP.trustLevel,
        cooperationLevel: data.cooperationLevel ?? INITIAL_RELATIONSHIP.cooperationLevel,
        affinity: overlay.computeAffinity() ?? INITIAL_RELATIONSHIP.affinity,
        speakingStyle: data.speakingStyle ?? INITIAL_RELATIONSHIP.speakingStyle,
        overlayData: JSON.stringify(data),
      },
      update: {
        trustLevel: data.trustLevel ?? INITIAL_RELATIONSHIP.trustLevel,
        cooperationLevel: data.cooperationLevel ?? INITIAL_RELATIONSHIP.cooperationLevel,
        affinity: overlay.computeAffinity() ?? INITIAL_RELATIONSHIP.affinity,
        speakingStyle: data.speakingStyle ?? INITIAL_RELATIONSHIP.speakingStyle,
        overlayData: JSON.stringify(data),
      },
    });

    this.logger.debug(`Relationship persisted for player: ${playerId}`);
  }

  async restore(playerId: string): Promise<RelationshipSnapshot | null> {
    const row = await this.prisma.relationshipState.findUnique({
      where: { id: playerId },
    });

    if (!row) return null;

    return {
      trustLevel: row.trustLevel,
      cooperationLevel: row.cooperationLevel,
      affinity: row.affinity,
      speakingStyle: row.speakingStyle,
      overlayData: JSON.parse(row.overlayData) as RelationshipData,
    };
  }

  async getCurrentRelationship(playerId: string): Promise<RelationshipSnapshot | null> {
    return this.restore(playerId);
  }

  async reset(playerId: string): Promise<void> {
    await this.prisma.relationshipState.deleteMany({ where: { id: playerId } });
    this.logger.log(`Relationship reset for player: ${playerId}`);
  }
}
