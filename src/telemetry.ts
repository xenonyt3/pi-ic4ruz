import { createHash } from 'node:crypto';

const MAX_EVENTS = 512;
const SECRET_KEY = /(?:authorization|api.?key|token|password|cookie|secret|credential|headers?|body|payload)$/i;
const SECRET_VALUE = /(?:sk-|Bearer\s+|reason_|rmt_)[A-Za-z0-9._-]{8,}/gi;

export function hashNormalized(value: unknown): string {
  const canonical = JSON.stringify(value, (_key, item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)));
    }
    return item;
  });
  return createHash('sha256').update(canonical ?? 'null').digest('hex');
}

export function redactEvent<T>(value: T): T {
  const seen = new WeakSet<object>();
  function visit(input: any): any {
    if (typeof input === 'string') return input.replace(SECRET_VALUE, '[REDACTED]');
    if (!input || typeof input !== 'object') return input;
    if (seen.has(input)) return '[CIRCULAR]';
    seen.add(input);
    if (Array.isArray(input)) return input.map(visit);
    return Object.fromEntries(Object.entries(input).map(([key, item]) => [key, SECRET_KEY.test(key) && !(key === 'tokens' && typeof item === 'number') ? '[REDACTED]' : visit(item)]));
  }
  return visit(value);
}

export function recordRequestEnvelope(input: {
  systemPrompt?: unknown; tools?: unknown; provider?: string; api?: string; model?: string; effort?: string;
  sessionId?: string; childIds?: string[]; at?: string;
}) {
  return {
    type: 'request', at: input.at ?? new Date().toISOString(),
    provider: input.provider ?? 'unknown', api: input.api ?? 'unknown',
    model: input.model ?? 'unknown', effort: input.effort ?? 'unknown',
    sessionId: input.sessionId ?? null, childIds: input.childIds?.slice(0, 3) ?? [],
    promptHash: hashNormalized(input.systemPrompt ?? null),
    schemaHash: hashNormalized(input.tools ?? null),
  };
}

export function recordUsage(usage: any, source: string = 'provider') {
  if (!usage || typeof usage !== 'object') return { type: 'usage', status: 'unknown', source: 'missing', tokens: null, cacheRead: null, cacheWrite: null };
  const tokens = Number.isFinite(usage.totalTokens) ? usage.totalTokens : null;
  const cacheRead = Number.isFinite(usage.cacheRead) ? usage.cacheRead : null;
  const cacheWrite = Number.isFinite(usage.cacheWrite) ? usage.cacheWrite : null;
  // The upstream OpenAI-compatible converter initializes absent usage to zeros.
  // Without an explicit provider receipt, zeros cannot prove a measured zero.
  if (tokens === 0 && !usage.input && !usage.output && !cacheRead && !cacheWrite) {
    return { type: 'usage', status: 'unknown', source: 'sdk_omitted_or_zero', tokens: null, cacheRead: null, cacheWrite: null };
  }
  return { type: 'usage', status: tokens === null ? 'unknown' : 'reported', source, tokens, cacheRead, cacheWrite };
}

export function registerTelemetry(pi: { on: (name: string, fn: (event: any, ctx: any) => any) => unknown }, options: {
  emit?: (record: unknown) => void; maxEvents?: number; nestedLimit?: number;
} = {}) {
  const records: unknown[] = [];
  const limit = Math.max(1, Math.min(options.maxEvents ?? MAX_EVENTS, 4096));
  const nestedLimit = Math.max(0, Math.min(options.nestedLimit ?? 64, 1024));
  let nestedCount = 0;
  const starts = new Map<string, number>();
  const emit = (record: unknown) => {
    const safe = redactEvent(record);
    if (records.length === limit) records.shift();
    records.push(safe);
    options.emit?.(safe);
  };
  pi.on('cache_warming_decision', () => ({ action: 'stop' }));
  pi.on('agent_start', () => { nestedCount=0; starts.clear(); });
  pi.on('context_with_system', (event: any, ctx: any) => {
    const messages = event.messages ?? [];
    const system = messages.filter((m: any) => m?.role === 'system').map((m: any) => ({ content: m.content, sections: m.sections }));
    const tools = messages.filter((m: any) => m?.role === 'system').flatMap((m: any) => m.toolsAdded ?? []);
    const model = ctx?.model;
    emit(recordRequestEnvelope({
      systemPrompt: system,
      tools,
      provider: model?.provider, api: model?.api, model: model?.id,
      effort: ctx?.thinkingLevel,
      sessionId: ctx?.sessionManager?.getSessionId?.(),
    }));
    // Observational only: never return messages from this full-prompt hook.
  });
  pi.on('before_provider_request', (event: any) => {
    emit({ type: 'provider_payload', source:'provider_payload', payloadHash: hashNormalized(event.payload),
      promptHash:hashNormalized(event.payload?.messages??event.payload?.input??null),schemaHash:hashNormalized(event.payload?.tools??null) });
  });
  pi.on('message_end', (event: any) => {
    if (event.message?.role === 'assistant') emit(recordUsage(event.message.usage));
  });
  pi.on('session_before_compact', (event: any) => emit({ type: 'compaction_start', reason: event.reason, willRetry: event.willRetry }));
  pi.on('session_compact', (event: any) => emit({ type: 'compaction_end', reason: event.reason, summaryHash: hashNormalized(event.compactionEntry?.summary), usage: recordUsage(event.compactionEntry?.usage) }));
  pi.on('session_compact_failed', (event: any) => emit({ type: 'compaction_failed', reason: event.reason, aborted: event.aborted, error: event.errorMessage }));
  pi.on('tool_execution_start', (event:any) => { starts.set(event.toolCallId,Date.now()); });
  pi.on('tool_execution_end', (event: any) => {
    const start=starts.get(event.toolCallId);starts.delete(event.toolCallId);
    if (!event.parentToolCallId||nestedCount < nestedLimit) emit({ type: 'tool_end', name: event.toolName, error: event.isError === true,
      toolCallId:event.toolCallId??null,parentToolCallId:event.parentToolCallId??null,durationMs:start===undefined?null:Date.now()-start });
    if(event.parentToolCallId){nestedCount++;if (nestedCount === nestedLimit + 1) emit({ type: 'nested_limit', complete: false, observed: nestedCount });}
  });
  return { records, emit };
}
