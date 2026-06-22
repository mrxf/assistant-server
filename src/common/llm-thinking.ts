/**
 * DeepSeek 思考模式（thinking）档位工具。
 *
 * DeepSeek 支持在请求体里用 `thinking: { type: 'enabled' | 'disabled' }` 开关思考链；
 * 部分接口/模型还支持 OpenAI 风格的 `reasoning_effort: 'low' | 'medium' | 'high'` 控制思考强度。
 * 本项目把两者合成一个「档位」概念：
 *   - `disabled`：完全关闭思考，最快、最省。
 *   - `low` / `medium` / `high`：开启思考，并把强度透传给支持 reasoning_effort 的接口。
 *
 * 非 disabled 时，同时下发 `thinking.type=enabled` 与 `reasoning_effort=<档位>`，
 * 谁认用谁，兼容性最好（由 `OpenAIProvider.extraBody` 透传进 chat.completions 请求体）。
 */

/** 思考档位。disabled 关闭；low/medium/high 为开启后的思考强度。 */
export type ThinkingMode = 'disabled' | 'low' | 'medium' | 'high';

/** 默认 medium：在准确性与速度/成本之间取平衡。 */
export const DEFAULT_THINKING_MODE: ThinkingMode = 'medium';

const VALID_LEVELS: ReadonlySet<string> = new Set(['low', 'medium', 'high']);
const DISABLED_ALIASES: ReadonlySet<string> = new Set(['disabled', 'off', 'none', 'false']);

/**
 * 解析环境变量为思考档位：
 *   - `low` / `medium` / `high`（忽略大小写与首尾空白）→ 对应档位
 *   - `disabled` / `off` / `none` / `false` → 关闭
 *   - 其余情况（含未设置）→ 默认 medium
 */
export function resolveThinkingMode(raw: string | undefined): ThinkingMode {
  const value = raw?.trim().toLowerCase();
  if (!value) return DEFAULT_THINKING_MODE;
  if (DISABLED_ALIASES.has(value)) return 'disabled';
  if (VALID_LEVELS.has(value)) return value as ThinkingMode;
  return DEFAULT_THINKING_MODE;
}

/**
 * 生成注入 `OpenAIProvider.extraBody` 的请求体片段。
 * disabled → 仅关闭思考；否则同时下发 thinking 开关与 reasoning_effort 档位。
 */
export function thinkingExtraBody(mode: ThinkingMode): Record<string, unknown> {
  if (mode === 'disabled') {
    return { thinking: { type: 'disabled' } };
  }
  return {
    thinking: { type: 'enabled' },
    reasoning_effort: mode,
  };
}
