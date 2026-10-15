export function registerDelegation(pi: any, options: { supervisor: any; Type: any }) {
  const { supervisor, Type } = options;
  const result = (value: any) => ({ content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value });
  const fail = (error: any) => ({ ...result({ ok: false, error: String(error?.message ?? error).slice(0, 1000) }), isError: true });
  const namespace = { name: 'agents', description: 'Owned child sessions' };
  pi.registerTool({
    name: 'agents_spawn', label: 'Spawn agents', description: 'Start independent child tasks with explicit profile and model slot. Returns only the started prefix.',
    exposure: 'deferred', namespace, executionMode: 'sequential', outputSchema: Type.Any(),
    parameters: Type.Object({ tasks: Type.Array(Type.Object({ title: Type.Optional(Type.String({ maxLength: 80 })), prompt: Type.String({ minLength: 1, maxLength: 8000 }), profile: Type.Optional(Type.Union([Type.Literal('code_explorer'), Type.Literal('default')])), model_slot: Type.Optional(Type.String()) }), { minItems: 1, maxItems: 100 }) }),
    async execute(_id: string, params: any, signal: AbortSignal) { try { return result(await supervisor.spawnTasks(params.tasks, signal)); } catch (error) { return fail(error); } }
  });
  pi.registerTool({
    name: 'agents_wait', label: 'Wait for agents', description: 'Wait for owned child receipts. Timeout does not cancel running children.',
    exposure: 'deferred', namespace, executionMode: 'parallel', outputSchema: Type.Any(),
    parameters: Type.Object({ ids: Type.Array(Type.String(), { minItems: 1 }), timeout_ms: Type.Optional(Type.Integer({ minimum: 0, maximum: 120000 })), poll_interval_ms: Type.Optional(Type.Integer({ minimum: 100, maximum: 5000 })) }),
    async execute(_id: string, params: any, signal: AbortSignal) { try { return result(await supervisor.wait(params.ids, params.timeout_ms, params.poll_interval_ms, signal)); } catch (error) { return fail(error); } }
  });
  pi.registerTool({
    name: 'sessions_send', label: 'Follow up with child', description: 'Send a new assignment to an idle child in the same session.',
    exposure: 'deferred', namespace, executionMode: 'sequential', outputSchema: Type.Any(),
    parameters: Type.Object({ id: Type.String(), prompt: Type.String({ minLength: 1, maxLength: 8000 }) }),
    async execute(_id: string, params: any) { try { return result(await supervisor.send(params.id, params.prompt)); } catch (error) { return fail(error); } }
  });
  pi.registerTool({
    name: 'sessions_cancel', label: 'Cancel child', description: 'Cancel an owned child and report whether cleanup was confirmed.',
    exposure: 'deferred', namespace, executionMode: 'sequential', outputSchema: Type.Any(),
    parameters: Type.Object({ id: Type.String() }),
    async execute(_id: string, params: any) { try { return result(await supervisor.cancel(params.id)); } catch (error) { return fail(error); } }
  });
  return supervisor;
}
