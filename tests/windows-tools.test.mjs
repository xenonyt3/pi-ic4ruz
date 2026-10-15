import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { root } from '../src/paths.mjs';
import { createOwnedShellOperations, registerWindowsTools } from '../src/windows-tools.ts';
import { acquireWriterLease, assertWriter, getWriterLeaseState, releaseWriterLease } from '../src/workspace-ownership.ts';
import * as lifecycle from '../src/process-lifecycle.mjs';

const base = path.join(root, 'tests', '.tmp-windows');
fs.mkdirSync(base, { recursive: true });
const workspace = fs.mkdtempSync(path.join(base, 'shell-'));
const leaseRoot = path.join(root, 'agent', 'writer-leases');
test.after(() => fs.rmSync(workspace, { recursive: true, force: true }));

async function execute(shell, command, options = {}) {
  const output = [];
  const operations = createOwnedShellOperations({ workspace, owner: 'shell-test', leaseRoot, shell, ...options });
  const result = await operations.exec(command, workspace, { onData: bytes => output.push(bytes), ...options.exec });
  return { result, text: Buffer.concat(output).toString('utf8') };
}

test('O06 upstream shell definitions keep bash direct and PowerShell deferred', () => {
  const registered = [];
  const names = registerWindowsTools({ registerTool: tool => registered.push(tool) }, { cwd: workspace, owner: 'shell-test', leaseRoot });
  assert.deepEqual(names, ['bash', 'powershell']);
  assert.equal(registered[0].name, 'bash');
  assert.equal(registered[0].exposure, 'direct');
  assert.equal(registered[1].name, 'powershell');
  assert.equal(registered[1].exposure, 'deferred');
  assert.equal(registered[1].defaultActive, false);
  assert.equal(registered[0].parameters.properties.timeout.description.includes('seconds'), true);
});

test('O06 Bash and PowerShell preserve stdout, stderr, cwd, and exit 7', async () => {
  const bash = await execute('bash', 'pwd; printf out; printf err >&2; exit 7');
  assert.equal(bash.result.exitCode, 7);
  assert.match(bash.text, /out/);
  assert.match(bash.text, /err/);
  assert.match(bash.text.toLowerCase(), /shell-/);
  const ps = await execute('powershell', 'Write-Output out; [Console]::Error.WriteLine("err"); exit 7');
  assert.equal(ps.result.exitCode, 7);
  assert.match(ps.text, /out/);
  assert.match(ps.text, /err/);
});

test('O06 upstream bash keeps direct output cap separate from structured output', async () => {
  const registered = [];
  registerWindowsTools({ registerTool: tool => registered.push(tool) }, { cwd: workspace, owner: 'shell-test', leaseRoot, enablePowerShell: false });
  const bash = registered[0];
  const result = await bash.execute('long-output', { command: "node -e 'process.stdout.write(\"x\".repeat(60000))'" }, undefined, undefined, undefined);
  const visible = result.content.filter(block => block.type === 'text').map(block => block.text).join('');
  assert.ok(visible.length < 60000);
  assert.ok(result.structuredContent.output.length >= 60000);
  assert.equal(result.structuredContent.truncated, false);
  const large = await bash.execute('very-long-output', { command: "node -e 'process.stdout.write(\"y\".repeat(1100000))'" }, undefined, undefined, undefined);
  assert.equal(large.structuredContent.truncated, true);
  assert.ok(large.structuredContent.output.length <= 1024 * 1024 + 128);
  assert.ok(large.structuredContent.full_output_path);
});

test('O06 timeout is seconds and abort stops an owned shell', async () => {
  const operations = createOwnedShellOperations({ workspace, owner: 'shell-test', leaseRoot, shell: 'bash' });
  await assert.rejects(operations.exec('sleep 10', workspace, { onData: () => {}, timeout: 0.3 }), /TIMEOUT/);
  const controller = new AbortController();
  const pending = operations.exec('sleep 10', workspace, { onData: () => {}, signal: controller.signal });
  setTimeout(() => controller.abort(), 200);
  await assert.rejects(pending, /ABORTED/);
});

