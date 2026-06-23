import { Logger } from '@nestjs/common';
import { createInnerlifeEngine, type InnerlifeEngine } from '@innerlife/channel-engine-adapter';
import { AgentPoolService } from '../agent/agent-pool.service';
import { AgentRunnerService } from '../agent/agent-runner.service';
import { ChannelBindingService } from './channel-binding.service';
import type { MemoryImportService } from '../memory-import/memory-import.service';
import type { ConversationResetService } from '../conversation/conversation-reset.service';

export interface WeixinEngineDeps {
  pool: AgentPoolService;
  runner: AgentRunnerService;
  binding: ChannelBindingService;
  memoryImport?: MemoryImportService;
  conversationReset?: ConversationResetService;
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
      run: async (_agent, ctx) => {
        if (!ctx?.source) throw new Error('weixin engine: run() missing source (playerId)');

        // 指令拦截：#新对话/#new 优先，再到 #记忆导入。命中即把确认语作为回复直接发回微信
        // （ChannelHost 会自动 send），让用户/客户端知道指令是否生效，不进入模型对话。
        if (deps.conversationReset || deps.memoryImport) {
          const inbox = _agent.inbox as any;
          const event = typeof inbox.peek === 'function' ? inbox.peek() : null;
          if (event?.text) {
            const resetResult = deps.conversationReset
              ? await deps.conversationReset.intercept(ctx.source, event.text)
              : { handled: false as const };
            const result = resetResult.handled
              ? resetResult
              : deps.memoryImport
                ? await deps.memoryImport.intercept(ctx.source, event.text)
                : { handled: false as const };
            if (result.handled) {
              // 命中指令：清空整个 inbox，而不是只 dequeue 一条。
              // peek() 不出队、dequeue() 只移除最高优先级的一条；若 inbox 里还有残留事件，
              // engine-adapter 的 `while(!inbox.isEmpty())` 会再跑一次 runOnce 落到
              // runPreparedTurn（真正的模型轮次）——既"击穿"了指令拦截，又会再点亮一次
              // 无法随本轮关闭的"正在输入"。清空 inbox 即可杜绝。
              const leftover = typeof inbox.size === 'function' ? inbox.size() : 0;
              if (typeof inbox.clear === 'function') inbox.clear();
              else if (typeof inbox.dequeue === 'function') inbox.dequeue();
              if (leftover > 1) {
                log.warn(
                  `指令命中，已清空 inbox 防止击穿：丢弃残留事件 ${leftover - 1} 条 (source=${ctx.source})`,
                );
              }
              return { dialogue: result.reply ?? '' };
            }
          }
        }

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
