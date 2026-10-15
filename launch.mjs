import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { canonicalPath, isWithin, protectedRoots, resolvePrototypePaths } from './src/paths.mjs';

export { resolvePrototypePaths };

export function buildChildEnv(parent = process.env, paths = resolvePrototypePaths()) {
  const env = { ...parent };
  for (const name of Object.keys(env)) {
    if (/^PI_|^NODE_OPTIONS$|^NODE_PATH$|TOKEN|SECRET|PASSWORD|API_KEY|CREDENTIAL|PROXY|^PROTOTYPE_/i.test(name)) delete env[name];
  }
  env.PI_CODING_AGENT_DIR = paths.agent;
  env.PI_CODING_AGENT_SESSION_DIR = paths.sessions;
  env.PI_OFFLINE = '1';
  if(paths.selection==='transcript-hook-v1')env.PI_PROTOTYPE_LAUNCHER=path.join(paths.root,'launch.mjs');
  return env;
}

export function validateLaunchArgs(args, paths = resolvePrototypePaths()) {
  const out = [];
  const simple = new Set(['--version', '-v', '--help', '-h', '--offline', '--no-session', '--continue', '-c', '--resume', '-r']);
  const choices = { '--mode': ['rpc', 'text', 'json'], '--tui-mode': ['regular', 'fullscreen'] };
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    const eq = token.indexOf('=');
    const key = eq < 0 ? token : token.slice(0, eq);
    if (simple.has(key) && eq < 0) { out.push(key); continue; }
    if (!(key in choices) && key !== '--session') {
      throw new Error(`LAUNCH_ARGUMENT_REJECTED: ${key.startsWith('-') ? key : 'positional input'}; resource overrides and inference input are disabled`);
    }
    const value = eq < 0 ? args[++i] : token.slice(eq + 1);
    if (!value || value.startsWith('-')) throw new Error(`Missing value for ${key}`);
    if (key in choices && !choices[key].includes(value)) throw new Error(`Invalid value for ${key}`);
    if (key === '--session') {
      const session = canonicalPath(value);
      if (!isWithin(canonicalPath(paths.sessions), session) || !session.endsWith('.jsonl') || !fs.statSync(session).isFile()) {
        throw new Error('FOREIGN_SESSION: only existing prototype session JSONL files are accepted');
      }
      out.push(key, session);
    } else out.push(key, value);
  }
  return out;
}

