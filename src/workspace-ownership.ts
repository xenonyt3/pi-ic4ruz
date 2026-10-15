import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { canonicalPath, isWithin, root } from './paths.mjs';

export type WriterLease = {
  workspace: string;
  owner: string;
  leaseRoot: string;
  lockDir: string;
  nonce: string;
  pid: number;
};

function leaseLocation(workspace: string, leaseRoot = path.join(root, 'agent', 'writer-leases')) {
  const canonicalWorkspace = canonicalPath(workspace);
  if (!fs.statSync(canonicalWorkspace).isDirectory()) throw new Error('WRITER_WORKSPACE_NOT_DIRECTORY');
  const canonicalRoot = canonicalPath(root);
  const canonicalLeaseRoot = canonicalPath(leaseRoot);
  if (!isWithin(canonicalRoot, canonicalLeaseRoot)) throw new Error('WRITER_LEASE_ROOT_ESCAPE');
  const key = createHash('sha256').update(process.platform === 'win32' ? canonicalWorkspace.toLowerCase() : canonicalWorkspace).digest('hex');
  const lockDir = path.join(canonicalLeaseRoot, key + '.lock');
  return { workspace: canonicalWorkspace, leaseRoot: canonicalLeaseRoot, lockDir };
}

function metadataPath(lease: WriterLease) { return path.join(lease.lockDir, 'owner.json'); }

export async function acquireWriterLease({ workspace, owner, leaseRoot }: {workspace: string; owner: string; leaseRoot?: string}): Promise<WriterLease> {
  if (!owner || typeof owner !== 'string') throw new Error('WRITER_OWNER_REQUIRED');
  const location = leaseLocation(workspace, leaseRoot);
  fs.mkdirSync(location.leaseRoot, { recursive: true });
  const lease: WriterLease = { ...location, owner, nonce: randomUUID(), pid: process.pid };
  try { fs.mkdirSync(lease.lockDir); }
  catch (error: any) {
    if (error?.code === 'EEXIST') throw new Error(`WRITER_BUSY: ${location.workspace}`);
    throw error;
  }
  try {
    fs.writeFileSync(metadataPath(lease), JSON.stringify({ workspace: lease.workspace, owner, nonce: lease.nonce, pid: lease.pid, state: 'held' }), { flag: 'wx' });
    return lease;
  } catch (error) {
    // A partial lock stays in place: another process must never silently acquire it.
    throw new Error('WRITER_LEASE_INCOMPLETE', { cause: error });
  }
}

export function assertWriter(lease: WriterLease): void {
  if (!lease || lease.pid !== process.pid) throw new Error('WRITER_LEASE_NOT_OWNED');
  const location = leaseLocation(lease.workspace, lease.leaseRoot);
  if (location.lockDir !== lease.lockDir) throw new Error('WRITER_LEASE_PATH_CHANGED');
  let recorded: any;
  try { recorded = JSON.parse(fs.readFileSync(metadataPath(lease), 'utf8')); }
  catch { throw new Error('WRITER_LEASE_MISSING'); }
  if (recorded.nonce !== lease.nonce || recorded.owner !== lease.owner || recorded.pid !== lease.pid || recorded.workspace !== lease.workspace) {
    throw new Error('WRITER_LEASE_NOT_OWNED');
  }
}

export function getWriterLeaseState(lease: WriterLease): 'held' | 'cleanup_unconfirmed' {
  assertWriter(lease);
  const recorded = JSON.parse(fs.readFileSync(metadataPath(lease), 'utf8'));
  return recorded.state;
}

export function markWriterCleanupUnconfirmed(lease: WriterLease, pid: number | undefined): void {
  assertWriter(lease);
  fs.writeFileSync(metadataPath(lease), JSON.stringify({ workspace: lease.workspace, owner: lease.owner, nonce: lease.nonce, pid: lease.pid, state: 'cleanup_unconfirmed', childPid: pid ?? null }));
}

export async function releaseWriterLease(lease: WriterLease, { cleanupConfirmed, recoveryConfirmed = false }: {cleanupConfirmed: true; recoveryConfirmed?: boolean}): Promise<void> {
  if (cleanupConfirmed !== true) throw new Error('WRITER_CLEANUP_UNCONFIRMED');
  assertWriter(lease);
  if (getWriterLeaseState(lease) === 'cleanup_unconfirmed' && recoveryConfirmed !== true) {
    throw new Error('WRITER_RECOVERY_REQUIRED');
  }
  const location = leaseLocation(lease.workspace, lease.leaseRoot);
  if (!isWithin(location.leaseRoot, location.lockDir)) throw new Error('WRITER_LEASE_ROOT_ESCAPE');
  fs.rmSync(metadataPath(lease));
  fs.rmdirSync(lease.lockDir);
}
