import { Injectable } from '@nestjs/common';
import type { Agent } from '@innerlife/agent';
import { AgentPoolService } from '../agent/agent-pool.service';

/**
 * 双层情绪模型的三个量（均来自内存中的 agent 实例，保证三者同源一致）：
 * - `baseMood`：全局背景情绪层，快速衰减的“情绪残留”。
 * - `relationshipEmotion`：对该 player 的专属情绪层，慢速衰减、承载关系记忆。
 * - `effective`：按 affinity 动态加权融合 baseMood 与关系情绪后的“有效情绪”，
 *   即真正驱动对话表现的情绪。
 */
export interface NpcEmotionLayers {
  baseMood: Record<string, number>;
  relationshipEmotion: Record<string, number>;
  effective: Record<string, number>;
}

export interface NpcRelationshipStatus {
  trustLevel: number;
  cooperationLevel: number;
  subjectivePerception: number;
  secretWillingness: number;
  speakingStyle: string;
  relationshipType: string;
  affinity: number;
  interactionCount: number;
}

export interface NpcStatusResponse {
  emotion: NpcEmotionLayers;
  relationship: NpcRelationshipStatus;
  lastInteraction: string | null;
}

@Injectable()
export class NpcService {
  constructor(private readonly agentPool: AgentPoolService) {}

  /**
   * 读取小满对指定 player 的实时状态。
   *
   * 三层情绪与关系数据全部取自内存中的 agent 实例，而非 sqlite 快照：
   * effective 情绪本身就是运行期派生值（依赖 affinity 加权），从内存取可避免
   * 与 baseMood / 关系情绪出现来源不一致。agent 不在内存时由 `getAgent` 抛 404。
   */
  async getStatus(playerId: string): Promise<NpcStatusResponse> {
    const agent: Agent = this.agentPool.getAgent(playerId);
    const overlay = agent.getRelationship(playerId);

    return {
      emotion: {
        baseMood: agent.baseMood.getAll(),
        relationshipEmotion: overlay.emotionalState.getAll(),
        effective: agent.getEffectiveEmotion(playerId).getAll(),
      },
      relationship: {
        trustLevel: overlay.trustLevel,
        cooperationLevel: overlay.cooperationLevel,
        subjectivePerception: overlay.subjectivePerception,
        secretWillingness: overlay.secretWillingness,
        speakingStyle: overlay.speakingStyle,
        relationshipType: overlay.relationshipType,
        affinity: overlay.computeAffinity([], agent.affinityConfig),
        interactionCount: overlay.interactionCount,
      },
      lastInteraction: overlay.lastInteractionAt
        ? new Date(overlay.lastInteractionAt).toISOString()
        : null,
    };
  }
}
