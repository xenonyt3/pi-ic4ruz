import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createChildSupervisor } from '../src/child-supervisor.ts';
import { loadChildProfiles, resolveChildSpec } from '../src/child-profiles.ts';

const config = loadChildProfiles(new URL('../config/child-profiles.json', import.meta.url).pathname.replace(/^\/(?=[A-Z]:)/, ''));
const allTools = ['read', 'grep', 'find', 'ls', 'edit', 'write', 'bash', 'powershell', 'agents_spawn'];
function fixture(transport) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-t4-'));
  const supervisor = createChildSupervisor({ registryDir: dir, ownerSession: 'parent', ownerBranch: 'main',
    config, parentGrantedTools: allTools, runtimeTools: allTools, transport });
  return { dir, supervisor };
}
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
const task = (n, profile = 'code_explorer') => ({ title: `Task ${n}`, prompt: `assignment ${n}`, profile });

test('profile and model are explicit; recursive tools never enter child ceiling', () => {
  assert.throws(() => resolveChildSpec(config, { profile: 'unknown' }, allTools, allTools), /UNKNOWN_CHILD_PROFILE/);
  assert.throws(() => resolveChildSpec(config, { profile: 'default', model_slot: 'unknown' }, allTools, allTools), /UNKNOWN_MODEL_SLOT/);
  const spec = resolveChildSpec(config, { profile: 'code_explorer' }, allTools, allTools);
  assert.deepEqual(spec.tools, ['read', 'grep', 'find', 'ls']);
  assert.equal(spec.model.provider, '9router');
});

test('atomic starting reservations cap concurrent spawn at three without queue', async () => {
  const starts = [], gates = [];
  const transport = { async start(record, assignment) {
    starts.push({ record, assignment }); const gate = deferred(); gates.push(gate);
    return { pid: 1, sessionPath: `fixture/${record.id}`, done: gate.promise, cancel: async () => true };
  } };
  const { dir, supervisor } = fixture(transport);
  const [a, b] = await Promise.all([supervisor.spawnTasks([task(1), task(2)]), supervisor.spawnTasks([task(3), task(4)])]);
  assert.equal(a.count + b.count, 3);
  assert.equal(starts.length, 3);
  assert.equal(supervisor.activeCount(), 3);
  assert.deepEqual(starts.map(x => x.assignment), ['assignment 1', 'assignment 3', 'assignment 2']);
  gates[0].resolve({ status: 'completed', text: 'answer 1' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(supervisor.activeCount(), 2);
  const next = await supervisor.spawnTasks([task(5)]);
  assert.equal(next.count, 1);
  assert.equal(supervisor.claimResult(a.sessions[0].id)?.text, 'answer 1');
  assert.equal(supervisor.claimResult(a.sessions[0].id), null);
  const restarted = createChildSupervisor({ registryDir: dir, ownerSession: 'wrong', ownerBranch: 'main', config, parentGrantedTools: allTools, runtimeTools: allTools, transport });
  assert.throws(() => restarted.get(a.sessions[0].id), /CHILD_OWNER_MISMATCH/);
});

test('partial prefix, timeout, busy follow-up, same session generation and durable claim', async () => {
  let startCount = 0; const gate = deferred();
  const transport = {
    async start(record) { startCount++; if (startCount === 2) throw new Error('fixture startup failed'); return { pid: 2, sessionPath: `fixture/${record.id}`, done: gate.promise, cancel: async () => true }; },
    async resume(record, prompt) { assert.equal(prompt, 'next assignment'); return { pid: 3, sessionPath: record.sessionPath, done: Promise.resolve({ status: 'completed', text: 'follow-up' }), cancel: async () => true }; }
  };
  const { dir, supervisor } = fixture(transport);
  const spawn = await supervisor.spawnTasks([task(1), task(2), task(3)]);
  assert.equal(spawn.count, 1); assert.equal(spawn.partial, true); assert.equal(startCount, 2);
  const id = spawn.sessions[0].id;
  assert.equal((await supervisor.wait([id], 0))[0].status, 'running');
  await assert.rejects(supervisor.send(id, 'next assignment'), /CHILD_BUSY/);
  gate.resolve({ status: 'completed', text: 'full reply' });
  await new Promise(resolve => setImmediate(resolve));
  const first = await supervisor.wait([id], 0);
  assert.equal(first[0].session.reply.text, 'full reply');
  assert.equal(first[0].delivery.text, 'full reply');
  assert.equal((await supervisor.wait([id], 0))[0].delivery, null);
  const restarted = createChildSupervisor({ registryDir: dir, ownerSession: 'parent', ownerBranch: 'main', config, parentGrantedTools: allTools, runtimeTools: allTools, transport });
  assert.equal(restarted.claimResult(id), null);
  assert.equal((await supervisor.send(id, 'next assignment')).generation, 2);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(supervisor.get(id).id, id);
  assert.equal(supervisor.get(id).reply.text, 'follow-up');
});

test('cleanup unconfirmed retains capacity; cancel is idempotent', async () => {
  const transport = { async start(record) { return { pid: 4, sessionPath: `fixture/${record.id}`, done: new Promise(() => {}), cancel: async () => false }; } };
  const { supervisor } = fixture(transport);
  const ids = (await supervisor.spawnTasks([task(1), task(2), task(3)])).subagent_session_ids;
  assert.equal((await supervisor.cancel(ids[0])).cleanup_confirmed, false);
  assert.equal((await supervisor.cancel(ids[0])).cleanup_confirmed, false);
  assert.equal(supervisor.activeCount(), 3);
  assert.equal((await supervisor.spawnTasks([task(4)])).count, 0);
});

test('follow-up respects global capacity and stale owner records are untouched', async () => {
  const gates = [];
  const transport = { async start(record) { const gate = deferred(); gates.push(gate); return { pid: 10, sessionPath: `fixture/${record.id}`, done: gate.promise, cancel: async () => true }; },
    async resume(record) { const gate = deferred(); gates.push(gate); return { pid: 11, sessionPath: record.sessionPath, done: gate.promise, cancel: async () => true }; } };
  const { dir, supervisor } = fixture(transport);
  const first = await supervisor.spawnTasks([task(1)]);
  const id = first.subagent_session_ids[0];
  gates[0].resolve({ status: 'completed', text: 'one' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal((await supervisor.spawnTasks([task(2), task(3), task(4)])).count, 3);
  await assert.rejects(supervisor.send(id, 'follow-up'), /CHILD_CAPACITY_FULL/);
  const foreign = createChildSupervisor({ registryDir: dir, ownerSession: 'foreign', ownerBranch: 'other', config,
    parentGrantedTools: allTools, runtimeTools: allTools, transport });
  assert.equal(foreign.activeCount(), 3);
  assert.equal(foreign.list().length, 0);
  assert.equal(supervisor.get(first.subagent_session_ids[0]).status, 'completed');
});

test('duplicate keys and unconfirmed startup failure never run a suffix', async () => {
  let starts = 0;
  const { supervisor } = fixture({ async start() { starts++; const error = new Error('start failed'); error.cleanupConfirmed = false; throw error; } });
  await assert.rejects(supervisor.spawnTasks([{ ...task(1), task_key: 'same' }, { ...task(2), task_key: 'same' }]), /DUPLICATE_TASK_KEY/);
  assert.equal(starts, 0);
  const result = await supervisor.spawnTasks([task(1), task(2)]);
  assert.equal(result.count, 0);
  assert.equal(starts, 1);
  assert.equal(supervisor.activeCount(), 1);
});
