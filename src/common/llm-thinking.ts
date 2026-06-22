/**
 * DeepSeek 思考模式（thinking）开关工具。
 *
 * DeepSeek 默认开启思考模式：回答前先输出一段思维链（reasoning_content）以提升准确性，
 * 但更慢、更贵。对话类 NPC 通常要的是「快」，因此本项目默认关闭；配置方可通过环境变量
 * `AGENT_THINKING=enabled` 重新打开。
 *
 * 开关通过 OpenAI 格式的请求体字段 `thinking: { type: 'disabled' | 'enabled' }` 实现，
 * 由 `OpenAIProvider` 的 `extraBody` 透传进 `chat.completions` 请求体
 * （等价于 DeepSeek 文档中 Python SDK 的 `extra_body`）。
 */

/** 思考模式开关值（对应 DeepSeek 的 `thinking.type`）。 */
export type ThinkingMode = 'enabled' | 'disabled';

/** 默认关闭思考模式，换取更快、更省的回复。 */
export const DEFAULT_THINKING_MODE: ThinkingMode = 'disabled';

/**
 * 解析环境变量为思考模式开关：仅当显式设为 `enabled`（忽略大小写与首尾空白）时开启，
 * 其余情况（含未设置）一律关闭。
 */
export function resolveThinkingMode(raw: string | undefined): ThinkingMode {
  return raw?.trim().toLowerCase() === 'enabled' ? 'enabled' : 'disabled';
}

/**
 * 生成注入 `OpenAIProvider.extraBody` 的请求体片段，用于控制 DeepSeek 思考模式开关。
 */
export function thinkingExtraBody(mode: ThinkingMode): Record<string, unknown> {
  return { thinking: { type: mode } };
}
