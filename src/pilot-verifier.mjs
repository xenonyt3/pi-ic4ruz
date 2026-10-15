import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ASSERTION_COUNT = 12;
const digest = text => createHash('sha256').update(text).digest('hex');

async function verify(source) {
  const receipt = { protocol: 1, sourceHash: digest(source), total: ASSERTION_COUNT, passed: 0, completed: false, failures: [] };
  try {
    // This pure-function fixture gets no process, filesystem, imports, or host objects.
    // It is a verifier boundary, not a claim that Node vm is a general OS sandbox.
    const context = vm.createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } });
    const TypeErrorClass = vm.runInContext('TypeError', context);
    const module = new vm.SourceTextModule(source, { context });
    await module.link(() => { throw new Error('IMPORTS_NOT_ALLOWED'); });
    await module.evaluate({ timeout: 1000 });
    if (typeof module.namespace.normalizeLabel !== 'function') throw new Error('EXPORT_MISSING');
    Object.defineProperty(context, '__candidate', { value: module.namespace.normalizeLabel });
    const cases = [
      [JSON.stringify(' A  B '), 'a b'], [JSON.stringify('\tHello\nWORLD\t'), 'hello world'],
      [JSON.stringify(''), ''], [JSON.stringify('  '), ''], [JSON.stringify(' A-B  C! '), 'a-b c!'],
      [JSON.stringify(' CAF\u00c9\u00a0DATA '), 'caf\u00e9 data'],
      ...['null', 'undefined', '12', '({})', '[]', 'new String("A")'].map(input => [input, null]),
    ];
    for (const [index, [input, expected]] of cases.entries()) {
      let actual, error;
      try { actual = vm.runInContext(`__candidate(${input})`, context, { timeout: 1000 }); } catch (caught) { error = caught; }
      const passed = expected === null ? error instanceof TypeErrorClass : !error && actual === expected;
      if (passed) receipt.passed++;
      else receipt.failures.push(index + 1);
    }
    receipt.completed = true;
  } catch (error) { receipt.error = String(error?.message ?? error).slice(0, 300); }
  return receipt;
}

export function runCandidateVerifier(candidatePath, { agentDir, timeout = 15000 } = {}) {
  const sourceHash = digest(fs.readFileSync(candidatePath));
  const guard=pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)),'offline-guard.mjs')).href;
  const execution = spawnSync(process.execPath, ['--import', guard, '--experimental-vm-modules', fileURLToPath(import.meta.url), candidatePath], {
    cwd: path.dirname(candidatePath), windowsHide: true, encoding: 'utf8', timeout, maxBuffer: 65536,
    env: { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, TEMP: process.env.TEMP, TMP: process.env.TMP, PI_CODING_AGENT_DIR: agentDir,
      ...(process.env.PROTOTYPE_GUARD_DIR?{PROTOTYPE_GUARD_DIR:process.env.PROTOTYPE_GUARD_DIR}:{}) },
  });
  let receipt;
  try { receipt = JSON.parse(execution.stdout.trim()); } catch {}
  const passed = execution.status === 0 && receipt?.protocol === 1 && receipt.sourceHash === sourceHash &&
    receipt.completed === true && receipt.total === ASSERTION_COUNT && receipt.passed === ASSERTION_COUNT && receipt.failures?.length === 0;
  return { passed, status: execution.status, signal: execution.signal, receipt: receipt ?? null,
    output: receipt ? JSON.stringify(receipt) : 'VERIFIER_INCOMPLETE', error: execution.error?.code ?? null };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const receipt = await verify(fs.readFileSync(process.argv[2], 'utf8'));
  process.stdout.write(JSON.stringify(receipt));
  process.exitCode = receipt.completed && receipt.passed === ASSERTION_COUNT ? 0 : 1;
}
