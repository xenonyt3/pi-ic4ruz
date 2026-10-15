import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInvocation } from '../../launch.mjs';
import { root } from '../../src/paths.mjs';
import path from 'node:path';

export async function run(args, { timeout = 30000, cwd = path.join(root, 'workspace'), env = process.env } = {}) {
  const child = spawn(process.execPath, args, { cwd, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', data => { stdout += data; });
  child.stderr.on('data', data => { stderr += data; });
  child.stdin.end();
  const timer = setTimeout(() => child.kill(), timeout);
  try {
    const [code, signal] = await once(child, 'close');
    return { code, signal, stdout, stderr };
  } finally { clearTimeout(timer); }
}

export async function rpc(commands, { receipt, cwd = path.join(root, 'workspace'), args = [] } = {}) {
  const invocation = createInvocation(['--mode', 'rpc', ...args], { cwd });
  if (receipt) invocation.env.PROTOTYPE_OFFLINE_RECEIPT = receipt;
  const child = spawn(invocation.command, invocation.args, { cwd, env: invocation.env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const closed = once(child, 'close');
  const records = [];
  let pending = '', stderr = '';
  child.stderr.on('data', data => { stderr += data; });
  const timer = setTimeout(() => child.kill(), 30000);
  child.stdout.on('data', data => {
    pending += data;
    let newline;
    while ((newline = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, newline).replace(/\r$/, '');
      pending = pending.slice(newline + 1);
      if (line) {
        try { records.push(JSON.parse(line)); } catch { records.push({ invalid: line }); }
      }
    }
    if (commands.every(command => records.some(record => record.type === 'response' && record.id === command.id))) child.stdin.end();
  });
  for (const command of commands) child.stdin.write(JSON.stringify(command) + '\n');
  try {
    const [code, signal] = await closed;
    if (code !== 0) throw new Error(`RPC exit ${code}/${signal}: ${stderr}`);
    return { records, stderr };
  } finally { clearTimeout(timer); if (child.exitCode === null) child.kill(); }
}
