import type { LLMMessage, LLMProvider } from '@innerlife/agent';
import type { DevFileLoggerService } from './dev-file-logger.service';

/**
 * Per-method argument layout. All chat-like provider methods take `messages`
 * as arg 0; `options` (carrying `model`) and `toolResults` sit at method-specific
 * indices. This map lets one generic interceptor handle every signature.
 */
interface MethodSpec {
  optionsIndex: number;
  toolResultsIndex?: number;
}

const METHOD_SPECS: Record<string, MethodSpec> = {
  chat: { optionsIndex: 1 },
  chatWithSchema: { optionsIndex: 2 },
  chatWithSchemaAndToolResults: { optionsIndex: 3, toolResultsIndex: 2 },
  chatWithTools: { optionsIndex: 2 },
  continueWithToolResults: { optionsIndex: 4, toolResultsIndex: 2 },
};

function renderMessages(messages: LLMMessage[]): string {
  if (!Array.isArray(messages)) return '(no messages)';
  return messages
    .map((m) => {
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      return `[${m.role}]\n${content}`;
    })
    .join('\n\n');
}

/** Render any structured payload; strings pass through, objects pretty-print. */
function renderData(data: unknown): string {
  if (typeof data === 'string') return data;
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

/** Tool-result arrays come in two shapes (ToolResult / LLMToolResult); duck-type both. */
function renderToolResults(toolResults: unknown): string {
  if (!Array.isArray(toolResults) || toolResults.length === 0) return '';
  const lines = toolResults
    .map((entry) => {
      const t = entry as Record<string, unknown>;
      const name = (t.toolName ?? t.name ?? 'tool') as string;
      const body = (t.output ?? t.content ?? '') as string;
      const failed = t.success === false || t.isError === true;
      return `· ${name}${failed ? ' (失败)' : ''}: ${body}`;
    })
    .join('\n');
  return `── tool results ──\n${lines}`;
}

/** Render either an `LLMResponse<T>` (`.data`) or an `LLMChatResponse` (`.text` + tool calls). */
function renderResponse(res: unknown): string {
  if (!res || typeof res !== 'object') return renderData(res);
  const r = res as Record<string, unknown>;

  if ('data' in r) return renderData(r.data);

  if ('text' in r) {
    const parts: string[] = [];
    if (r.text) parts.push(String(r.text));
    const toolCalls = r.toolCalls as Array<{ name?: string; arguments?: unknown }> | undefined;
    if (Array.isArray(toolCalls) && toolCalls.length > 0) {
      parts.push(
        'tool_calls:\n' +
          toolCalls.map((tc) => `· ${tc.name}(${JSON.stringify(tc.arguments ?? {})})`).join('\n'),
      );
    }
    return parts.join('\n') || '(empty)';
  }

  return renderData(res);
}

function usageLine(res: unknown, ms: number): string {
  const usage = (res as { usage?: { promptTokens?: number; completionTokens?: number } })?.usage;
  const prompt = usage?.promptTokens ?? '?';
  const completion = usage?.completionTokens ?? '?';
  return `── response (${ms}ms · prompt=${prompt} completion=${completion}) ──`;
}

function renderExchange(
  method: string,
  args: unknown[],
  spec: MethodSpec,
  res: unknown,
  ms: number,
): string {
  const messages = args[0] as LLMMessage[];
  const options = args[spec.optionsIndex] as { model?: string } | undefined;
  const toolResults = spec.toolResultsIndex !== undefined ? args[spec.toolResultsIndex] : undefined;

  return [
    `── ${method} request (model=${options?.model ?? 'default'}) ──`,
    renderMessages(messages),
    renderToolResults(toolResults),
    usageLine(res, ms),
    renderResponse(res),
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Wrap an {@link LLMProvider} in a `Proxy` that mirrors each request/response of
 * every prompt-bearing method into the dev file log, then transparently passes
 * everything else (capabilities, `name`, future methods) through untouched.
 *
 * Both call paths the Runner can take are covered: the native tool loop
 * (`chatWithTools` / `continueWithToolResults`) and the legacy schema loop
 * (`chatWithSchema` / `chatWithSchemaAndToolResults`), plus plain `chat`.
 *
 * A `Proxy` (vs. a hand-written wrapper) keeps this zero-maintenance: we never
 * have to re-declare the provider surface, and unknown methods forward as-is.
 */
export function createLoggingProvider(
  inner: LLMProvider,
  logger: DevFileLoggerService,
  channel: string,
): LLMProvider {
  return new Proxy(inner, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      const spec = typeof prop === 'string' ? METHOD_SPECS[prop] : undefined;

      if (spec && typeof value === 'function') {
        return async (...args: unknown[]): Promise<unknown> => {
          const started = Date.now();
          try {
            const res = await (value as (...a: unknown[]) => Promise<unknown>).apply(target, args);
            logger.write(channel, prop as string, renderExchange(prop as string, args, spec, res, Date.now() - started));
            return res;
          } catch (err) {
            const reason = err instanceof Error ? err.message : String(err);
            logger.write(
              channel,
              `${prop as string}:error`,
              `── ${prop as string} request ──\n${renderMessages(args[0] as LLMMessage[])}\n── error (${Date.now() - started}ms) ──\n${reason}`,
            );
            throw err;
          }
        };
      }

      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
