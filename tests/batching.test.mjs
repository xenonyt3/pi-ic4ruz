import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { sdk } from '../src/upstream.mjs';
import { root } from '../src/paths.mjs';
import { acquireWriterLease, assertWriter, releaseWriterLease } from '../src/workspace-ownership.ts';

const base = path.join(root, 'tests', '.tmp-batching');
fs.mkdirSync(base, { recursive: true });
const workspace = fs.mkdtempSync(path.join(base, 'workspace-'));
const leaseRoot = path.join(root, 'agent', 'writer-leases');
test.after(() => fs.rmSync(workspace, { recursive: true, force: true }));

function barrier(count) {
  let arrive;
  const allStarted = new Promise(resolve => { arrive = resolve; });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let started = 0;
  return { allStarted, release, async enter() { if (++started === count) arrive(); await gate; }, get started() { return started; } };
}

test('O07 independent calls overlap and allSettled retains partial rejection', async () => {
  const gate = barrier(2);
  const events = [];
  const call = async (name, reject = false) => { events.push(`start:${name}`); await gate.enter(); events.push(`finish:${name}`); if (reject) throw new Error(name); return name; };
  const pending = Promise.allSettled([call('a'), call('b', true)]);
  await gate.allStarted;
  assert.equal(gate.started, 2);
  assert.deepEqual(events, ['start:a', 'start:b']);
  gate.release();
  const outcomes = await pending;
  assert.deepEqual(outcomes.map(item => item.status), ['fulfilled', 'rejected']);
});

test('O07 dependent calls are kept sequential', async () => {
  const events = [];
  let finishFirst;
  const firstGate = new Promise(resolve => { finishFirst = resolve; });
  const work = async name => { events.push(`start:${name}`); if (name === 'a') await firstGate; events.push(`finish:${name}`); };
  const sequence = (async () => { await work('a'); await work('b'); })();
  await Promise.resolve();
  assert.deepEqual(events, ['start:a']);
  finishFirst();
  await sequence;
  assert.deepEqual(events, ['start:a', 'finish:a', 'start:b', 'finish:b']);
});

test('O07 upstream queue serializes same file while distinct files overlap', async () => {
  const same = path.join(workspace, 'same.txt');
  let releaseFirst;
  const firstGate = new Promise(resolve => { releaseFirst = resolve; });
  let firstStarted;
  const started = new Promise(resolve => { firstStarted = resolve; });
  const events = [];
  const first = sdk.withFileMutationQueue(same, async () => { events.push('first'); firstStarted(); await firstGate; });
  await started;
  const second = sdk.withFileMutationQueue(same, async () => { events.push('second'); });
  await Promise.resolve();
  assert.deepEqual(events, ['first']);
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(events, ['first', 'second']);
  const gate = barrier(2);
  const cross = Promise.all([
    sdk.withFileMutationQueue(same, () => gate.enter()),
    sdk.withFileMutationQueue(path.join(workspace, 'other.txt'), () => gate.enter()),
  ]);
  await gate.allStarted;
  assert.equal(gate.started, 2);
  gate.release();
  await cross;
});

test('O07 atomic lease blocks second process and requires exact nonce to release', async () => {
  const lease = await acquireWriterLease({ workspace, owner: 'parent', leaseRoot });
  try {
    assertWriter(lease);
    assert.throws(() => assertWriter({ ...lease, nonce: 'forged' }), /WRITER_LEASE_NOT_OWNED/);
    const script = `import { acquireWriterLease } from ${JSON.stringify(pathToFileURL(path.join(root, 'src/workspace-ownership.ts')).href)}; try { await acquireWriterLease({workspace:${JSON.stringify(workspace)}, owner:'child', leaseRoot:${JSON.stringify(leaseRoot)}}); process.exit(2); } catch(e) { if (!String(e).includes('WRITER_BUSY')) process.exit(3); }`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status, 0, result.stderr);
    await assert.rejects(releaseWriterLease(lease, { cleanupConfirmed: false }), /WRITER_CLEANUP_UNCONFIRMED/);
  } finally { await releaseWriterLease(lease, { cleanupConfirmed: true }); }
});
