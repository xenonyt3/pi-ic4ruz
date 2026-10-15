import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { createFixtureSession, assistantMessage, messageStream, runTool } from './helpers/session.mjs';

const compaction = await import(new URL('../runtime/node_modules/@earendil-works/pi-coding-agent/dist/core/compaction/compaction.js',import.meta.url).href);

test('upstream threshold is strictly above contextWindow minus reserve', () => {
  const settings = { enabled: true, reserveTokens: 16384, keepRecentTokens: 20000 };
  assert.equal(compaction.shouldCompact(255615, 272000, settings), false);
  assert.equal(compaction.shouldCompact(255616, 272000, settings), false);
  assert.equal(compaction.shouldCompact(255617, 272000, settings), true);
  assert.equal(compaction.shouldCompact(3617, 20000, settings), true);
});

test('upstream rejects unusable summary response', () => {
  assert.match(compaction.getSummarizationFailure({ stopReason: 'length', content: [{ type: 'text', text: 'partial' }] }, 'summary'), /token cap|incomplete/i);
  assert.match(compaction.getSummarizationFailure({ stopReason: 'error', errorMessage: 'failed', content: [] }, 'summary'), /fail|error/i);
});

function appendTurns(manager) {
  for (let i = 0; i < 4; i++) {
    manager.appendMessage({ role: 'user', content: [{ type: 'text', text: `question ${i}` }], timestamp: Date.now() });
    manager.appendMessage(assistantMessage([{ type: 'text', text: `answer ${i}` }]));
  }
}

test('AgentSession compaction persists fake summary and keeps original branch history', async () => {
  const fixture = await createFixtureSession({ settings: { compaction: { enabled: true, reserveTokens: 1000, keepRecentTokens: 1 } } });
  try {
    appendTurns(fixture.sessionManager);
    const before = fixture.sessionManager.getEntries().length;
    fixture.modelRuntime.streamSimple = () => messageStream(assistantMessage([{ type: 'text', text: 'offline summary marker' }]));
    const result = await fixture.session.compact();
    assert.match(result.summary, /offline summary marker/);
    assert.equal(fixture.sessionManager.getEntries().length, before + 1);
    assert.equal(fixture.sessionManager.getBranch().at(-1).type, 'compaction');
    assert.equal(fixture.events.some(event => event.type === 'compaction_end' && !event.errorMessage), true);
  } finally { fixture.dispose(); }
});

test('failed AgentSession compaction does not append a false checkpoint', async () => {
  const fixture = await createFixtureSession({ settings: { compaction: { enabled: true, reserveTokens: 1000, keepRecentTokens: 1 } } });
  try {
    appendTurns(fixture.sessionManager);
    const before = fixture.sessionManager.getEntries().length;
    fixture.modelRuntime.streamSimple = () => messageStream(assistantMessage([{ type: 'text', text: 'partial' }], { stopReason: 'length' }));
    await assert.rejects(fixture.session.compact(), /token cap|incomplete/i);
    assert.equal(fixture.sessionManager.getEntries().length, before);
    assert.equal(fixture.sessionManager.getEntries().some(entry => entry.type === 'compaction'), false);
    assert.equal(fixture.events.some(event => event.type === 'compaction_end' && event.errorMessage), true);
  } finally { fixture.dispose(); }
});

test('cancelled AgentSession compaction keeps history and reports aborted', async () => {
  const fixture = await createFixtureSession({
    settings: { compaction: { enabled: true, reserveTokens: 1000, keepRecentTokens: 1 } },
    extensions: [pi => pi.on('session_before_compact', () => ({ cancel: true }))],
  });
  try {
    appendTurns(fixture.sessionManager);
    const before = fixture.sessionManager.getEntries().length;
    await assert.rejects(fixture.session.compact(), /cancel/i);
    assert.equal(fixture.sessionManager.getEntries().length, before);
    assert.equal(fixture.events.some(event => event.type === 'compaction_end' && event.aborted), true);
  } finally { fixture.dispose(); }
});

test('second AgentSession compaction sends previous summary to fake summarizer', async () => {
  const fixture = await createFixtureSession({ settings: { compaction: { enabled: true, reserveTokens: 1000, keepRecentTokens: 1 } } });
  try {
    appendTurns(fixture.sessionManager);
    fixture.modelRuntime.streamSimple = () => messageStream(assistantMessage([{ type: 'text', text: 'first summary marker' }]));
    await fixture.session.compact();
    appendTurns(fixture.sessionManager);
    const requests = [];
    fixture.modelRuntime.streamSimple = (_model, context) => {
      requests.push(context);
      return messageStream(assistantMessage([{ type: 'text', text: 'second summary marker' }]));
    };
    const result = await fixture.session.compact();
    assert.match(JSON.stringify(requests), /first summary marker/);
    assert.match(result.summary, /second summary marker/);
    assert.equal(fixture.sessionManager.getEntries().filter(entry => entry.type === 'compaction').length, 2);
  } finally { fixture.dispose(); }
});

test('AgentSession compaction keeps retained tool call and result paired', async () => {
  const fixture = await createFixtureSession({ settings: { compaction: { enabled: true, reserveTokens: 1000, keepRecentTokens: 300 } } });
  try {
    appendTurns(fixture.sessionManager);
    const input = path.join(fixture.cwd, 'tool-pair.txt');
    fs.writeFileSync(input, 'fixture text');
    await runTool(fixture, 'read', { path: input });
    fixture.modelRuntime.streamSimple = () => messageStream(assistantMessage([{ type: 'text', text: 'paired summary' }]));
    await fixture.session.compact();
    const messages = fixture.sessionManager.buildSessionProjection().messages;
    const callIds = new Set(messages.flatMap(message => message.role === 'assistant' ? message.content.filter(item => item.type === 'toolCall').map(item => item.id) : []));
    for (const message of messages.filter(message => message.role === 'toolResult')) assert.equal(callIds.has(message.toolCallId), true);
    assert.equal(messages.some(message => message.role === 'toolResult'), true);
  } finally { fixture.dispose(); }
});
