import { Injectable, Logger } from '@nestjs/common';
import { ChannelHost } from '@innerlife/channel';
import { AgentRunnerService } from '../agent/agent-runner.service';
import { ChannelBindingService } from './channel-binding.service';

/**
 * Proactive (bot-initiated) outbound — the send capability behind user recall.
 * Scheduling/strategy (who, when, frequency caps) lives in business code that
 * calls these methods; this service only resolves the target and sends.
 */
@Injectable()
export class ChannelOutboxService {
  private readonly logger = new Logger(ChannelOutboxService.name);

  constructor(
    private readonly host: ChannelHost,
    private readonly runner: AgentRunnerService,
    private readonly binding: ChannelBindingService,
  ) {}

  /**
   * In-character proactive message: the NPC generates it from a system event
   * (same machinery as in-game event reports), routed to the player's channel.
   * @returns false if the player has no channel binding or the agent stayed silent.
   */
  async recallViaAgent(playerId: string, trigger: string): Promise<boolean> {
    const address = await this.binding.addressForPlayer(playerId);
    if (!address) {
      this.logger.warn(`recall skipped: player ${playerId} has no channel binding`);
      return false;
    }
    const result = await this.runner.runEventTurn({ playerId, type: 'recall', text: trigger });
    const text = result.dialogue?.trim();
    if (!text) {
      this.logger.warn(`recall skipped: agent produced no dialogue for player ${playerId}`);
      return false;
    }
    await this.host.send({ address, text });
    return true;
  }

  /** Fixed/templated proactive push (no agent turn). */
  async pushTemplate(playerId: string, text: string): Promise<boolean> {
    const address = await this.binding.addressForPlayer(playerId);
    if (!address) {
      this.logger.warn(`push skipped: player ${playerId} has no channel binding`);
      return false;
    }
    await this.host.send({ address, text });
    return true;
  }
}
