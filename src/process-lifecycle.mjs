import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);
// Explicit termination verifies a snapshot of the owned Windows process tree.
// A detached grandchild can outlive a normally exiting shell without holding its stdio;
// this is not an OS Job Object and cannot prove universal descendant cleanup.
const owned = new Map();
const issued = new WeakSet();
const taskkill = path.join(process.env.SystemRoot || 'C:/Windows', 'System32/taskkill.exe');
const powershell = path.join(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');

function alive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { return error?.code !== 'ESRCH'; }
}

async function descendantPids(pid) {
  if (process.platform !== 'win32') return { pids: [], observed: true };
  try {
    const script = 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress';
    const { stdout } = await execFileAsync(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 5000, maxBuffer: 2 * 1024 * 1024 });
    const rows = JSON.parse(stdout.trim());
    const all = Array.isArray(rows) ? rows : [rows];
    const children = [];
    const frontier = [pid];
    while (frontier.length) {
      const parent = frontier.shift();
      for (const row of all) if (row.ParentProcessId === parent && !children.includes(row.ProcessId)) {
        children.push(row.ProcessId); frontier.push(row.ProcessId);
      }
    }
    return { pids: children, observed: true };
  } catch (error) { return { pids: [], observed: false, error: String(error) }; }
}

export function spawnOwnedProcess(command, args, options = {}) {
  const child = spawn(command, args, { ...options, windowsHide: true });
  issued.add(child);
  if (child.pid) owned.set(child.pid, child);
  child.once('close', () => { if (child.pid) owned.delete(child.pid); });
  child.once('error', () => { if (child.pid) owned.delete(child.pid); });
  return child;
}

export async function terminateTreeAndConfirm(childOrPid, { confirmMs = 5000, pollMs = 75 } = {}) {
  const pid = typeof childOrPid === 'number' ? childOrPid : childOrPid?.pid;
  if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('PROCESS_NOT_OWNED');
  const child = typeof childOrPid === 'number' ? owned.get(pid) : childOrPid;
  if (!child || !issued.has(child) || (owned.has(pid) && owned.get(pid) !== child)) throw new Error('PROCESS_NOT_OWNED');
  // An exited PID can be reused. Never pass that raw number to taskkill.
  if (child.exitCode !== null || child.signalCode !== null || !owned.has(pid)) {
    return { status: 'cleanup_unconfirmed', pid, descendants: [], surviving: [], reason: 'owned parent already exited; descendant identity cannot be confirmed' };
  }
  const snapshot = await descendantPids(pid);
  const descendants = snapshot.pids;
  if (child.exitCode !== null || child.signalCode !== null || !owned.has(pid)) {
    return { status: 'cleanup_unconfirmed', pid, descendants, surviving: descendants.filter(alive), reason: 'owned parent exited before taskkill' };
  }
  let killError;
  if (process.platform === 'win32') {
    try { await execFileAsync(taskkill, ['/PID', String(pid), '/T', '/F'], { windowsHide: true, timeout: confirmMs, maxBuffer: 128 * 1024 }); }
    catch (error) { killError = error; }
  } else {
    try { process.kill(-pid, 'SIGKILL'); } catch (error) { killError = error; }
  }
  const deadline = Date.now() + confirmMs;
  while (Date.now() < deadline) {
    if (![pid, ...descendants].some(alive)) {
      return snapshot.observed
        ? { status: 'confirmed', pid, descendants, killError: killError?.message }
        : { status: 'cleanup_unconfirmed', pid, descendants, surviving: [], snapshotError: snapshot.error, killError: killError?.message };
    }
    await new Promise(resolve => setTimeout(resolve, pollMs));
  }
  const surviving = [pid, ...descendants].filter(alive);
  return { status: 'cleanup_unconfirmed', pid, descendants, surviving, snapshotError: snapshot.error, killError: killError?.message };
}

export function getOwnedProcessPids() { return [...owned.keys()]; }
