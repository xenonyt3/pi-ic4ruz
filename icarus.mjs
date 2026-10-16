import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.join(root, 'workspace');
const args = process.argv.slice(2);
const requested = args[0];
const mode = requested && !requested.startsWith('-') ? requested.toLowerCase() : 'offline';
const rest = requested && !requested.startsWith('-') ? args.slice(1) : args;

const commands = {
  offline: { script: 'launch.mjs', cwd: workspace },
  live: { script: path.join('agent', 'live-private', 'start-daily.mjs'), cwd: root },
  check: { script: path.join('agent', 'live-private', 'start-daily.mjs'), cwd: root, extra: ['--check'] },
  resume: { script: path.join('agent', 'live-private', 'start-daily.mjs'), cwd: root, extra: ['--continue'] },
};

if (mode === 'help' || requested === '--help' || requested === '-h') {
  console.log('Usage: icarus [offline|live|check|resume] [Pi arguments]');
  console.log('  offline  start the default offline launcher (default)');
  console.log('  live     start 9router / cx/gpt-6-astra daily live mode');
  console.log('  check    validate live configuration without a model request');
  console.log('  resume   continue the most recent live session');
  process.exit(0);
}

const command = commands[mode];
if (!command) {
  console.error(`ICARUS_COMMAND_UNKNOWN: ${mode}`);
  process.exit(2);
}

const child = spawn(process.execPath, [path.join(root, command.script), ...(command.extra ?? []), ...rest], {
  cwd: command.cwd,
  env: process.env,
  stdio: 'inherit',
  windowsHide: false,
});
child.once('error', error => {
  console.error(`ICARUS_START_FAILED: ${error.message}`);
  process.exitCode = 1;
});
child.once('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
