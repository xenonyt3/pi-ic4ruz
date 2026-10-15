import fs from 'node:fs';
import path from 'node:path';
import { sdk } from './upstream.mjs';
import { canonicalPath, isWithin, root } from './paths.mjs';
import { acquireWriterLease, assertWriter, markWriterCleanupUnconfirmed, releaseWriterLease, type WriterLease } from './workspace-ownership.ts';
import * as defaultLifecycle from './process-lifecycle.mjs';

const GIT_BASH = 'C:/Program Files/Git/bin/bash.exe';
const POWERSHELL = path.join(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
const UTF8_OUTPUT = 'try { [Console]::OutputEncoding=[System.Text.Encoding]::UTF8 } catch {}\n';

function error(code: string, message: string, pid?: number) {
  return Object.assign(new Error(`${code}: ${message}`), { code, pid });
}

function shellExecutable(shell: 'bash' | 'powershell') {
  const executable = shell === 'bash' ? GIT_BASH : POWERSHELL;
  if (!fs.existsSync(executable) || !fs.statSync(executable).isFile()) throw error('SHELL_UNAVAILABLE', executable);
  return executable;
}

export function createOwnedShellOperations({ workspace, owner, leaseRoot = path.join(root, 'agent', 'writer-leases'), shell = 'bash', existingLease, getExistingLease, lifecycle = defaultLifecycle }: {
  workspace: string; owner: string; leaseRoot?: string; shell?: 'bash' | 'powershell'; existingLease?: WriterLease;
  getExistingLease?: () => WriterLease | undefined;
  lifecycle?: typeof defaultLifecycle;
}) {
  if (shell !== 'bash' && shell !== 'powershell') throw error('SHELL_UNAVAILABLE', String(shell));
  const canonicalWorkspace = canonicalPath(workspace);
  const executable = shellExecutable(shell);
  return {
    async exec(command: string, cwd: string, { onData, signal, timeout, env }: {
      onData: (data: Buffer) => void; signal?: AbortSignal; timeout?: number; env?: NodeJS.ProcessEnv;
    }) {
      const canonicalCwd = canonicalPath(cwd);
      if (!fs.existsSync(canonicalCwd) || !fs.statSync(canonicalCwd).isDirectory()) throw error('WORKING_DIRECTORY_MISSING', cwd);
      if (!isWithin(canonicalWorkspace, canonicalCwd)) throw error('WORKSPACE_CWD_ESCAPE', cwd);
      if (timeout !== undefined && (!Number.isFinite(timeout) || timeout <= 0 || timeout * 1000 > 2_147_483_647)) {
        throw error('INVALID_TIMEOUT', String(timeout));
      }
      if (signal?.aborted) throw error('ABORTED', 'before shell start');
      const borrowedLease = existingLease ?? getExistingLease?.();
      const lease = borrowedLease ?? await acquireWriterLease({ workspace: canonicalWorkspace, owner, leaseRoot });
      let release = !borrowedLease;
      let child: ReturnType<typeof lifecycle.spawnOwnedProcess> | undefined;
      try {
        assertWriter(lease);
        if (lease.workspace !== canonicalWorkspace || lease.owner !== owner) throw error('WRITER_LEASE_SCOPE_MISMATCH', canonicalWorkspace);
        const args = shell === 'bash'
          ? ['-c', command]
          : ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', UTF8_OUTPUT + command];
        child = lifecycle.spawnOwnedProcess(executable, args, {
          cwd: canonicalCwd, env: env ?? process.env, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32', windowsHide: true,
        });
        const startedChild = child;
        startedChild.stdout?.on('data', onData);
        startedChild.stderr?.on('data', onData);
        const exited = new Promise<{code: number | null; signal: string | null}>((resolve, reject) => {
          startedChild.once('exit', (code, childSignal) => resolve({ code, signal: childSignal }));
          startedChild.once('error', reject);
        });
        const closed = new Promise<void>(resolve => startedChild.once('close', () => resolve()));
        let reason: 'timeout' | 'aborted' | undefined;
        let termination: ReturnType<typeof lifecycle.terminateTreeAndConfirm> | undefined;
        let notifyStop!: () => void;
        const stopped = new Promise<void>(resolve => { notifyStop = resolve; });
        const stop = (why: 'timeout' | 'aborted') => {
          if (reason) return;
          reason = why;
          termination = Promise.resolve().then(() => lifecycle.terminateTreeAndConfirm(startedChild));
          notifyStop();
        };
        const abort = () => stop('aborted');
        const timer = timeout === undefined ? undefined : setTimeout(() => stop('timeout'), timeout * 1000);
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) stop('aborted');
        let result: {code: number | null; signal: string | null};
        try {
          const first = await Promise.race([
            exited.then(value => ({ kind: 'exit' as const, value })),
            stopped.then(() => ({ kind: 'stop' as const })),
          ]);
          if (termination) {
            let cleanup: Awaited<typeof termination>;
            try { cleanup = await termination; }
            catch (cause) {
              markWriterCleanupUnconfirmed(lease, startedChild.pid);
              release = false;
              throw error('CLEANUP_UNCONFIRMED', String(cause), startedChild.pid);
            }
            if (cleanup.status !== 'confirmed') {
              markWriterCleanupUnconfirmed(lease, startedChild.pid);
              release = false;
              throw error('CLEANUP_UNCONFIRMED', JSON.stringify(cleanup), startedChild.pid);
            }
          }
          result = first.kind === 'exit' ? first.value : await Promise.race([
            exited,
            new Promise<never>((_, reject) => setTimeout(() => reject(error('CLEANUP_UNCONFIRMED', 'process exit not observed after confirmed kill', startedChild.pid)), 1000)),
          ]).catch(cause => {
            markWriterCleanupUnconfirmed(lease, startedChild.pid);
            release = false;
            throw cause;
          });
          const stdioClosed = await Promise.race([closed.then(() => true), new Promise<boolean>(resolve => setTimeout(() => resolve(false), 1000))]);
          if (!stdioClosed) {
            markWriterCleanupUnconfirmed(lease, startedChild.pid);
            release = false;
            throw error('CLEANUP_UNCONFIRMED', 'descendant may still hold output handles', startedChild.pid);
          }
          if (reason === 'timeout') throw error('TIMEOUT', `${timeout} seconds`, startedChild.pid);
          if (reason === 'aborted' || signal?.aborted) throw error('ABORTED', 'shell command cancelled', startedChild.pid);
          return { exitCode: result.code ?? 1 };
        } finally {
          if (timer) clearTimeout(timer);
          signal?.removeEventListener('abort', abort);
        }
      } finally {
        if (release) await releaseWriterLease(lease, { cleanupConfirmed: true });
      }
    },
  };
}

