import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createChildSupervisor } from '../src/child-supervisor.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const prototype = 'D:/pi-reason-prototype';
const fixtureConfig = {
  schemaVersion: 1,
  profiles: { code_explorer: { systemPrompt: 'Read the assigned file and report the finding.', tools: ['read'] } },
  modelSlots: { primary: { provider: '9router', model: 'cx/gpt-6-astra', thinkingLevel: 'low' } }
};
function supervisorOptions(temp, modelBroker) {
  return { registryDir: path.join(temp, 'registry'), ownerSession: 'broker-parent', ownerBranch: 'main',
    config: fixtureConfig, parentGrantedTools: ['read'], runtimeTools: ['read'],
    runner: path.join(here, '../src/child-runner.mjs'),
    offlineGuard: path.join(prototype, 'src/offline-guard.mjs'), upstreamPath: path.join(prototype, 'src/upstream.mjs'),
    policyPath: path.join(prototype, 'src/tool-policy.ts'), agentDir: path.join(temp, 'agent'),
    sessionDir: path.join(temp, 'sessions'), cwd: temp, offline: true, modelBroker };
}
function answer(model, content, stopReason) {
  return { role: 'assistant', api: model.api, provider: model.provider, model: model.id,
    content, stopReason, timestamp: Date.now(), usage: { input: 10, output: 2, cacheRead: 0, cacheWrite: 0,
      totalTokens: 12, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
}

test('real SDK worker brokers two model turns around read tool, preserving model, effort, assignment and real reply', { timeout: 30000 }, async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-t5-broker-'));
  fs.writeFileSync(path.join(temp, 'fact.txt'), 'the fixture fact');
  const calls = [];
  const broker = async ({ model, context, options }, { record, signal }) => {
    assert.equal(record.profile, 'code_explorer');
    assert.equal(signal.aborted, false);
    assert.equal(model.provider, '9router');
    assert.equal(model.id, 'cx/gpt-6-astra');
    assert.equal(options.reasoning, 'low');
    assert.equal('apiKey' in options, false);
    assert.equal('headers' in options, false);
    assert.equal('env' in options, false);
    calls.push({ model, context, options });
    if (calls.length === 1) {
      const users = context.messages.filter(message => message.role === 'user');
      assert.equal(users.at(-1).content.filter(item => item.type === 'text').map(item => item.text).join(''), 'Read fact.txt exactly');
      return answer(model, [{ type: 'toolCall', id: 'read-1', name: 'read', arguments: { path: 'fact.txt' } }], 'toolUse');
    }
    const results = context.messages.filter(message => message.role === 'toolResult');
    assert.ok(results.some(result => result.content.some(item => item.type === 'text' && item.text.includes('the fixture fact'))));
    return answer(model, [{ type: 'text', text: 'Found: the fixture fact' }], 'stop');
  };
  const supervisor = createChildSupervisor(supervisorOptions(temp, broker));
  const spawned = await supervisor.spawnTasks([{ prompt: 'Read fact.txt exactly', profile: 'code_explorer' }]);
  assert.equal(spawned.count, 1, JSON.stringify(supervisor.list()));
  const receipt = (await supervisor.wait(spawned.subagent_session_ids, 15000))[0];
  assert.equal(receipt.status, 'completed', JSON.stringify(receipt));
  assert.equal(receipt.session.reply.text, 'Found: the fixture fact');
  assert.equal(calls.length, 2);
  assert.equal(supervisor.activeCount(), 0);
});

test('cancelling a blocked provider request aborts parent broker and settles worker', { timeout: 30000 }, async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-t5-broker-cancel-'));
  let started;
  const called = new Promise(resolve => { started = resolve; });
  let aborted = false;
  const broker = (_request, { signal }) => {
    started();
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => { aborted = true; reject(new Error('ABORTED_BY_CHILD')); }, { once: true }));
  };
  const supervisor = createChildSupervisor(supervisorOptions(temp, broker));
  const spawned = await supervisor.spawnTasks([{ prompt: 'Wait for cancellation', profile: 'code_explorer' }]);
  assert.equal(spawned.count, 1, JSON.stringify(supervisor.list()));
  await called;
  const cancelled = await supervisor.cancel(spawned.subagent_session_ids[0]);
  assert.equal(aborted, true);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.cleanup_confirmed, true);
  assert.equal(supervisor.activeCount(), 0);
});
