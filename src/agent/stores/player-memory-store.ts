import { Logger } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type {
  CanonicalStore,
  SemanticFact,
  EpisodeRecord,
  ProspectiveItem,
  MemoryMutation,
  SemanticQuery,
  EpisodeQuery,
  ProspectiveQuery,
  CommitResult,
} from '@innerlife/agent';

/**
 * Per-player CanonicalStore backed by Prisma.
 * Each instance is scoped to a specific playerId — all memory
 * reads/writes are isolated per player.
 */
export class PlayerMemoryStore implements CanonicalStore {
  private readonly logger: Logger;

  constructor(
    private readonly prisma: PrismaService,
    private readonly playerId: string,
  ) {
    this.logger = new Logger(`PlayerMemoryStore:${playerId}`);
  }

  async apply(mutations: MemoryMutation[]): Promise<CommitResult> {
    let mutationsApplied = 0;
    const errors: string[] = [];

    for (const mutation of mutations) {
      try {
        await this.applyMutation(mutation);
        mutationsApplied++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to apply mutation: ${msg}`);
        errors.push(msg);
      }
    }

    return { success: errors.length === 0, mutationsApplied, errors };
  }

  async getSemantic(query: SemanticQuery): Promise<SemanticFact[]> {
    const where: Record<string, unknown> = { playerId: this.playerId };
    if (query.category) where.category = query.category;

    const rows = await this.prisma.semanticFact.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: query.limit ?? 50,
    });

    return rows.map((r) => this.rowToSemanticFact(r));
  }

  async getSemanticByKey(key: string): Promise<SemanticFact | null> {
    const row = await this.prisma.semanticFact.findFirst({
      where: { key, playerId: this.playerId },
    });
    return row ? this.rowToSemanticFact(row) : null;
  }

  async getEpisodes(query: EpisodeQuery): Promise<EpisodeRecord[]> {
    const rows = await this.prisma.episodeRecord.findMany({
      where: { playerId: this.playerId },
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 20,
    });

    return rows.map((r) => this.rowToEpisodeRecord(r));
  }

  async getEpisodeById(id: string): Promise<EpisodeRecord | null> {
    const row = await this.prisma.episodeRecord.findUnique({ where: { id } });
    if (!row || row.playerId !== this.playerId) return null;
    return this.rowToEpisodeRecord(row);
  }

  async getProspectives(_query: ProspectiveQuery): Promise<ProspectiveItem[]> {
    return [];
  }

  async getProspectiveById(_id: string): Promise<ProspectiveItem | null> {
    return null;
  }

  private rowToSemanticFact(r: any): SemanticFact {
    return {
      key: r.key,
      value: r.value,
      category: r.category,
      updatedAt: r.updatedAt.getTime(),
      sourceTickId: '',
      confidence: r.importance,
      scope: this.inferFactScope(r.key, r.category),
    };
  }

  /**
   * 从 key/category 推断事实的可见性范围。
   * 数据库不持久化 scope，每次读取时重建——与框架 inferSemanticMemoryScope 逻辑一致。
   * 确保非 actor_profile 类别的事实不会因 legacy_unknown 策略被过滤。
   */
  private inferFactScope(key: string, category: string) {
    if (category === 'self' || key.startsWith('self.')) {
      return { type: 'self' as const };
    }
    const match = /^actor:([^:]+):/.exec(key);
    if (match) {
      return { type: 'actor' as const, actorId: match[1] };
    }
    if (category === 'world' || category === 'global') {
      return { type: 'global' as const };
    }
    return { type: 'actor' as const, actorId: this.playerId };
  }

  private rowToEpisodeRecord(r: any): EpisodeRecord {
    return {
      id: r.id,
      summary: r.summary,
      evidenceExcerpts: [],
      sourceTickId: '',
      actors: JSON.parse(r.actors),
      topicTags: [],
      emotionDelta: r.emotionSnap ? JSON.parse(r.emotionSnap) : undefined,
      importance: r.importance,
      confidence: 0.8,
      epistemicStatus: 'confirmed',
      timestamp: r.createdAt.getTime(),
    };
  }

  private async applyMutation(mutation: MemoryMutation): Promise<void> {
    const { type, payload } = mutation;

    switch (type) {
      case 'semantic_upsert': {
        const fact = payload as SemanticFact;
        await this.prisma.semanticFact.upsert({
          where: {
            playerId_category_key: {
              playerId: this.playerId,
              category: fact.category,
              key: fact.key,
            },
          },
          create: {
            playerId: this.playerId,
            category: fact.category,
            key: fact.key,
            value: fact.value,
            importance: fact.confidence ?? 0.5,
          },
          update: {
            value: fact.value,
            importance: fact.confidence ?? 0.5,
          },
        });
        break;
      }

      case 'episode_append': {
        const episode = payload as EpisodeRecord;
        await this.prisma.episodeRecord.create({
          data: {
            id: episode.id,
            playerId: this.playerId,
            summary: episode.summary,
            importance: episode.importance ?? 0.5,
            emotionSnap: episode.emotionDelta
              ? JSON.stringify(episode.emotionDelta)
              : null,
            actors: JSON.stringify(episode.actors ?? []),
          },
        });
        break;
      }

      default:
        this.logger.debug(`Unhandled mutation type: ${type}`);
    }
  }
}
