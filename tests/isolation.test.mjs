import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildChildEnv, validateLaunchArgs, assertIsolation, resolvePrototypePaths } from '../launch.mjs';
import { canonicalPath, isWithin, root } from '../src/paths.mjs';
import { auditBaseline } from '../scripts/audit-baseline.mjs';
import { run, rpc } from './helpers/process.mjs';

const paths = resolvePrototypePaths();
const tmpRoot = path.join(root, 'tests/.tmp');
fs.mkdirSync(tmpRoot, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpRoot, 'isolation-'));
test.after(() => {
  assert.ok(isWithin(canonicalPath(tmpRoot), canonicalPath(tmp)));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('O01 env strips inherited profile, preload, provider credentials and proxy', () => {
  const env = buildChildEnv({ PI_CODING_AGENT_DIR: 'foreign', pi_example: 'bad', NODE_OPTIONS: '--import evil.mjs', NODE_PATH: 'foreign', OPENAI_API_KEY: 'secret', https_proxy: 'foreign', Path: 'kept' });
  assert.deepEqual(env, { Path: 'kept', PI_CODING_AGENT_DIR: paths.agent, PI_CODING_AGENT_SESSION_DIR: paths.sessions, PI_OFFLINE: '1',...(paths.selection==='transcript-hook-v1'?{PI_PROTOTYPE_LAUNCHER:path.join(paths.root,'launch.mjs')}:{}) });
});

test('O01 reject override families, short aliases, assignments, unknown flags and messages', () => {
  for (const args of [
    ['--extension=x'], ['-ex'], ['-e', 'x'], ['--session-dir=x'], ['--session-dir', 'x'],
    ['--system-prompt=x'], ['--append-system-prompt', 'x'], ['--skill=x'], ['--theme=x'],
    ['--tools=x'], ['-t', 'read'], ['--api-key=x'], ['--provider', 'other'], ['--model=x'],
    ['--session-id=x'], ['--fork=x'], ['--resume=x'], ['-r=x'], ['--export=x'], ['install', 'x'], ['update'],
    ['--', 'prompt'], ['@file'], ['hello'], ['--print=hello'], ['--wat=x'], ['--help=1']
  ]) assert.throws(() => validateLaunchArgs(args), /REJECTED/);
  assert.deepEqual(validateLaunchArgs(['--mode=rpc', '--no-session']), ['--mode', 'rpc', '--no-session']);
  assert.throws(() => validateLaunchArgs(['--mode']), /Missing/);
});

test('O01 only existing own sessions, including canonical junction enforcement', () => {
  const foreign = path.join(tmp, 'foreign.jsonl');
  fs.writeFileSync(foreign, '{}\n');
  assert.throws(() => validateLaunchArgs(['--session', foreign]), /FOREIGN_SESSION/);
  const own = path.join(paths.sessions, `fixture-${process.pid}.jsonl`);
  fs.writeFileSync(own, '{}\n');
  try { assert.deepEqual(validateLaunchArgs([`--session=${own}`]), ['--session', canonicalPath(own)]); }
  finally { fs.unlinkSync(own); }
  const link = path.join(paths.sessions, `junction-${process.pid}`);
  fs.symlinkSync(tmp, link, 'junction');
  try { assert.throws(() => validateLaunchArgs(['--session', path.join(link, 'foreign.jsonl')]), /FOREIGN_SESSION/); }
  finally { fs.rmdirSync(link); }
});

test('O01 project config and protected working roots rejected before CLI', () => {
  const project = path.join(tmp, '.pi');
  fs.mkdirSync(project);
  for (const name of ['settings.json', 'SYSTEM.md', 'APPEND_SYSTEM.md']) {
    const file = path.join(project, name);
    fs.writeFileSync(file, '{}');
    assert.throws(() => assertIsolation(paths, tmp), /PROJECT_CONFIG_REJECTED/);
    fs.unlinkSync(file);
  }
  assert.throws(() => assertIsolation(paths, 'D:/pi-clean'), /ISOLATION_COLLISION/);
  assert.throws(() => assertIsolation({ ...paths, agent: 'C:/Users/M S I/.pi/agent' }, tmp), /ISOLATION_ESCAPE/);
  assertIsolation(paths, tmp);
});

test('O01 upstream public SDK identity is runtime-local and pinned', async () => {
  const sdk = await import(pathToFileURL(paths.sdk).href);
  for (const key of ['createAgentSession', 'createCodemodeExtension', 'DefaultResourceLoader', 'SessionManager', 'ModelRuntime']) assert.equal(typeof sdk[key], 'function');
  assert.equal(fs.lstatSync(path.join(paths.runtime, 'node_modules')).isSymbolicLink(), false);
  assertIsolation(paths, tmp);
});

test('O01 changed runtime bytes fail closed in a disposable installation fixture', () => {
  const fixture = resolvePrototypePaths(path.join(tmp, 'runtime-integrity'));
  for (const directory of [path.join(fixture.pkg, 'dist/bundle'), fixture.agent, fixture.sessions, path.dirname(fixture.extension), path.dirname(fixture.networkGuard), path.join(fixture.root, 'config')]) fs.mkdirSync(directory, {recursive:true});
  fs.writeFileSync(path.join(fixture.pkg, 'package.json'), '{"name":"@earendil-works/pi-coding-agent","version":"1.0.0"}');
  fs.writeFileSync(fixture.cli, 'modified fixture runtime bytes');
  fs.writeFileSync(fixture.sdk, '');
  fs.writeFileSync(fixture.extension, '');
  fs.writeFileSync(fixture.networkGuard, '');
  fs.writeFileSync(path.join(fixture.root, 'config/runtime-identity.json'), JSON.stringify({files:{[path.relative(fixture.root, fixture.cli)]:'deliberately-wrong-hash'}}));
  assert.throws(() => assertIsolation(fixture, tmp), /RUNTIME_HASH_MISMATCH/);
});

test('O01 launcher version/help execute without inference', async () => {
  for (const flag of ['--version', '--help']) {
    // Relocated Windows trees can take >30s to hash; retain all identity checks.
    const result = await run([path.join(root, 'launch.mjs'), flag], {timeout:90000});
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, flag === '--version' ? /1\.0\.0/ : /Usage|coding assistant/i);
  }
});

test('O01 stock RPC, explicit extension, no project discovery and zero network attempts', async () => {
  const local = path.join(tmp, '.pi/extensions');
  fs.mkdirSync(local, { recursive: true });
  fs.writeFileSync(path.join(local, 'must-not-load.ts'), 'throw new Error("PROJECT_EXTENSION_LEAK");');
  fs.writeFileSync(path.join(tmp, 'AGENTS.md'), 'CONTEXT_LEAK_SENTINEL');
  const receipt = path.join(tmp, 'rpc-network.json');
  const commands = ['get_state', 'get_commands', 'get_available_models'].map(type => ({ id: type, type }));
  const result = await rpc(commands, { receipt, cwd: tmp });
  assert.equal(result.stderr, '');
  for (const command of commands) assert.equal(result.records.find(record => record.id === command.id)?.success, true, JSON.stringify(result.records));
  const state = result.records.find(record => record.id === 'get_state').data;
  assert.equal(state.model.provider, '9router');
  assert.equal(state.model.id, 'cx/gpt-6-sol');
  assert.equal(state.isStreaming, false);
  assert.equal(state.messageCount, 0);
  if (state.sessionFile) assert.ok(isWithin(paths.sessions, state.sessionFile));
  const counters = JSON.parse(fs.readFileSync(receipt, 'utf8'));
  assert.equal(counters.blockedNetworkAttempts, 0);
  fs.mkdirSync(path.join(root, 'artifacts/verification'), { recursive: true });
  fs.writeFileSync(path.join(root, 'artifacts/verification/rpc-smoke.json'), JSON.stringify({ state, network: counters, commands: commands.map(command => command.type), fixture: true }, null, 2));
});

test('O01 real SDK resource loader aliases public runtime import and excludes project context/resources', async () => {
  const sdk = await import(pathToFileURL(paths.sdk).href);
  const project = path.join(tmp, 'loader-project');
  const agent = path.join(tmp, 'loader-agent');
  fs.mkdirSync(path.join(project, '.pi/extensions'), { recursive: true });
  fs.mkdirSync(agent, { recursive: true });
  fs.writeFileSync(path.join(project, 'AGENTS.md'), 'CONTEXT_LEAK_SENTINEL');
  fs.writeFileSync(path.join(project, '.pi/extensions/leak.ts'), 'export default pi => pi.registerCommand("leak-sentinel", {handler:async()=>{}})');
  const fakePackage = path.join(project, 'node_modules/@earendil-works/pi-coding-agent');
  fs.mkdirSync(fakePackage, { recursive: true });
  fs.writeFileSync(path.join(fakePackage, 'package.json'), '{"name":"@earendil-works/pi-coding-agent","main":"index.js"}');
  fs.writeFileSync(path.join(fakePackage, 'index.js'), 'throw new Error("FOREIGN_PACKAGE_LEAK")');
  const explicit = path.join(project, 'explicit.ts');
  fs.writeFileSync(explicit, 'import {createCodemodeExtension} from "@earendil-works/pi-coding-agent"; export default pi => {globalThis[Symbol.for("prototype.runtime.identity")]=createCodemodeExtension; pi.registerCommand("explicit-sentinel", {handler:async()=>{}})}');
  const loader = new sdk.DefaultResourceLoader({ cwd: project, agentDir: agent,
    settingsManager: sdk.SettingsManager.inMemory({ packages: [] }), additionalExtensionPaths: [explicit],
    noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
    systemPrompt: '', appendSystemPrompt: [] });
  await loader.reload();
  assert.equal(globalThis[Symbol.for('prototype.runtime.identity')], sdk.createCodemodeExtension);
  delete globalThis[Symbol.for('prototype.runtime.identity')];
  assert.deepEqual(loader.getAgentsFiles().agentsFiles, []);
  // An explicit empty override suppresses file discovery, then normalizes to stock prompt generation.
  assert.equal(loader.getSystemPrompt(), undefined);
  assert.deepEqual(loader.getAppendSystemPrompt(), []);
  const extensions = loader.getExtensions();
  assert.deepEqual(extensions.errors, []);
  assert.equal(extensions.extensions.length, 1);
  assert.ok(extensions.extensions[0].commands.has('explicit-sentinel'));
  assert.equal(extensions.extensions[0].commands.has('leak-sentinel'), false);
});

test('O01 real own-session resume/continue and foreign RPC switch cancellation', async () => {
  const sdk = await import(pathToFileURL(paths.sdk).href);
  const cwd = path.join(tmp, 'resume-project');
  fs.mkdirSync(cwd);
  const manager = sdk.SessionManager.create(cwd, paths.sessions);
  manager.appendModelChange('9router', 'cx/gpt-6-sol');
  manager.appendMessage({ role: 'user', content: 'offline persisted fixture; never submitted to a provider', timestamp: Date.now() });
  manager.appendMessage({ role: 'assistant', content: [{type:'text',text:'synthetic persisted response'}], api:'openai-completions', provider:'9router', model:'cx/gpt-6-sol', usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}, stopReason:'stop', timestamp:Date.now() });
  const sessionFile = manager.getSessionFile();
  assert.ok(fs.existsSync(sessionFile));
  try {
    for (const args of [['--session', sessionFile], ['--continue']]) {
      const result = await rpc([{id:'state',type:'get_state'}], {cwd,args});
      const state = result.records.find(record => record.id === 'state').data;
      assert.equal(state.sessionId, manager.getSessionId());
      assert.equal(state.messageCount, 2);
    }
    const foreign = path.join(tmp, 'foreign-session.jsonl');
    fs.copyFileSync(sessionFile, foreign);
    const result = await rpc([{id:'switch',type:'switch_session',sessionPath:foreign}], {cwd,args:['--session',sessionFile]});
    const response = result.records.find(record => record.id === 'switch');
    assert.equal(response.data?.cancelled, true, JSON.stringify(response));
  } finally { fs.unlinkSync(sessionFile); }
});

test('T0 input gate handles a synthetic prompt before any inference request', async () => {
  const receipt = path.join(tmp, 'input-gate.json');
  const result = await rpc([{id:'gate',type:'prompt',message:'offline input-gate fixture'}], {receipt});
  const response = result.records.find(record => record.id === 'gate');
  assert.equal(response.success, true, JSON.stringify(result));
  assert.equal(response.data.disposition, 'handled');
  assert.equal(result.records.some(record => record.type === 'agent_start'), false);
  assert.equal(JSON.parse(fs.readFileSync(receipt, 'utf8')).blockedNetworkAttempts, 0);
});

test('O01 immutable baseline/fork/launchers', () => {
  const result = auditBaseline();
  assert.equal(result.passed, true, JSON.stringify(result.changed));
});