test('O06 timeout confirms ordinary child-tree descendant exit', async () => {
  const script = path.join(workspace, 'child-tree.cjs');
  fs.writeFileSync(script, 'const {spawn}=require("node:child_process"); const child=spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"inherit"}); console.log("DESC="+child.pid); setInterval(()=>{},1000);');
  let output = '';
  const operations = createOwnedShellOperations({ workspace, owner: 'shell-test', leaseRoot, shell: 'bash' });
  await assert.rejects(operations.exec(`node "${script.replaceAll('\\', '/')}"`, workspace, {
    onData: data => { output += data.toString('utf8'); }, timeout: 1,
  }), /TIMEOUT/);
  const pid = Number(output.match(/DESC=(\d+)/)?.[1]);
  assert.ok(Number.isSafeInteger(pid), output);
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
});

test('O07 preheld writer lease is borrowed and retained across shell call', async () => {
  const lease = await acquireWriterLease({ workspace, owner: 'shell-test', leaseRoot });
  try {
    const output = await execute('bash', 'printf borrowed', { existingLease: lease });
    assert.match(output.text, /borrowed/);
    assertWriter(lease);
    await assert.rejects(acquireWriterLease({ workspace, owner: 'other', leaseRoot }), /WRITER_BUSY/);
  } finally { await releaseWriterLease(lease, { cleanupConfirmed: true }); }
});

test('O07 dynamic lease is borrowed and cleanup_unconfirmed retains the writer', async () => {
  const lease = await acquireWriterLease({ workspace, owner: 'shell-test', leaseRoot });
  try {
    const operations = createOwnedShellOperations({ workspace, owner: 'shell-test', leaseRoot, shell: 'bash',
      getExistingLease: () => lease,
      lifecycle: { ...lifecycle, async terminateTreeAndConfirm(child) {
        const actual = await lifecycle.terminateTreeAndConfirm(child);
        assert.equal(actual.status, 'confirmed');
        return { ...actual, status: 'cleanup_unconfirmed' };
      } },
    });
    await assert.rejects(operations.exec('sleep 10', workspace, { onData: () => {}, timeout: 0.2 }), /CLEANUP_UNCONFIRMED/);
    assertWriter(lease);
    assert.equal(getWriterLeaseState(lease), 'cleanup_unconfirmed');
    await assert.rejects(acquireWriterLease({ workspace, owner: 'other', leaseRoot }), /WRITER_BUSY/);
    await assert.rejects(releaseWriterLease(lease, { cleanupConfirmed: true }), /WRITER_RECOVERY_REQUIRED/);
  } finally { await releaseWriterLease(lease, { cleanupConfirmed: true, recoveryConfirmed: true }); }
});

test('O06 shell cwd junction outside workspace is rejected before spawn', async () => {
  const outside = fs.mkdtempSync(path.join(base, 'outside-'));
  const link = path.join(workspace, 'outside-junction');
  fs.symlinkSync(outside, link, 'junction');
  try {
    const operations = createOwnedShellOperations({ workspace, owner: 'shell-test', leaseRoot, shell: 'bash' });
    await assert.rejects(operations.exec('printf never', link, { onData: () => {} }), /WORKSPACE_CWD_ESCAPE/);
  } finally {
    fs.rmdirSync(link);
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('O06 exited owned parent never sends stale PID to taskkill', async () => {
  const child = lifecycle.spawnOwnedProcess(process.execPath, ['-e', ''], { cwd: workspace, stdio: 'ignore' });
  await new Promise(resolve => child.once('close', resolve));
  const cleanup = await lifecycle.terminateTreeAndConfirm(child);
  assert.equal(cleanup.status, 'cleanup_unconfirmed');
  assert.match(cleanup.reason, /already exited/);
});
