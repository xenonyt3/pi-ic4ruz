import fs from 'node:fs';
import path from 'node:path';

export const SHARED_BRAIN_VAULT = 'D:/.vault-brain/vault';
const BRAIN_SERVER = 'open-second-brain';

function normalized(p: string): string {
  return path.win32.normalize(path.win32.resolve(p)).replace(/[\\/]+$/, '').toLowerCase();
}

export function verifyVaultBinding(vaultPath: string = SHARED_BRAIN_VAULT, options: { requireExists?: boolean } = {}) {
  if (normalized(vaultPath) !== normalized(SHARED_BRAIN_VAULT)) throw new Error('BRAIN_VAULT_MISMATCH');
  if (options.requireExists !== false) {
    const actual = fs.realpathSync.native(vaultPath);
    const expected = fs.realpathSync.native(SHARED_BRAIN_VAULT);
    if (normalized(actual) !== normalized(expected)) throw new Error('BRAIN_VAULT_MISMATCH');
  }
  return SHARED_BRAIN_VAULT;
}

/** Curated upstream MCP config; never reads project or global mcp.json. */
export function loadCuratedBrainConfig(options: { vaultPath?: string; role?: 'parent' | 'child'; requireExists?: boolean } = {}) {
  if (options.role === 'child') return { servers: [], autoEnableCodemode: false, errors: [] };
  const vault = verifyVaultBinding(options.vaultPath, { requireExists: options.requireExists });
  return {
    servers: [{
      name: BRAIN_SERVER,
      config: {
        command: 'C:/Users/M S I/.bun/bin/bun.exe',
        args: ['run', 'D:/504/open-second-brain/src/cli/main.ts', 'mcp', '--vault', vault],
        exposure: 'hidden',
        toolExposure: {
          brain_context: 'deferred', brain_search: 'deferred',
          brain_feedback: 'deferred', brain_note: 'deferred', brain_apply_evidence: 'deferred',
        },
      },
      source: 'pi-reason-prototype curated Brain binding',
      scope: 'extension' as const,
    }],
    autoEnableCodemode: false,
    errors: [],
  };
}

export type BrainCaller = (name: string, args: Record<string, unknown>) => Promise<unknown>;

function unwrapResult(value: any) {
  if (value?.isError === true) throw new Error('BRAIN_TOOL_ERROR');
  const result = value?.structuredContent ?? value;
  if (!result || typeof result !== 'object') throw new Error('BRAIN_INVALID_RESULT');
  return result;
}

/** Caller is injected so fixtures cannot contact the real Brain. */
export async function recallSessionContext(options: { callTool: BrainCaller; role?: 'parent' | 'child'; query?: string; beforeDecision?: boolean }) {
  if (options.role === 'child') return { status: 'skipped_child' as const, context: null, search: null };
  try {
    const context = unwrapResult(await options.callTool('brain_context', {}));
    if (typeof (context as any).active_path !== 'string' ||
        normalized((context as any).active_path) !== normalized(`${SHARED_BRAIN_VAULT}/Brain/active.md`)) {
      throw new Error('BRAIN_VAULT_MISMATCH');
    }
    const search = unwrapResult(await options.callTool('brain_search', {
      query: options.query ?? 'current workspace and task context',
      keyword_only: true,
      semantic: false,
      rerank: false,
      limit: 5,
    }));
    return { status: 'available' as const, context, search };
  } catch (error) {
    return {
      status: 'unavailable' as const,
      context: null,
      search: null,
      reason: error instanceof Error ? error.message : String(error),
      decisionBlocked: options.beforeDecision === true,
    };
  }
}
