import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

let session, lease, leaseApi, started = false, finished = false;
const providerPending = new Map();
const fail = error => String(error?.message ?? error).slice(0, 1000);
const reply = (requestId, data) => process.send?.({ requestId, ...data });
const notifyFinished = data => new Promise(resolve => process.send?.({ type: 'finished', ...data }, () => resolve()));
async function cleanup() {
  for (const [requestId, pending] of providerPending) {
    process.send?.({ type: 'provider_cancel', requestId });
    pending.reject(new Error('CHILD_BROKER_CLEANUP'));
  }
  providerPending.clear();
  try { await session?.abort?.(); } catch {}
  session?.dispose?.();
  if (lease && leaseApi) {
    try { await leaseApi.releaseWriterLease(lease, { cleanupConfirmed: true }); lease = null; }
    catch { return false; }
  }
  return true;
}
function requestBroker(model, context, options) {
  if (!process.connected) return Promise.reject(new Error('CHILD_BROKER_DISCONNECTED'));
  const requestId = crypto.randomUUID();
  const safeOptions = {
    reasoning: options.reasoning,
    maxTokens: options.maxTokens,
    temperature: options.temperature,
    samplingParams: options.samplingParams,
    cacheRetention: options.cacheRetention,
    sessionId: options.sessionId
  };
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) return reject(new Error('CHILD_BROKER_ABORTED'));
    const abort = () => {
      process.send?.({ type: 'provider_cancel', requestId });
      providerPending.delete(requestId);
      reject(new Error('CHILD_BROKER_ABORTED'));
    };
    providerPending.set(requestId, {
      resolve: value => { options.signal?.removeEventListener('abort', abort); resolve(value); },
      reject: error => { options.signal?.removeEventListener('abort', abort); reject(error); }
    });
    options.signal?.addEventListener('abort', abort, { once: true });
    process.send({ type: 'provider_request', requestId, model, context, options: safeOptions }, error => {
      if (error && providerPending.delete(requestId)) {
        options.signal?.removeEventListener('abort', abort);
        reject(error);
      }
    });
  });
}
function installBrokerStream(ai, configuredModel) {
  session.agent.streamFunction = async (model, context, options) => {
    if (model.provider !== configuredModel.provider || model.id !== configuredModel.id) throw new Error('CHILD_MODEL_SLOT_MISMATCH');
    const response = await requestBroker(model, context, options);
    if (!response || response.role !== 'assistant' || !Array.isArray(response.content) ||
      response.provider !== configuredModel.provider || response.model !== configuredModel.id ||
      !response.usage || !['stop', 'toolUse', 'length', 'deferred', 'error', 'aborted'].includes(response.stopReason)) {
      throw new Error('CHILD_BROKER_RESPONSE_INVALID');
    }
    const stream = new ai.AssistantMessageEventStream();
    stream.push({ type: 'start', partial: response });
    if (response.stopReason === 'error' || response.stopReason === 'aborted') {
      stream.push({ type: 'error', reason: response.stopReason, error: response });
    } else stream.push({ type: 'done', reason: response.stopReason, message: response });
    return stream;
  };
}
function syntheticMessage(model, text) {
  return { role: 'assistant', content: [{ type: 'text', text }], api: model.api, provider: model.provider,
    model: model.id, usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }, stopReason: 'stop', timestamp: Date.now() };
}
async function runOffline(ai, model, assignment, delayMs, scenario) {
  try {
    if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, Math.min(delayMs, 10000)));
    if (finished) return;
    let requests = 0;
    session.agent.streamFunction = (_model, context) => {
      if (++requests > (scenario === 'reply' ? 1 : 2)) throw new Error('OFFLINE_CHILD_UNEXPECTED_MODEL_REQUEST');
      const actual = context.messages.filter(message => message.role === 'user').at(-1)?.content;
      const userText = typeof actual === 'string' ? actual : Array.isArray(actual) ? actual.filter(item => item.type === 'text').map(item => item.text).join('') : '';
      if (userText !== assignment) throw new Error('CHILD_ASSIGNMENT_CHANGED');
      let message;
      if (requests === 1 && scenario !== 'reply') {
        const id = 'offline-tool-call';
        const tool = scenario === 'write' ? { name: 'write', arguments: { path: 'child-output.txt', content: 'written by offline child' } }
          : scenario === 'outside_read' ? { name: 'read', arguments: { path: 'D:/pi-clean/launch.mjs' } }
          : scenario === 'nested_outside_read' ? { name: 'codemode', arguments: { code: 'await tools.read({path:"D:/pi-clean/launch.mjs"});' } }
          : scenario === 'forbidden_write' ? { name: 'write', arguments: { path: 'forbidden.txt', content: 'forbidden' } }
          : null;
        if (!tool) throw new Error('UNKNOWN_OFFLINE_SCENARIO');
        message = syntheticMessage(model, '');
        message.content = [{ type: 'toolCall', id, name: tool.name, arguments: tool.arguments }];
        message.stopReason = 'toolUse';
      } else {
        const toolResult = session.messages.filter(item => item.role === 'toolResult').at(-1);
        const suffix = scenario === 'reply' ? '' : `:${toolResult?.isError ? 'TOOL_ERROR' : 'TOOL_OK'}`;
        message = syntheticMessage(model, `OFFLINE_FIXTURE_REPLY:${assignment}${suffix}`);
      }
      const stream = new ai.AssistantMessageEventStream();
      stream.push({ type: 'start', partial: message });
      stream.push({ type: 'done', reason: message.stopReason, message });
      return stream;
    };
    await session.prompt(assignment);
    const text = session.messages.filter(message => message.role === 'assistant').at(-1)?.content
      ?.filter(item => item.type === 'text').map(item => item.text).join('') ?? '';
    finished = true; const cleanupConfirmed = await cleanup();
    await notifyFinished({ ok: cleanupConfirmed, text, cleanupConfirmed }); process.exit(cleanupConfirmed ? 0 : 1);
  } catch (error) {
    finished = true; const cleanupConfirmed = await cleanup();
    await notifyFinished({ ok: false, error: fail(error), cleanupConfirmed }); process.exit(1);
  }
}
async function runBrokered(assignment) {
  try {
    await session.prompt(assignment);
    const last = session.messages.filter(message => message.role === 'assistant').at(-1);
    if (!last || last.stopReason === 'error' || last.stopReason === 'aborted') throw new Error(last?.errorMessage || 'CHILD_BROKER_RUN_FAILED');
    const text = last.content.filter(item => item.type === 'text').map(item => item.text).join('');
    finished = true; const cleanupConfirmed = await cleanup();
    await notifyFinished({ ok: cleanupConfirmed, text, cleanupConfirmed }); process.exit(cleanupConfirmed ? 0 : 1);
  } catch (error) {
    finished = true; const cleanupConfirmed = await cleanup();
    await notifyFinished({ ok: false, error: fail(error), cleanupConfirmed }); process.exit(1);
  }
}
process.on('message', async message => {
  try {
    if (message.type === 'provider_response') {
      const pending = providerPending.get(message.requestId);
      if (pending) {
        providerPending.delete(message.requestId);
        if (message.ok) pending.resolve(message.response);
        else pending.reject(new Error(message.error || 'CHILD_BROKER_FAILED'));
      }
      return;
    }
    if (message.type === 'start') {
      if (started) throw new Error('CHILD_ALREADY_STARTED');
      if (!message.offline || process.env.PI_REASON_OFFLINE !== '1') throw new Error('LIVE_CHILD_BUDGET_NOT_CONFIGURED');
      if (!path.isAbsolute(message.upstreamPath) || !path.isAbsolute(message.agentDir) || !path.isAbsolute(message.sessionDir)) throw new Error('CHILD_PATH_NOT_ABSOLUTE');
      if (message.record.profile === 'default') {
        if (!message.writerLeasePath || !path.isAbsolute(message.writerLeasePath)) throw new Error('WRITER_LEASE_REQUIRED');
        leaseApi = await import(pathToFileURL(message.writerLeasePath).href);
        lease = await leaseApi.acquireWriterLease({ workspace: message.workspace, owner: message.record.id, leaseRoot: message.leaseRoot });
      }
      const { sdk, ai } = await import(pathToFileURL(message.upstreamPath).href);
      const { ModelRuntime, SessionManager, SettingsManager, DefaultResourceLoader, createAgentSession } = sdk;
      fs.mkdirSync(message.agentDir, { recursive: true }); fs.mkdirSync(message.sessionDir, { recursive: true });
      const model = { id: message.spec.model.model, name: message.spec.model.model, provider: message.spec.model.provider,
        api: 'openai-completions', baseUrl: 'http://127.0.0.1:9', compat: {supportsOpenAIGrammarTools:false}, reasoning: message.spec.model.thinkingLevel !== 'off', input: ['text'], contextWindow: 272000,
        maxTokens: 1024, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } };
      const modelRuntime = await ModelRuntime.create({ credentials: new ai.InMemoryCredentialStore(), modelsPath: null,
        modelsStorePath: path.join(message.agentDir, 'child-model-store.json'), allowModelNetwork: false, refreshOnCreate: false });
      modelRuntime.hasConfiguredAuth = () => true;
      modelRuntime.getAuth = async () => ({ auth: { apiKey: 'offline-synthetic' }, env: {} });
      modelRuntime.streamSimple = () => { throw new Error('OFFLINE_CHILD_UNEXPECTED_MODEL_REQUEST'); };
      const root = fs.realpathSync.native(message.sessionDir);
      let manager;
      if (message.resume) {
        const sessionPath = fs.realpathSync.native(message.record.sessionPath);
        const relative = path.relative(root, sessionPath);
        if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('CHILD_SESSION_PATH_ESCAPE');
        manager = SessionManager.open(sessionPath, message.sessionDir, message.workspace);
        if (manager.getSessionId() !== message.record.id) throw new Error('CHILD_SESSION_ID_MISMATCH');
      } else manager = SessionManager.create(message.workspace, message.sessionDir, { id: message.record.id, parentSession: message.record.owner.session });
      const settingsManager = SettingsManager.inMemory({ packages: [], defaultTools: message.spec.tools,
        cacheWarming: 'off', retry: { enabled: false }, compaction: { enabled: false } });
      if (!message.policyPath || !path.isAbsolute(message.policyPath)) throw new Error('CHILD_POLICY_REQUIRED');
      const policy = await import(pathToFileURL(message.policyPath).href);
      const codemode = message.codemodePath ? await import(pathToFileURL(message.codemodePath).href) : null;
      const windows = message.record.profile === 'default' ? await import(pathToFileURL(message.windowsToolsPath).href) : null;
      const extensionFactories = [(pi) => {
        policy.registerDeferredFileTools(pi, message.workspace);
        if (codemode) codemode.registerCodemode(pi);
        if (windows) windows.registerWindowsTools(pi, { cwd: message.workspace, workspace: message.workspace,
          owner: message.record.id, leaseRoot: message.leaseRoot, existingLease: lease });
        policy.registerToolPolicy(pi, { workspace: message.workspace, allowedTools: message.spec.tools,
          readOnly: message.record.profile === 'code_explorer', owner: message.record.id,
          leaseRoot: message.leaseRoot, existingLease: lease });
      }];
      const loader = new DefaultResourceLoader({ cwd: message.workspace, agentDir: message.agentDir, settingsManager,
        extensionFactories, noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
        systemPromptOverride: () => message.spec.systemPrompt, appendSystemPromptOverride: () => [] });
      await loader.reload();
      const created = await createAgentSession({ cwd: message.workspace, agentDir: message.agentDir, modelRuntime,
        model, thinkingLevel: message.spec.model.thinkingLevel ?? 'off', sessionManager: manager, settingsManager, resourceLoader: loader,
        tools: message.spec.tools, noTools: 'all' });
      session = created.session;
      await session.bindExtensions({ mode: 'rpc', onError: () => {} });
      const callable = new Set(session.getCallableToolNames());
      if ([...callable].some(name => !message.spec.tools.includes(name))) throw new Error('CHILD_TOOL_CEILING_BYPASS');
      if (message.brokered) installBrokerStream(ai, model);
      started = true; reply(message.requestId, { ok: true, sessionPath: session.sessionFile });
      if (message.brokered) void runBrokered(message.assignment);
      else void runOffline(ai, model, message.assignment, message.offlineDelayMs ?? 0, message.offlineScenario ?? 'reply');
      return;
    }
    if (message.type === 'cancel' || message.type === 'close') {
      finished = true; const cleanupConfirmed = await cleanup();
      reply(message.requestId, { ok: cleanupConfirmed, cleanupConfirmed }); process.exit(cleanupConfirmed ? 0 : 1); return;
    }
    throw new Error('UNKNOWN_CHILD_MESSAGE');
  } catch (error) { const cleanupConfirmed=await cleanup(); reply(message.requestId, { ok: false, error: fail(error), cleanupConfirmed }); process.exitCode = 1; }
});
process.on('disconnect', () => { finished = true; cleanup().finally(() => process.exit(1)); });