export function assertIsolation(paths = resolvePrototypePaths(), cwd = process.cwd()) {
  const base = canonicalPath(paths.root);
  const working = canonicalPath(cwd);
  for (const protectedRoot of protectedRoots) {
    const protectedPath = canonicalPath(protectedRoot);
    if (isWithin(protectedPath, base) || isWithin(base, protectedPath) || isWithin(protectedPath, working)) {
      throw new Error('ISOLATION_COLLISION: prototype and working directory must not overlap protected roots');
    }
  }
  for (const key of ['runtime', 'pkg', 'cli', 'sdk', 'agent', 'sessions', 'extension', 'networkGuard']) {
    if (!isWithin(base, canonicalPath(paths[key]))) throw new Error(`ISOLATION_ESCAPE: ${key}`);
  }
  const conflicts = ['settings.json', 'SYSTEM.md', 'APPEND_SYSTEM.md'].filter(name => fs.existsSync(path.join(cwd, '.pi', name)));
  if (conflicts.length) throw new Error(`PROJECT_CONFIG_REJECTED: ${conflicts.join(', ')}`);
  const pkg = JSON.parse(fs.readFileSync(path.join(paths.pkg, 'package.json'), 'utf8'));
  if (pkg.name !== '@earendil-works/pi-coding-agent' || pkg.version !== (paths.runtimeLabel??'1.0.0')) throw new Error('RUNTIME_IDENTITY_MISMATCH');
  const identity = JSON.parse(fs.readFileSync(path.join(paths.root, 'config/runtime-identity.json'), 'utf8'));
  let candidateFiles={};
  if(paths.selection==='transcript-hook-v1'){
    const candidate=JSON.parse(fs.readFileSync(path.join(paths.root,'config/runtime-candidate.json'),'utf8'));
    if(candidate.id!==paths.selection||candidate.version!==paths.runtimeLabel||candidate.upstream!=='1.0.0')throw new Error('CANDIDATE_IDENTITY_MISMATCH');
    candidateFiles=candidate.files??{};
    for(const file of [paths.cli,paths.sdk,paths.runtimeExports,path.join(paths.pkg,'package.json'),path.join(paths.pkg,'dist/modes/interactive/components/user-message.js'),path.join(paths.pkg,'dist/modes/interactive/components/assistant-message.js'),path.join(paths.pkg,'dist/modes/interactive/interactive-mode.js')]){
      if(!candidateFiles[path.relative(paths.root,file).replaceAll('\\','/')])throw new Error('CANDIDATE_IDENTITY_INCOMPLETE');
    }
  }
  // Every launch verifies its execution tree; the offline suite also audits the inactive stock tree.
  const activeFiles=paths.selection==='transcript-hook-v1'
    ? {...Object.fromEntries(Object.entries(identity.files).filter(([file])=>!file.replaceAll('\\','/').startsWith('runtime/node_modules/'))),...candidateFiles}
    : identity.files;
  const canonicalDirectories = new Map();
  for (const [relative, expected] of Object.entries(activeFiles)) {
    const file = path.resolve(paths.root, relative);
    const directory = path.dirname(file);
    if (!canonicalDirectories.has(directory)) canonicalDirectories.set(directory, canonicalPath(directory));
    if (!isWithin(base, canonicalDirectories.get(directory)) || fs.lstatSync(file).isSymbolicLink()) throw new Error('RUNTIME_IDENTITY_ESCAPE');
    const actual = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if (actual !== expected) throw new Error(`RUNTIME_HASH_MISMATCH: ${relative}`);
  }
  const models = JSON.parse(fs.readFileSync(path.join(paths.agent, 'models.json'), 'utf8'));
  const provider = models.providers?.['9router'];
  if (!provider?.models?.some(model => model.id === 'cx/gpt-6-sol')) throw new Error('EXPLICIT_MODEL_MISSING');
  if (provider.baseUrl !== 'http://127.0.0.1:9/v1' || provider.apiKey !== 'offline-fixture-not-a-credential') {
    throw new Error('LIVE_PROFILE_REJECTED: offline profile must not contain production transport credentials');
  }
  const config = JSON.parse(fs.readFileSync(path.join(paths.root, 'config/harness.json'), 'utf8'));
  if (config.liveInference !== false) throw new Error('LIVE_BUDGET_NOT_CONFIGURED');
}

export function createInvocation(args, { cwd = process.cwd(), env = process.env, paths = resolvePrototypePaths() } = {}) {
  assertIsolation(paths, cwd);
  const validated = validateLaunchArgs(args, paths);
  return { command: process.execPath, args: ['--import', pathToFileURL(paths.networkGuard).href, paths.cli,
    '--offline', '--no-extensions', '--no-skills', '--no-prompt-templates', '--no-themes', '--no-context-files',
    '--no-approve', '--system-prompt', '', '--append-system-prompt', path.join(paths.agent, 'shared-brain.md'),
    '-e', paths.extension, ...validated], env: buildChildEnv(env, paths), cwd };
}

export function main() {
  const invocation = createInvocation(process.argv.slice(2));
  const child = spawn(invocation.command, invocation.args, { cwd: invocation.cwd, env: invocation.env, stdio: 'inherit', windowsHide: true });
  child.once('error', error => { console.error(error.message); process.exitCode = 1; });
  child.once('exit', code => { process.exitCode = code ?? 1; });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
