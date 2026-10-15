import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCuratedBrainConfig, recallSessionContext, verifyVaultBinding } from '../src/brain-config.ts';
import { recordRequestEnvelope, recordUsage, redactEvent, registerTelemetry } from '../src/telemetry.ts';
import { createFixtureSession } from './helpers/session.mjs';
import { sdk } from '../src/upstream.mjs';

test('Brain config binds one curated vault and denies child access', () => {
  const config = loadCuratedBrainConfig({ requireExists: false });
  assert.equal(config.servers.length, 1);
  assert.deepEqual(config.servers[0].config.args.slice(-3), ['mcp', '--vault', 'D:/.vault-brain/vault']);
  assert.equal(loadCuratedBrainConfig({ role: 'child' }).servers.length, 0);
  assert.throws(() => verifyVaultBinding('D:/another-vault', { requireExists: false }), /BRAIN_VAULT_MISMATCH/);
});

test('Brain recall is explicit on unavailable and never called for child', async () => {
  const calls = [];
  const callTool = async (name, args) => { calls.push({ name, args }); return name === 'brain_context' ? { structuredContent: { active_path: 'D:/.vault-brain/vault/Brain/active.md' } } : { structuredContent: { results: [] } }; };
  const result = await recallSessionContext({ callTool, query: 'prior design' });
  assert.equal(result.status, 'available');
  assert.deepEqual(calls.map(c => c.name), ['brain_context', 'brain_search']);
  assert.equal(calls[1].args.semantic, false);
  await recallSessionContext({ callTool, role: 'child' });
  assert.equal(calls.length, 2);
  const unavailable = await recallSessionContext({ callTool: async () => { throw Error('offline'); }, beforeDecision: true });
  assert.equal(unavailable.status, 'unavailable');
  assert.equal(unavailable.decisionBlocked, true);
  assert.equal((await recallSessionContext({ callTool: async () => ({ isError: true, structuredContent: {} }), beforeDecision: true })).status, 'unavailable');
  assert.equal((await recallSessionContext({ callTool: async () => ({ structuredContent: { active_path: 'D:/wrong/Brain/active.md' } }), beforeDecision: true })).status, 'unavailable');
});

test('telemetry records hashes and unknown usage without secrets', () => {
  const one = recordRequestEnvelope({ systemPrompt: { b: 2, a: 1 }, tools: ['read'], provider: '9router', model: 'cx/gpt-6-sol', at: 'fixed' });
  const two = recordRequestEnvelope({ systemPrompt: { a: 1, b: 2 }, tools: ['read'], at: 'fixed' });
  assert.equal(one.promptHash, two.promptHash);
  assert.equal(recordUsage(undefined).tokens, null);
  assert.equal(recordUsage({ totalTokens: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }).status, 'unknown');
  assert.deepEqual(recordUsage({ totalTokens: 10, cacheRead: 3, cacheWrite: 2 }).cacheRead, 3);
  assert.deepEqual(redactEvent({ authorization: 'Bearer verysecret', nested: { note: 'sk-abcdefghijklmnop' } }), { authorization: '[REDACTED]', nested: { note: '[REDACTED]' } });
  assert.equal(redactEvent({ tokens: 123 }).tokens, 123);
});

test('telemetry hooks remain observational and bounded', () => {
  const handlers = new Map();
  const pi = { on: (name, fn) => handlers.set(name, fn) };
  const { records } = registerTelemetry(pi, { maxEvents: 3, nestedLimit: 1 });
  assert.deepEqual(handlers.get('cache_warming_decision')(), { action: 'stop' });
  assert.equal(handlers.get('context_with_system')({ messages: [{ role: 'system', content: 'safe' }] }, { model: { id: 'test' } }), undefined);
  handlers.get('message_end')({ message: { role: 'assistant' } });
  handlers.get('tool_execution_end')({ toolName: 'read',parentToolCallId:'root' });
  handlers.get('tool_execution_end')({ toolName: 'read',parentToolCallId:'root' });
  assert.equal(records.length, 3);
  assert.deepEqual(records.at(-1), { type: 'nested_limit', complete: false, observed: 2 });
});

test('real system sections and toolsAdded alter final prompt/schema hashes', () => {
  const handlers = new Map();
  const pi = { on: (name, fn) => handlers.set(name, fn) };
  const { records } = registerTelemetry(pi);
  const context = handlers.get('context_with_system');
  context({ messages: [{ role: 'system', content: '', sections: { behavior: 'first' }, toolsAdded: [{ name: 'read', parameters: { type: 'object' } }] }] }, {});
  context({ messages: [{ role: 'system', content: '', sections: { behavior: 'second' }, toolsAdded: [{ name: 'write', parameters: { type: 'object' } }] }] }, {});
  assert.notEqual(records[0].promptHash, records[1].promptHash);
  assert.notEqual(records[0].schemaHash, records[1].schemaHash);
  handlers.get('before_provider_request')({ payload: { model: 'fixture', messages: [] } });
  assert.match(records[2].payloadHash, /^[a-f0-9]{64}$/);
});

test('upstream MCP extension loads only curated Brain tools from fake transport', async () => {
  const requests = [];
  const createdEntries = [];
  const createTransport = entry => {
    createdEntries.push(entry);
    const listeners = [];
    return {
      async start() {},
      async send(message) {
        requests.push(message.method);
        if (message.id === undefined) return;
        let result = {};
        if (message.method === 'initialize') result = { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'fake-brain', version: '1' } };
        if (message.method === 'tools/list') result = { tools: [
          { name: 'brain_context', description: 'Read shared context', inputSchema: { type: 'object', properties: {} } },
          { name: 'brain_search', description: 'Search shared context', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
          { name: 'unsafe_write', description: 'Must stay hidden', inputSchema: { type: 'object', properties: {} } },
        ] };
        if (message.method === 'resources/list') result = { resources: [] };
        if (message.method === 'resources/templates/list') result = { resourceTemplates: [] };
        queueMicrotask(() => listeners.forEach(listener => listener({ jsonrpc: '2.0', id: message.id, result })));
      },
      async close() {},
      onMessage(fn) { listeners.push(fn); return () => listeners.splice(listeners.indexOf(fn), 1); },
      onError() { return () => {}; },
      onClose() { return () => {}; },
    };
  };
  const fixture = await createFixtureSession({ extensions: [sdk.createMcpExtension({
    loadConfig: () => loadCuratedBrainConfig({ requireExists: false }), createTransport,
  })] });
  try {
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(createdEntries.length, 1);
    assert.equal(createdEntries[0].config.args.includes('D:/.vault-brain/vault'), true);
    assert.equal(requests.includes('tools/list'), true);
    const names = fixture.session.getActiveToolNames();
    assert.equal(names.includes('mcp__open_second_brain__unsafe_write'), false);
  } finally { fixture.dispose(); }
});
