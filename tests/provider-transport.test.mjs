import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const { stream } = await import(new URL('../runtime/node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai/dist/api/openai-completions.js',import.meta.url).href);

const model = {
  id: 'fixture-model', provider: 'fixture', api: 'openai-completions',
  baseUrl: 'https://fixture.invalid/v1',
  reasoning: false, input: ['text'], contextWindow: 8192, maxTokens: 1024,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  compat: { supportsOpenAIGrammarTools: false },
};

function sse(chunks) {
  return `${chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join('')}data: [DONE]\n\n`;
}

async function run(body, { status = 200, signal, fetchImpl, requestContext, requestModel } = {}) {
  const requests = [];
  const fakeFetch = async (input, init) => {
    requests.push({ url: String(input), method: init?.method, body: init?.body });
    if (fetchImpl) return fetchImpl(input, init);
    return new Response(body, { status, headers: { 'content-type': 'text/event-stream' } });
  };
  const events = [];
  const result = stream(requestModel ?? model, requestContext ?? { systemPrompt: 'fixture', messages: [], tools: [] }, {
    apiKey: 'fixture-only', fetch: fakeFetch, signal, maxRetries: 0,
  });
  for await (const event of result) events.push(event);
  return { events, output: await result.result(), requests };
}

test('official converter parses streamed JSON function arguments through injected fetch', async () => {
  const body = sse([
    { id: 'a', choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'call-1', type: 'function', function: { name: 'codemode', arguments: '{"code":' } }] } }] },
    { id: 'a', choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: '"return 1"}' } }] }, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 8, completion_tokens: 5, total_tokens: 13 } },
  ]);
  const { output, requests } = await run(body);
  assert.equal(requests.length, 1);
  assert.equal(new URL(requests[0].url).hostname, 'fixture.invalid');
  assert.equal(output.content.find(c => c.type === 'toolCall')?.arguments?.code, 'return 1');
  assert.equal(output.usage.totalTokens, 13);
});

test('malformed function arguments become a provider result rather than a silent model switch', async () => {
  const body = sse([{ id: 'b', choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'call-b', type: 'function', function: { name: 'codemode', arguments: '{bad' } }] }, finish_reason: 'tool_calls' }] }]);
  const { output, requests } = await run(body);
  assert.equal(requests.length, 1);
  assert.equal(output.provider, 'fixture');
  assert.ok(['error', 'toolUse'].includes(output.stopReason));
});

test('429 is surfaced without retry or network escape', async () => {
  const { output, requests } = await run('rate limited', { status: 429 });
  assert.equal(requests.length, 1);
  assert.equal(output.stopReason, 'error');
});

test('context overflow response is surfaced without switching provider', async () => {
  const { output, requests } = await run('{"error":{"message":"maximum context length exceeded","code":"context_length_exceeded"}}', { status: 400 });
  assert.equal(requests.length, 1);
  assert.equal(output.provider, 'fixture');
  assert.equal(output.stopReason, 'error');
});

test('cached token usage is kept separate from total tokens', async () => {
  const body = sse([{ id: 'c', choices: [{ index: 0, delta: { content: 'ok' }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12, prompt_tokens_details: { cached_tokens: 4 } } }]);
  const { output } = await run(body);
  assert.equal(output.usage.totalTokens, 12);
  assert.equal(output.usage.cacheRead, 4);
});

test('missing SSE usage has upstream synthetic zero, which telemetry must mark unknown', async () => {
  const body = sse([{ id: 'd', choices: [{ index: 0, delta: { content: 'ok' }, finish_reason: 'stop' }] }]);
  const { output } = await run(body);
  assert.equal(output.usage.totalTokens, 0);
});

test('aborted request remains on selected provider and does not retry', async () => {
  const controller = new AbortController();
  controller.abort();
  const { output, requests } = await run('', {
    signal: controller.signal,
    fetchImpl: async () => { throw new DOMException('aborted', 'AbortError'); },
  });
  assert.equal(requests.length, 0);
  assert.equal(output.provider, 'fixture');
  assert.equal(output.stopReason, 'aborted');
});

test('disconnected SSE surfaces error without a second request', async () => {
  const body = new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('data: {"id":"x","choices":')); controller.error(new Error('fixture disconnect')); },
  });
  const { output, requests } = await run('', { fetchImpl: async () => new Response(body, { headers: { 'content-type': 'text/event-stream' } }) });
  assert.equal(requests.length, 1);
  assert.equal(output.stopReason, 'error');
});

test('grammar tool transport is conditional on explicit compat capability', async () => {
  const tool = {
    name: 'codemode', description: 'Run JavaScript',
    parameters: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] },
    constrainedSampling: { type: 'grammar', variants: { openai_lark: 'start: /.+/' } },
  };
  const requestContext = { messages: [{ role: 'system', content: 'fixture', toolsAdded: [tool], timestamp: 0 }] };
  const body = sse([{ id: 'g', choices: [{ index: 0, delta: { content: 'ok' }, finish_reason: 'stop' }] }]);
  const disabled = await run(body, { requestContext });
  const enabled = await run(body, { requestContext, requestModel: { ...model, compat: { supportsOpenAIGrammarTools: true } } });
  const disabledTools = JSON.parse(disabled.requests[0].body).tools;
  const enabledTools = JSON.parse(enabled.requests[0].body).tools;
  assert.equal(disabledTools[0].type, 'function');
  assert.equal(enabledTools[0].type, 'custom');
  assert.equal(enabledTools[0].custom.name, 'codemode');
});
