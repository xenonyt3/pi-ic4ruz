import test from 'node:test';
import assert from 'node:assert/strict';
import { createFixtureSession, assistantMessage, messageStream, fixtureModel } from './helpers/session.mjs';

function seed(manager, long = false) {
  for (let i = 0; i < 4; i++) {
    manager.appendMessage({ role: 'user', content: [{ type: 'text', text: `${i} ${long ? 'x'.repeat(500) : 'question'}` }], timestamp: Date.now() });
    manager.appendMessage(assistantMessage([{ type: 'text', text: `answer ${i}` }], long ? { usage: undefined } : {}));
  }
}

test('low-window model override changes effective settings and triggers runtime threshold compaction', async () => {
  const model = { ...fixtureModel, contextWindow: 100 };
  const fixture = await createFixtureSession({
    model,
    settings: { compaction: { enabled: true, reserveTokens: 90, keepRecentTokens: 1,
      modelOverrides: { 'fixture/offline-model': { reserveTokens: 10, keepRecentTokens: 20 } } } },
  });
  try {
    assert.deepEqual(fixture.settingsManager.getCompactionSettings(model), { enabled: true, reserveTokens: 10, keepRecentTokens: 20 });
    assert.equal(fixture.session.model.contextWindow, 100);
    let requests = 0;
    fixture.modelRuntime.streamSimple = () => messageStream(assistantMessage([{ type: 'text', text: 'low-window summary' }]));
    fixture.session.agent.streamFunction = () => {
      requests++;
      return messageStream(assistantMessage([{ type: 'text', text: 'answer' }], {
        usage: { input: 94, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 95, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      }));
    };
    for (let i = 0; i < 4 && !fixture.sessionManager.getEntries().some(entry => entry.type === 'compaction'); i++) {
      await fixture.session.prompt(`continue ${i} ${'x'.repeat(500)}`);
    }
    assert.ok(requests >= 2);
    assert.equal(fixture.sessionManager.getEntries().some(entry => entry.type === 'compaction'), true,
      JSON.stringify({ events: fixture.events.filter(event => event.type.startsWith('compaction')),
        last: fixture.session.messages.filter(message => message.role === 'assistant').at(-1)?.usage,
        enabled: fixture.session.autoCompactionEnabled }));
  } finally { fixture.dispose(); }
});

test('explicit context overflow receives one compact-and-retry with deterministic fake streams', async () => {
  const fixture = await createFixtureSession({ settings: { compaction: { enabled: true, reserveTokens: 1000, keepRecentTokens: 1 } } });
  try {
    seed(fixture.sessionManager);
    let requests = 0;
    fixture.session.agent.streamFunction = (_model, context) => {
      if (JSON.stringify(context).includes('context summarization assistant')) {
        return messageStream(assistantMessage([{ type: 'text', text: 'overflow summary' }]));
      }
      requests++;
      return messageStream(requests === 1
        ? assistantMessage([], { stopReason: 'error', errorMessage: 'maximum context length exceeded' })
        : assistantMessage([{ type: 'text', text: 'recovered' }]));
    };
    await fixture.session.prompt('trigger overflow');
    assert.ok(requests >= 2 && requests <= 4);
    assert.equal(fixture.events.filter(event => event.type === 'agent_start').length, 2);
    assert.equal(fixture.events.filter(event => event.type === 'compaction_start' && event.reason === 'overflow').length, 1,
      JSON.stringify(fixture.events.map(event => ({ type: event.type, reason: event.reason, errorMessage: event.errorMessage }))));
    assert.equal(fixture.session.messages.some(message => message.role === 'assistant' && message.content.some(item => item.text === 'recovered')), true);
  } finally { fixture.dispose(); }
});

test('persistent overflow stops after one recovery cycle without appending another summary', async () => {
  const fixture = await createFixtureSession({ settings: { compaction: { enabled: true, reserveTokens: 1000, keepRecentTokens: 1 } } });
  try {
    seed(fixture.sessionManager);
    let calls = 0;
    fixture.session.agent.streamFunction = (_model, context) => {
      if (JSON.stringify(context).includes('context summarization assistant')) {
        return messageStream(assistantMessage([{ type: 'text', text: 'single recovery summary' }]));
      }
      calls++;
      return messageStream(assistantMessage([], { stopReason: 'error', errorMessage: 'maximum context length exceeded', timestamp: Date.now() + calls * 1000 }));
    };
    await fixture.session.prompt('persistent overflow');
    assert.ok(calls >= 2 && calls <= 8);
    assert.equal(fixture.events.filter(event => event.type === 'compaction_start' && event.reason === 'overflow').length, 1,
      JSON.stringify(fixture.events.map(event => ({ type: event.type, reason: event.reason, errorMessage: event.errorMessage }))));
    assert.equal(fixture.sessionManager.getEntries().filter(entry => entry.type === 'compaction').length, 1,
      JSON.stringify(fixture.events.filter(event => event.type.startsWith('compaction'))));
    assert.equal(fixture.events.some(event => event.type === 'compaction_end' && /after one compact-and-retry attempt/.test(event.errorMessage ?? '')), true,
      JSON.stringify(fixture.events.map(event => ({ type: event.type, reason: event.reason, errorMessage: event.errorMessage }))));
  } finally { fixture.dispose(); }
});
