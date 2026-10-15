import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { createChildSupervisor } from '../src/child-supervisor.ts';
import { loadChildProfiles } from '../src/child-profiles.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const prototype = 'D:/pi-reason-prototype';
const config = loadChildProfiles(path.join(here, '../config/child-profiles.json'));
const stagedSrc = path.join(here, '../src');

test('real offline worker creates isolated Pi SDK session and exits without inference', { timeout: 30000 }, async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-t4-process-'));
  const supervisor = createChildSupervisor({
    registryDir: path.join(temp, 'registry'), ownerSession: 'parent-process', ownerBranch: 'main',
    config, parentGrantedTools: ['read', 'grep', 'find', 'ls'], runtimeTools: ['read', 'grep', 'find', 'ls'],
    runner: path.join(here, '../src/child-runner.mjs'),
    offlineGuard: path.join(prototype, 'src/offline-guard.mjs'),
    upstreamPath: path.join(prototype, 'src/upstream.mjs'),
    policyPath: path.join(prototype, 'src/tool-policy.ts'), codemodePath: path.join(prototype, 'src/codemode-policy.ts'),
    agentDir: path.join(temp, 'agent'), sessionDir: path.join(temp, 'sessions'), cwd: temp, offline: true
  });
  const result = await supervisor.spawnTasks([{ prompt: 'Read the fixture and report it', profile: 'code_explorer' }]);
  assert.equal(result.count, 1, JSON.stringify(supervisor.list()));
  const receipt = (await supervisor.wait([result.subagent_session_ids[0]], 10000))[0];
  assert.equal(receipt.status, 'completed', JSON.stringify(receipt));
  assert.equal(receipt.session.reply.text, 'OFFLINE_FIXTURE_REPLY:Read the fixture and report it');
  assert.equal(supervisor.activeCount(), 0);
  assert.match(supervisor.get(receipt.id).sessionPath, /sessions/);
  assert.equal(fs.existsSync(supervisor.get(receipt.id).sessionPath), true);
  const followup = await supervisor.send(receipt.id, 'A second exact assignment');
  assert.equal(followup.id, receipt.id);
  assert.equal(followup.generation, 2);
  assert.equal((await supervisor.wait([receipt.id], 10000))[0].status, 'completed');
  assert.equal(supervisor.get(receipt.id).reply.text, 'OFFLINE_FIXTURE_REPLY:A second exact assignment');
});

test('cancel settles a real delayed worker and confirms process exit', { timeout: 30000 }, async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-t4-cancel-'));
  const supervisor = createChildSupervisor({
    registryDir: path.join(temp, 'registry'), ownerSession: 'parent-cancel', ownerBranch: 'main',
    config, parentGrantedTools: ['read', 'grep', 'find', 'ls'], runtimeTools: ['read', 'grep', 'find', 'ls'],
    runner: path.join(here, '../src/child-runner.mjs'), offlineGuard: path.join(prototype, 'src/offline-guard.mjs'),
    upstreamPath: path.join(prototype, 'src/upstream.mjs'), agentDir: path.join(temp, 'agent'),
    policyPath: path.join(prototype, 'src/tool-policy.ts'), codemodePath: path.join(prototype, 'src/codemode-policy.ts'),
    sessionDir: path.join(temp, 'sessions'), cwd: temp, offline: true, offlineDelayMs: 5000
  });
  const started = await supervisor.spawnTasks([{ prompt: 'Delayed assignment', profile: 'code_explorer' }]);
  assert.equal(started.count, 1);
  const id = started.subagent_session_ids[0];
  assert.equal(supervisor.get(id).status, 'running');
  const cancelled = await supervisor.cancel(id);
  assert.deepEqual(cancelled, { id, status: 'cancelled', cleanup_confirmed: true });
  assert.equal(supervisor.activeCount(), 0);
  assert.equal(supervisor.get(id).reply, undefined);
});

test('IPC parent disconnect stops a delayed worker without ghost completion', { timeout: 30000 }, async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-t4-disconnect-'));
  const runner = path.join(here, '../src/child-runner.mjs');
  const guard = path.join(prototype, 'src/offline-guard.mjs');
  const child = spawn(process.execPath, ['--import', pathToFileURL(guard).href, runner], {
    cwd: temp, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    env: { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, TEMP: process.env.TEMP,
      TMP: process.env.TMP, USERPROFILE: temp, HOME: temp, PI_REASON_CHILD: '1', PI_REASON_OFFLINE: '1' }
  });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  const response = new Promise(resolve => child.on('message', message => { if (message.requestId === 'start') resolve(message); }));
  const exit = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
  const id = crypto.randomUUID();
  child.send({ type: 'start', requestId: 'start', record: { id, profile: 'code_explorer', owner: { session: 'parent', branch: 'main' } },
    assignment: 'Never run after disconnect', spec: { model: config.modelSlots.primary, systemPrompt: config.profiles.code_explorer.systemPrompt,
      tools: config.profiles.code_explorer.tools }, upstreamPath: path.join(prototype, 'src/upstream.mjs'),
    policyPath: path.join(prototype, 'src/tool-policy.ts'), codemodePath: path.join(prototype, 'src/codemode-policy.ts'),
    agentDir: path.join(temp, 'agent'), sessionDir: path.join(temp, 'sessions'), workspace: temp, offline: true, offlineDelayMs: 5000 });
  assert.equal((await response).ok, true, stderr);
  child.disconnect();
  const outcome = await Promise.race([exit, new Promise((_, reject) => setTimeout(() => reject(new Error('WORKER_GHOST_AFTER_DISCONNECT')), 10000))]);
  assert.notEqual(outcome.code, null);
});

