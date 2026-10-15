import test from 'node:test';
import assert from 'node:assert/strict';
import { createFixtureSession } from './helpers/session.mjs';
import { sdk } from '../src/upstream.mjs';
import { loadCuratedBrainConfig } from '../src/brain-config.ts';

function fakeTransport(toolName) {
  const listeners = [];
  const closes = [];
  return {
    closes,
    async start() {},
    async send(message) {
      if (message.id === undefined) return;
      let result = {};
      if (message.method === 'initialize') result = { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'fake-brain', version: '1' } };
      if (message.method === 'tools/list') result = { tools: [{ name: toolName, description: toolName, inputSchema: { type: 'object', properties: {} } }] };
      if (message.method === 'resources/list') result = { resources: [] };
      if (message.method === 'resources/templates/list') result = { resourceTemplates: [] };
      queueMicrotask(() => listeners.forEach(listener => listener({ jsonrpc: '2.0', id: message.id, result })));
    },
    async close() { closes.forEach(listener => listener()); },
    onMessage(fn) { listeners.push(fn); return () => listeners.splice(listeners.indexOf(fn), 1); },
    onError() { return () => {}; },
    onClose(fn) { closes.push(fn); return () => closes.splice(closes.indexOf(fn), 1); },
  };
}

async function until(predicate) {
  for (let i = 0; i < 50; i++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.fail('MCP registry did not settle');
}

test('upstream MCP re-registration reconnects curated Brain namespace and refreshes active tools', async () => {
  let pi;
  let version = 0;
  const transports = [];
  const createTransport = () => {
    const transport = fakeTransport(++version === 1 ? 'brain_context' : 'brain_search');
    transports.push(transport);
    return transport;
  };
  const fixture = await createFixtureSession({ extensions: [
    sdk.createMcpExtension({ loadConfig: () => ({ servers: [], errors: [], autoEnableCodemode: false }), createTransport }),
    api => { pi = api; },
  ] });
  try {
    const curated = loadCuratedBrainConfig({ requireExists: false }).servers[0].config;
    const first = { ...curated, exposure: 'hidden', toolExposure: { brain_context: 'direct' }, description: 'offline first' };
    pi.registerMcpServer('open-second-brain', first);
    await until(() => fixture.session.getActiveToolNames().includes('mcp__open_second_brain__brain_context'));
    const second = { ...curated, exposure: 'hidden', toolExposure: { brain_search: 'direct' }, description: 'offline second' };
    pi.registerMcpServer('open-second-brain', second);
    await until(() => fixture.session.getActiveToolNames().includes('mcp__open_second_brain__brain_search'));
    const names = fixture.session.getActiveToolNames();
    assert.equal(names.includes('mcp__open_second_brain__brain_context'), false);
    assert.equal(transports.length, 2);
    assert.equal(first.args.includes('D:/.vault-brain/vault'), true);
  } finally { fixture.dispose(); }
});
