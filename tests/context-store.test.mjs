import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBehaviorGuidelines, registerContextPolicy, restoreRuntimePointers, POINTER_ENTRY_TYPE } from '../src/context-policy.ts';
import { createFixtureSession, assistantMessage, messageStream } from './helpers/session.mjs';

test('context policy adds a stable section without rewriting messages', async () => {
  const handlers = new Map();
  registerContextPolicy({ on: (name, handler) => handlers.set(name, handler) }, { recall: async () => ({ status: 'available' }) });
  const messages = [{ role: 'assistant', content: [{ type: 'toolCall', id: '1' }] }, { role: 'toolResult', toolCallId: '1' }];
  const event = { prompt: 'hello', systemPromptOptions: { sections: {} }, messages };
  await handlers.get('before_agent_start')(event);
  assert.equal(event.systemPromptOptions.sections.reason_harness_behavior, buildBehaviorGuidelines());
  assert.equal(event.messages, messages);
  assert.equal(handlers.has('context_with_system'), false);
});

test('runtime pointers restore latest branch-local entries, including deletion', () => {
  const entries = [
    { type: 'custom', customType: POINTER_ENTRY_TYPE, data: { key: 'task', taskId: 'old' } },
    { type: 'custom', customType: POINTER_ENTRY_TYPE, data: { key: 'task', taskId: 'new', childId: 'child-1', generation: 2 } },
    { type: 'custom', customType: POINTER_ENTRY_TYPE, data: { key: 'gone', taskId: 'x' } },
    { type: 'custom', customType: POINTER_ENTRY_TYPE, data: { key: 'gone', deleted: true } },
    { type: 'message', content: 'full transcript excluded' },
  ];
  assert.deepEqual(restoreRuntimePointers(entries), { task: { childId: 'child-1', taskId: 'new', generation: 2 } });
});

test('real AgentSession receives guidelines in its final system prompt', async () => {
  const fixture = await createFixtureSession({ extensions: [pi => registerContextPolicy(pi)] });
  try {
    let observed;
    fixture.session.agent.streamFunction = (_model, context) => {
      observed = context;
      return messageStream(assistantMessage());
    };
    await fixture.session.prompt('offline fixture');
    assert.match(JSON.stringify(observed), /Batch independent read-only calls/);
    assert.equal(fixture.errors.length, 0);
  } finally { fixture.dispose(); }
});