test('default worker holds one writer lease and writes only through owned tool', { timeout: 30000 }, async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-t4-writer-'));
  const leaseRoot = path.join(here, '../agent/writer-leases');
  const supervisor = createChildSupervisor({
    registryDir: path.join(temp, 'registry'), ownerSession: 'parent-writer', ownerBranch: 'main',
    config, parentGrantedTools: ['read', 'grep', 'find', 'ls', 'write', 'edit', 'bash', 'powershell', 'codemode'],
    runtimeTools: ['read', 'grep', 'find', 'ls', 'write', 'edit', 'bash', 'powershell', 'codemode'],
    runner: path.join(stagedSrc, 'child-runner.mjs'), offlineGuard: path.join(prototype, 'src/offline-guard.mjs'),
    upstreamPath: path.join(prototype, 'src/upstream.mjs'), policyPath: path.join(stagedSrc, 'tool-policy.ts'),
    codemodePath: path.join(stagedSrc, 'codemode-policy.ts'), windowsToolsPath: path.join(stagedSrc, 'windows-tools.ts'),
    writerLeasePath: path.join(stagedSrc, 'workspace-ownership.ts'), leaseRoot,
    agentDir: path.join(temp, 'agent'), sessionDir: path.join(temp, 'sessions'), cwd: temp,
    offline: true, offlineScenario: 'write', offlineDelayMs: 1500
  });
  const started = await supervisor.spawnTasks([{ prompt: 'Write the fixture', profile: 'default' }]);
  assert.equal(started.count, 1, JSON.stringify(supervisor.list()));
  const { acquireWriterLease } = await import(pathToFileURL(path.join(stagedSrc, 'workspace-ownership.ts')).href);
  await assert.rejects(acquireWriterLease({ workspace: temp, owner: 'parent', leaseRoot }), /WRITER_BUSY/);
  const receipt = (await supervisor.wait(started.subagent_session_ids, 10000))[0];
  assert.equal(receipt.status, 'completed', JSON.stringify(receipt));
  assert.equal(receipt.session.reply.text, 'OFFLINE_FIXTURE_REPLY:Write the fixture:TOOL_OK');
  assert.equal(fs.readFileSync(path.join(temp, 'child-output.txt'), 'utf8'), 'written by offline child');
  const lease = await acquireWriterLease({ workspace: temp, owner: 'parent', leaseRoot });
  const { releaseWriterLease } = await import(pathToFileURL(path.join(stagedSrc, 'workspace-ownership.ts')).href);
  await releaseWriterLease(lease, { cleanupConfirmed: true });
});

test('code explorer host rejects outside paths and forbidden writes, including nested tools', { timeout: 60000 }, async () => {
  for (const scenario of ['outside_read', 'nested_outside_read', 'forbidden_write']) {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), `pi-t4-${scenario}-`));
    const supervisor = createChildSupervisor({
      registryDir: path.join(temp, 'registry'), ownerSession: `parent-${scenario}`, ownerBranch: 'main',
      config, parentGrantedTools: ['read', 'grep', 'find', 'ls', 'codemode', 'write'],
      runtimeTools: ['read', 'grep', 'find', 'ls', 'codemode', 'write'],
      runner: path.join(stagedSrc, 'child-runner.mjs'), offlineGuard: path.join(prototype, 'src/offline-guard.mjs'),
      upstreamPath: path.join(prototype, 'src/upstream.mjs'), policyPath: path.join(stagedSrc, 'tool-policy.ts'),
      codemodePath: path.join(stagedSrc, 'codemode-policy.ts'),
      agentDir: path.join(temp, 'agent'), sessionDir: path.join(temp, 'sessions'), cwd: temp,
      offline: true, offlineScenario: scenario
    });
    const spawned = await supervisor.spawnTasks([{ prompt: `Check ${scenario}`, profile: 'code_explorer' }]);
    assert.equal(spawned.count, 1, `${scenario}: ${JSON.stringify(supervisor.list())}`);
    const receipt = (await supervisor.wait(spawned.subagent_session_ids, 10000))[0];
    assert.equal(receipt.status, 'completed', `${scenario}: ${JSON.stringify(receipt)}`);
    assert.match(receipt.session.reply.text, /TOOL_ERROR/, scenario);
    assert.equal(fs.existsSync(path.join(temp, 'forbidden.txt')), false);
  }
});
