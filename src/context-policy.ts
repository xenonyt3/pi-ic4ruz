export const POINTER_ENTRY_TYPE = 'reason_harness_pointer_v1';

export function buildBehaviorGuidelines(): string {
  return [
    'Use available upstream Pi tools and their declared schemas.',
    'Batch independent read-only calls when useful; keep dependent calls sequential.',
    'Keep tool output selective and report errors and unknowns accurately.',
    'Use the shared Open Second Brain vault for durable memory; recall before decisions based on earlier work.',
    'Do not infer absent Reason behavior from Pi behavior.',
  ].join('\n');
}

/** Recover only small durable identifiers, not transcript text or Brain contents. */
export function restoreRuntimePointers(entries: readonly any[]) {
  const pointers: Record<string, { childId?: string; taskId?: string; generation?: number }> = {};
  for (const entry of entries) {
    if (entry?.type !== 'custom' || entry.customType !== POINTER_ENTRY_TYPE) continue;
    const data = entry.data;
    if (!data || typeof data !== 'object' || typeof data.key !== 'string') continue;
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(data.key)) continue;
    if (data.deleted === true) { delete pointers[data.key]; continue; }
    const value: { childId?: string; taskId?: string; generation?: number } = {};
    if (typeof data.childId === 'string' && data.childId.length <= 160) value.childId = data.childId;
    if (typeof data.taskId === 'string' && data.taskId.length <= 160) value.taskId = data.taskId;
    if (Number.isSafeInteger(data.generation) && data.generation >= 0) value.generation = data.generation;
    pointers[data.key] = value;
  }
  return pointers;
}

export function registerContextPolicy(pi: { on: (name: string, fn: (event: any, ctx: any) => any) => unknown }, options: {
  guidelines?: string;
  recall?: (query: string, beforeDecision: boolean) => Promise<{ status: string; reason?: string }>;
  onRecallUnavailable?: (reason: string) => void;
} = {}) {
  const guidelines = options.guidelines ?? buildBehaviorGuidelines();
  pi.on('before_agent_start', async (event: any) => {
    if (options.recall) {
      const result = await options.recall(event.prompt, true);
      if (result.status === 'unavailable') options.onRecallUnavailable?.(result.reason ?? 'Brain unavailable');
    }
    // before_agent_start owns prompt sections. Do not replace system prompt or transcript.
    const sections = event.systemPromptOptions?.sections;
    if (sections && typeof sections === 'object') sections.reason_harness_behavior = guidelines;
  });
  return { guidelines };
}
