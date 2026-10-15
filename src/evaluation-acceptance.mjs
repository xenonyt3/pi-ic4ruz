import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { root, isWithin } from './paths.mjs';

export function assertOfflineAcceptance(report, base = root) {
  if (report?.passed !== true || report.suite !== 'all' || report.sourceUnchanged !== true) throw new Error('OFFLINE_ACCEPTANCE_REQUIRED');
  for (const name of ['live-budget-transport', 'live-evaluation', 'brokered-child', 'pilot-verifier']) {
    if (!report.coverage?.includes(name)) throw new Error('LIVE_PREFLIGHT_COVERAGE_MISSING');
  }
  const hashes = report.sourceHashes ?? {};
  const required = ['src/live-evaluation.mjs', 'src/live-budget-transport.mjs', 'src/pilot-verifier.mjs', 'src/evaluation-acceptance.mjs', 'src/child-supervisor.ts', 'src/child-runner.mjs', 'tests/live-evaluation.test.mjs', 'tests/pilot-verifier.test.mjs'];
  const keys = new Set(Object.keys(hashes).map(key => key.replaceAll('\\', '/')));
  if (required.some(file => !keys.has(file))) throw new Error('LIVE_PREFLIGHT_HASH_MISSING');
  for (const [relative, expected] of Object.entries(hashes)) {
    const file = path.resolve(base, relative);
    if (!isWithin(path.resolve(base), file) || !fs.existsSync(file) || createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== expected) {
      throw new Error(`OFFLINE_ACCEPTANCE_STALE: ${relative}`);
    }
  }
}

export function isCleanupConfirmed({ shutdownResults, children, activeCount, pendingWriterCalls, writerLeasePresent, error }) {
  return !error && Array.isArray(shutdownResults) && shutdownResults.every(result => result.cleanup_confirmed === true) &&
    children.every(child => child.cleanupConfirmed === true && ['completed', 'cancelled', 'failed', 'interrupted'].includes(child.status)) &&
    activeCount === 0 && pendingWriterCalls.length === 0 && !writerLeasePresent;
}
