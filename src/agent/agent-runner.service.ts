import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Runner,
  EventPriority,
  type TurnResult,
  type InboxEvent,
  type HormoneMode,
  type RunnerOptions,
} from '@innerlife/agent';
import { AgentPoolService } from './agent-pool.service';
import { GAME_SYSTEM_SOURCE } from './agent.constants';

export interface ChatTurnInput {
  playerId: string;
  content: string;
  playerNickname?: string;
}

export interface EventTurnInput {
  playerId: string;
  type: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export interface HormoneResultEvent {
  deltas: Record<string, number>;
  involuntaryPhysical: string | null;
}

export interface TurnCallbacks {
  onHormone?: (event: HormoneResultEvent) => void;
}

@Injectable()
export class AgentRunnerService {
  private readonly logger = new Logger(AgentRunnerService.name);
  private runner: Runner;

  constructor(
    private readonly agentPool: AgentPoolService,
    private readonly configService: ConfigService,
  ) {
    const hormoneMode = this.configService.get<HormoneMode>('agent.hormoneMode') || 'parallel';
    const runnerOptions: RunnerOptions = {
      hormoneMode,
      maxToolAttempts: 3,
    };
    this.runner = new Runner(runnerOptions);
  }

  /**
   * Push a player message, then run a turn. Used by the reactive chat paths
   * (HTTP/SSE and channels). The push is intentionally outside the turn lock so
   * it never blocks: concurrent messages accumulate in the Inbox and merge via
   * `mergeKey`.
   */
  async runChatTurn(input: ChatTurnInput, callbacks?: TurnCallbacks): Promise<TurnResult> {
    const agent = this.agentPool.getAgent(input.playerId);

    const event: InboxEvent = {
      id: `chat-${Date.now()}`,
      type: 'player:dialogue',
      source: input.playerId,
      text: input.content,
      priority: EventPriority.PLAYER_COMMAND,
      timestamp: Date.now(),
      ttl: 60_000,
      mergeKey: `player:chat:${input.playerId}`,
      metadata: {
        playerNickname: input.playerNickname,
        sourceName: input.playerNickname || '玩家',
      },
    };
    agent.inbox.push(event);

    return this.runPreparedTurn(input.playerId, callbacks);
  }

  /**
   * Run one turn for a player whose Inbox is already primed, then persist state.
   * The single choke point that serializes `Runner.run` per player (via the
   * pool's turn lock) — shared by the chat path, channel engine adapter, and
   * proactive sends, so they can never run the same agent concurrently.
   */
  async runPreparedTurn(playerId: string, callbacks?: TurnCallbacks): Promise<TurnResult> {
    return this.agentPool.withTurnLock(playerId, async () => {
      const agent = this.agentPool.getAgent(playerId);

      let hormoneListener: ((data: any) => void) | null = null;
      let hormoneEmitted = false;

      if (callbacks?.onHormone) {
        hormoneListener = (data: any) => {
          hormoneEmitted = true;
          callbacks.onHormone!({
            deltas: data.deltas,
            involuntaryPhysical: data.involuntaryPhysical,
          });
        };
        agent.eventBus.on('hormone:result', hormoneListener);
      }

      let result: TurnResult;
      try {
        result = await this.runner.run(agent);
      } catch (err: any) {
        this.logger.error(`Runner.run failed for player ${playerId}: ${err.message}`);
        if (err.status) this.logger.error(`HTTP status: ${err.status}`);
        if (err.error) this.logger.error(`Error body: ${JSON.stringify(err.error)}`);
        if (err.response) this.logger.error(`Response: ${JSON.stringify(err.response?.data || err.response)}`);
        throw err;
      } finally {
        if (hormoneListener) {
          agent.eventBus.off('hormone:result', hormoneListener);
        }
      }

      await this.agentPool.persistState(playerId);

      return Object.assign(result, { hormoneAlreadyEmitted: hormoneEmitted });
    });
  }

  async runEventTurn(input: EventTurnInput): Promise<TurnResult> {
    return this.agentPool.withTurnLock(input.playerId, async () => {
      const agent = this.agentPool.getAgent(input.playerId);

      const event: InboxEvent = {
        id: `event-${Date.now()}`,
        type: `game:${input.type}`,
        source: GAME_SYSTEM_SOURCE,
        text: input.text,
        priority: EventPriority.ENVIRONMENT,
        timestamp: Date.now(),
        ttl: 120_000,
        metadata: input.metadata,
        responseMode: 'dialogue',
      };

      agent.inbox.push(event);

      const result = await this.runner.run(agent);

      await this.agentPool.persistState(input.playerId);

      return result;
    });
  }
}
