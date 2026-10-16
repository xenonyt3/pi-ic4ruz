import path from 'node:path';
import { codemode, sdk } from './upstream.mjs';
import { canonicalPath, isWithin, protectedRoots } from './paths.mjs';

export const CORE_TOOLS = ['read', 'bash', 'edit', 'write', 'codemode'];
const fileTools = new Set(['read', 'edit', 'write', 'grep', 'find', 'ls']);
const writers = new Set(['edit', 'write', 'bash', 'powershell', 'browser']);

export function assertNoIdentifierCollisions(tools) {
  const seen = new Map();
  for (const tool of tools) {
    const name = typeof tool === 'string' ? tool : tool.name;
    const identifier = codemode.toCodemodeIdentifier(name);
    if (seen.has(identifier)) throw new Error(`IDENTIFIER_COLLISION: ${name} / ${seen.get(identifier)}`);
    seen.set(identifier, name);
  }
}

export function buildCapabilityManifest(tools, allowedTools) {
  const allowed = new Set(allowedTools ?? tools.map(tool => tool.name));
  const available = tools.filter(tool => allowed.has(tool.name) && tool.exposure !== 'hidden');
  assertNoIdentifierCollisions(available);
  return available.map(tool => ({ name: tool.name, exposure: tool.exposure ?? 'direct', namespace: tool.namespace ?? null }));
}

export function canonicalizeAllowedPath(input, workspace, allowedRoots = [workspace]) {
  const target = canonicalPath(path.resolve(workspace, input ?? '.'));
  if (!allowedRoots.some(root => isWithin(canonicalPath(root), target))) throw new Error('PATH_OUTSIDE_WORKSPACE');
  if (protectedRoots.some(root => isWithin(canonicalPath(root), target))) throw new Error('PROTECTED_BASELINE_PATH');
  return target;
}

export function authorizeToolCall(event, { workspace, allowedTools, allowedRoots, readOnly = false }) {
  if (!allowedTools.includes(event.toolName)) throw new Error(`CAPABILITY_DENIED: ${event.toolName}`);
  if (readOnly && writers.has(event.toolName)) throw new Error(`READ_ONLY_CAPABILITY: ${event.toolName}`);
  if (fileTools.has(event.toolName)) canonicalizeAllowedPath(event.input?.path, workspace, allowedRoots);
}

export function registerDeferredFileTools(pi, cwd) {
  const tools = [sdk.createGrepToolDefinition(cwd), sdk.createFindToolDefinition(cwd), sdk.createLsToolDefinition(cwd)];
  assertNoIdentifierCollisions([...CORE_TOOLS, ...tools]);
  for (const tool of tools) pi.registerTool({ ...tool, defaultActive: false, exposure: 'deferred', namespace: { name: 'workspace', description: 'Read-only workspace file exploration' } });
}

export function registerToolPolicy(pi, options) {
  const calls = new Set();
  let held = options.existingLease;
  let acquisition;
  let manifestError;
  const release = async id => {
    if (!calls.delete(id) || calls.size || options.existingLease || !held) return;
    const { releaseWriterLease, getWriterLeaseState } = await import('./workspace-ownership.ts');
    if (getWriterLeaseState(held) === 'cleanup_unconfirmed') return;
    await releaseWriterLease(held, { cleanupConfirmed: true });
    held = undefined;
  };
  pi.on('session_start', () => {
    try { buildCapabilityManifest(pi.getAllTools(), options.allowedTools); }
    catch (error) { manifestError = error; }
  });
  pi.on('tool_call', async event => {
    if (manifestError) throw manifestError;
    authorizeToolCall(event, options);
    if (!writers.has(event.toolName) || !options.leaseRoot) return;
    const { acquireWriterLease, assertWriter, getWriterLeaseState } = await import('./workspace-ownership.ts');
    if (!held) {
      acquisition ??= Promise.resolve(acquireWriterLease({ workspace: options.workspace, owner: options.owner, leaseRoot: options.leaseRoot }));
      try { held = await acquisition; } finally { acquisition = undefined; }
    }
    assertWriter(held);
    if (getWriterLeaseState(held) === 'cleanup_unconfirmed') throw new Error('WRITER_RECOVERY_REQUIRED');
    calls.add(event.toolCallId);
  });
  pi.on('tool_execution_end', async event => {
    if (event.result?.details?.cleanupConfirmed === false || event.result?.details?.cleanupStatus === 'cleanup_unconfirmed') return;
    await release(event.toolCallId);
  });
  return { getExistingLease: () => held, pendingWriterCalls: () => [...calls] };
}