export function registerWindowsTools(pi: { registerTool: (tool: any) => void }, { cwd, workspace = cwd, owner = 'parent', leaseRoot, existingLease, getExistingLease, enablePowerShell = true, lifecycle }: {
  cwd: string; workspace?: string; owner?: string; leaseRoot?: string; existingLease?: WriterLease; getExistingLease?: () => WriterLease | undefined; enablePowerShell?: boolean; lifecycle?: typeof defaultLifecycle;
}) {
  const bash = sdk.createBashToolDefinition(cwd, {
    shellPath: shellExecutable('bash'),
    operations: createOwnedShellOperations({ workspace, owner, leaseRoot, existingLease, getExistingLease, shell: 'bash', lifecycle }),
  });
  pi.registerTool({ ...bash, exposure: 'direct' });
  const registered = ['bash'];
  if (enablePowerShell && fs.existsSync(POWERSHELL)) {
    const powershell = sdk.createPowerShellToolDefinition(cwd, {
      operations: createOwnedShellOperations({ workspace, owner, leaseRoot, existingLease, getExistingLease, shell: 'powershell', lifecycle }),
    });
    pi.registerTool({ ...powershell, exposure: 'deferred', defaultActive: false,
      description: `${powershell.description} Uses Windows PowerShell; it is a separate tool from Git Bash.` });
    registered.push('powershell');
  }
  return registered;
}
