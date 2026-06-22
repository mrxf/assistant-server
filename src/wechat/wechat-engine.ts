import { Logger } from '@nestjs/common';
import { createInnerlifeEngine, type InnerlifeEngine } from '@innerlife/channel-engine-adapter';
import { AgentPoolService } from '../agent/agent-pool.service';
import { AgentRunnerService } from '../agent/agent-runner.service';
import { ChannelBindingService } from './channel-binding.service';

export interface WeixinEngineDeps {
  pool: AgentPoolService;
  runner: AgentRunnerService;
  binding: ChannelBindingService;
  concurrency?: number;
  /** Normal sliding quiet-period (ms). Default 2500 for WeChat. */
  debounceMs?: number;
  /** Quiet-period when the latest inbound is image-only (ms). Default 5000:
   *  WeChat can't send image+text together, so a caption-less photo usually
   *  means the user is still about to type their question. */
  imageOnlyDebounceMs?: number;
}

/**
 * Build the ChannelEngine that bridges the channel host to the assistant agent.
 * - `resolveAgent` turns a channel peer into the bound player's Agent (and
 *   touches its activity for proactive targeting).
 * - `runner` routes every run through `runPreparedTurn`, so channel turns share
 *   the per-player turn lock + state persistence with the web/SSE path.
 */
export function buildWeixinEngine(deps: WeixinEngineDeps): InnerlifeEngine {
  const log = new Logger('WeixinEngine');

  return createInnerlifeEngine({
    runner: {
      run: (_agent, ctx) => {
        if (!ctx?.source) throw new Error('weixin engine: run() missing source (playerId)');
        return deps.runner.runPreparedTurn(ctx.source);
      },
    },
    resolveAgent: async (address) => {
      const binding = await deps.binding.resolve(address.channelId, address.peerId);
      if (!binding) {
        throw new Error(`weixin: no binding for ${address.channelId}:${address.peerId}`);
      }
      void deps.binding.touch(address.channelId, address.peerId);
      return { agent: deps.pool.getAgent(binding.playerId), source: binding.playerId };
    },
    ...(deps.concurrency !== undefined ? { concurrency: deps.concurrency } : {}),
    debounceMs: deps.debounceMs ?? 2500,
    imageOnlyDebounceMs: deps.imageOnlyDebounceMs ?? 5000,
    logger: {
      warn: (msg, meta) => log.warn(meta !== undefined ? `${msg} ${safe(meta)}` : msg),
      error: (msg, meta) => log.error(meta !== undefined ? `${msg} ${safe(meta)}` : msg),
    },
  });
}

function safe(v: unknown): string {
  try {
    return typeof v === 'string' ? v : JSON.stringify(v);
  } catch {
    return String(v);
  }
}
