import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolveChildSpec, validateChildTask } from './child-profiles.ts';

const terminal = new Set(['completed', 'failed', 'cancelled', 'interrupted']);
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const now = () => new Date().toISOString();
const errorText = (error: any) => String(error?.message ?? error).slice(0, 1000);

function atomicJson(file: string, value: any) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2));
  fs.renameSync(temporary, file);
}

function safeId(id: string) { if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('INVALID_CHILD_ID'); return id; }

export function createProcessChildTransport(options: any) {
  const runner = path.resolve(options.runner);
  const guard = path.resolve(options.offlineGuard);
  const brokered = typeof options.modelBroker === 'function';
  async function launch(record: any, assignment: string, spec: any, resume = false) {
      const childEnv: any = {};
      for (const key of ['SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'PATH', 'PATHEXT', 'ComSpec']) if (process.env[key]) childEnv[key] = process.env[key];
      childEnv.USERPROFILE = options.agentDir;
      childEnv.HOME = options.agentDir;
      childEnv.PI_REASON_CHILD = '1';
      childEnv.PI_REASON_OFFLINE = options.offline || brokered ? '1' : '0';
      if(process.env.PROTOTYPE_GUARD_DIR)childEnv.PROTOTYPE_GUARD_DIR=process.env.PROTOTYPE_GUARD_DIR;
      const child = spawn(process.execPath, ['--import', pathToFileURL(guard).href, runner], {
        cwd: options.cwd, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        env: childEnv
      });
      let stderr = '';
      let finished: any;
      const providerRequests = new Map<string, AbortController>();
      child.stderr?.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-4096); });
      const exit = new Promise<any>(resolve => child.once('exit', (code, signal) => resolve({ code, signal, stderr })));
      exit.then(() => { for (const controller of providerRequests.values()) controller.abort(new Error('CHILD_DISCONNECTED')); providerRequests.clear(); });
      const requests = new Map<string, any>();
      child.on('message', (message: any) => {
        if (message?.type === 'finished') { finished = message; return; }
        if (message?.type === 'provider_cancel') {
          providerRequests.get(message.requestId)?.abort(new Error('CHILD_PROVIDER_CANCELLED'));
          return;
        }
        if (message?.type === 'provider_request') {
          const requestId = message.requestId;
          if (!brokered || typeof requestId !== 'string' || providerRequests.has(requestId)) {
            child.send({ type: 'provider_response', requestId, ok: false, error: 'MODEL_BROKER_UNAVAILABLE' });
            return;
          }
          if (message.model?.provider !== record.model?.provider || message.model?.id !== record.model?.model ||
            message.options?.reasoning !== (record.model?.thinkingLevel === 'off' ? undefined : record.model?.thinkingLevel)) {
            child.send({ type: 'provider_response', requestId, ok: false, error: 'MODEL_BROKER_SLOT_MISMATCH' });
            return;
          }
          const controller = new AbortController();
          providerRequests.set(requestId, controller);
          Promise.resolve().then(() => options.modelBroker(
            { model: message.model, context: message.context, options: message.options },
            { record, signal: controller.signal }
          )).then((response: any) => {
            if (!controller.signal.aborted && child.connected) child.send({ type: 'provider_response', requestId, ok: true, response });
          }, (error: any) => {
            if (!controller.signal.aborted && child.connected) child.send({ type: 'provider_response', requestId, ok: false, error: errorText(error) });
          }).finally(() => providerRequests.delete(requestId));
          return;
        }
        const pending = requests.get(message?.requestId);
        if (pending) { requests.delete(message.requestId); pending.resolve(message); }
      });
      function request(type: string, data: any, timeoutMs = 30000) {
        const requestId = crypto.randomUUID();
        return new Promise<any>((resolve, reject) => {
          const timer = setTimeout(() => { requests.delete(requestId); reject(new Error('CHILD_IPC_TIMEOUT')); }, timeoutMs);
          requests.set(requestId, { resolve: (value: any) => { clearTimeout(timer); resolve(value); } });
          child.send({ type, requestId, ...data }, error => { if (error) { clearTimeout(timer); requests.delete(requestId); reject(error); } });
          exit.then(() => { if (requests.delete(requestId)) { clearTimeout(timer); reject(new Error('CHILD_EXITED')); } });
        });
      }
      let started;
      let startupCleanupConfirmed = false;
      try {
        started = await request('start', { record, assignment, spec, resume,
          upstreamPath: options.upstreamPath, agentDir: path.join(options.agentDir, record.id), sessionDir: path.join(options.sessionDir, record.id),
          workspace: options.cwd, offline: options.offline || brokered, brokered, writerLeasePath: options.writerLeasePath,
          leaseRoot: options.leaseRoot, policyPath: options.policyPath, windowsToolsPath: options.windowsToolsPath,
          codemodePath: options.codemodePath, offlineDelayMs: options.offlineDelayMs ?? 0,
          offlineScenario: options.offlineScenario ?? 'reply' }, 30000);
        if (!started.ok) { startupCleanupConfirmed = started.cleanupConfirmed === true; throw new Error(started.error || 'CHILD_START_FAILED'); }
      } catch (error) {
        child.kill(); const info = await Promise.race([exit, delay(10000).then(() => null)]);
        const failure: any = new Error(`${errorText(error)} ${info?.stderr ?? stderr}`.slice(0, 2000));
        failure.cleanupConfirmed = !!info && startupCleanupConfirmed;
        throw failure;
      }
      return {
        pid: child.pid, sessionPath: started.sessionPath,
        done: exit.then(info => ({ status: info.code === 0 && finished?.ok ? 'completed' : 'failed',
          text: finished?.text ?? info.stderr, error: finished?.error, exitCode: info.code,
          cleanupConfirmed: finished?.cleanupConfirmed === true })),
        async send(prompt: string, generation: number) { const result = await request('prompt', { prompt, generation }); if (!result.ok) throw new Error(result.error || 'CHILD_PROMPT_FAILED'); return result; },
        async cancel() { let response; try { response = await request('cancel', {}, 10000); } catch {} if (child.exitCode === null) child.kill(); const info = await Promise.race([exit, delay(10000).then(() => null)]); return !!info && response?.cleanupConfirmed === true; },
        async close() { let response; try { response = await request('close', {}, 10000); } catch {} if (child.exitCode === null) child.kill(); return !!(await Promise.race([exit, delay(10000).then(() => null)])) && response?.cleanupConfirmed === true; }
      };
  }
  return { start: (record: any, assignment: string, spec: any) => launch(record, assignment, spec),
    resume: (record: any, assignment: string, spec: any) => launch(record, assignment, spec, true) };
}

export function createChildSupervisor(options: any) {
  const maxActive = Math.min(3, options.maxActiveChildren ?? 3);
  if (!Number.isInteger(maxActive) || maxActive < 1) throw new Error('INVALID_CHILD_CAPACITY');
  const registryDir = path.resolve(options.registryDir);
  const writeRecord = options.writeRecord ?? atomicJson;
  const records = new Map<string, any>();
  const handles = new Map<string, any>();
  const pending = new Set<string>();
  let shuttingDown = false;
  const owner = { session: options.ownerSession, branch: options.ownerBranch };
  if (!owner.session || !owner.branch) throw new Error('OWNER_REQUIRED');
  fs.mkdirSync(registryDir, { recursive: true });
  for (const file of fs.readdirSync(registryDir).filter(name => /^[a-f0-9-]{36}\.json$/.test(name))) {
    const record = JSON.parse(fs.readFileSync(path.join(registryDir, file), 'utf8'));
    if (!terminal.has(record.status) && record.owner?.session === owner.session && record.owner?.branch === owner.branch) {
      record.status = 'interrupted'; record.cleanupConfirmed = false; record.updatedAt = now(); atomicJson(path.join(registryDir, file), record);
    }
    records.set(record.id, record);
  }
  const persist = (record: any) => { record.updatedAt = now(); writeRecord(path.join(registryDir, `${safeId(record.id)}.json`), record); records.set(record.id, record); };
  const owned = (id: string) => {
    const record = records.get(safeId(id));
    if (!record || record.owner.session !== owner.session || record.owner.branch !== owner.branch) throw new Error('CHILD_OWNER_MISMATCH');
    return record;
  };
  const capacity = () => [...records.values()].filter(record => !terminal.has(record.status) || record.cleanupConfirmed === false).length;
  const transport = options.transport ?? createProcessChildTransport(options);
  async function settle(record: any, result: any) {
    if (record.status === 'cancelled') return;
    const next = { ...record, status: result.status ?? 'failed',
      reply: { text: String(result.text ?? ''), generation: record.generation },
      error: result.error, cleanupConfirmed: result.cleanupConfirmed !== false,
      completedAt: now(), deliveryToken: crypto.randomUUID() };
    persist(next);
    if (next.cleanupConfirmed) handles.delete(next.id);
    try { await options.onCompletion?.(next); } catch { /* Receipt remains available for agents_wait. */ }
  }
  const observeSettlement = (record: any, done: Promise<any>) => {
    void Promise.resolve(done).then(result => settle(record, result), error => settle(record, {
      status: 'failed', error: errorText(error), cleanupConfirmed: false
    })).catch(error => {
      // A failed receipt write must never free the in-memory capacity slot.
      record.status = 'interrupted'; record.cleanupConfirmed = false; record.error = `RESULT_WRITE_FAILED: ${errorText(error)}`;
      records.set(record.id, record);
    });
  };
  async function spawnTasks(tasks: any[], signal?: AbortSignal) {
    if (shuttingDown) throw new Error('SUPERVISOR_SHUTTING_DOWN');
    if (!Array.isArray(tasks) || tasks.length < 1 || tasks.length > 100) throw new Error('INVALID_CHILD_TASKS');
    const parsed = tasks.map(validateChildTask);
    const specs = parsed.map(task => resolveChildSpec(options.config, task, options.parentGrantedTools, options.runtimeTools));
    const batchKeys = new Set<string>();
    for (const task of parsed) {
      if (task.task_key && batchKeys.has(task.task_key)) throw new Error('DUPLICATE_TASK_KEY');
      if (task.task_key) batchKeys.add(task.task_key);
      if (task.task_key && [...records.values()].some(record => record.owner.session === owner.session && record.owner.branch === owner.branch && record.taskKey === task.task_key)) throw new Error('DUPLICATE_TASK_KEY');
    }
    const sessions = [];
    for (let i = 0; i < parsed.length; i++) {
      if (shuttingDown || signal?.aborted || capacity() >= maxActive) break;
      const task = parsed[i], spec = specs[i], id = crypto.randomUUID();
      const record: any = { id, owner, taskKey: task.task_key ?? `${Date.now()}:${i}`, title: task.title,
        assignment: task.prompt, profile: spec.profile, modelSlot: spec.modelSlot, model: spec.model,
        capabilityHash: spec.capabilityHash, tools: spec.tools, generation: 1, status: 'starting',
        createdAt: now(), cleanupConfirmed: false, claimed: false };
      // Synchronous persistence reserves the slot before any asynchronous startup.
      persist(record); pending.add(id);
      try {
        const handle = await transport.start(record, task.prompt, spec);
        handles.set(id, handle); record.pid = handle.pid; record.sessionPath = handle.sessionPath;
        if (record.status === 'cancelled' || signal?.aborted) {
          pending.delete(id);
          record.status = 'cancelled';
          record.cleanupConfirmed = await handle.cancel(); persist(record);
          if (record.cleanupConfirmed) handles.delete(id);
          break;
        }
        record.status = 'running'; record.startedAt = now(); persist(record);
        sessions.push({ id, title: record.title, status: record.status, generation: 1, session_path: record.sessionPath });
        pending.delete(id);
        observeSettlement(record, handle.done);
      } catch (error) {
        pending.delete(id); if (record.status !== 'cancelled') record.status = 'failed';
        const handle = handles.get(id);
        let confirmed = error?.cleanupConfirmed === true;
        if (handle) { try { confirmed = await handle.cancel(); } catch { confirmed = false; } }
        record.error = errorText(error); record.cleanupConfirmed = confirmed; record.completedAt = now();
        if (confirmed) handles.delete(id);
        try { persist(record); } catch { record.cleanupConfirmed = false; records.set(id, record); }
        break;
      }
    }
    return { count: sessions.length, requested_count: tasks.length, partial: sessions.length !== tasks.length,
      sessions, subagent_session_ids: sessions.map(item => item.id) };
  }
  async function wait(ids: string[], timeoutMs = 30000, pollIntervalMs = 250, signal?: AbortSignal) {
    if (!Array.isArray(ids) || !ids.length || timeoutMs < 0 || timeoutMs > 120000 || pollIntervalMs < 100 || pollIntervalMs > 5000) throw new Error('INVALID_WAIT_ARGS');
    ids.forEach(owned);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline && ids.some(id => !terminal.has(owned(id).status))) {
      if(signal?.aborted)throw new Error('WAIT_ABORTED');
      await new Promise<void>(resolve=>{
        const onAbort=()=>{clearTimeout(timer);resolve();};
        const timer=setTimeout(()=>{signal?.removeEventListener('abort',onAbort);resolve();},Math.min(pollIntervalMs,deadline-Date.now()));
        signal?.addEventListener('abort',onAbort,{once:true});
      });
    }
    if(signal?.aborted)throw new Error('WAIT_ABORTED');
    return ids.map(id => { const record = owned(id); return { id, status: record.status, generation: record.generation,
      session: { reply: { text: record.reply?.text ?? '' } }, preview: (record.reply?.text ?? '').slice(0, 2000),
      truncated: (record.reply?.text ?? '').length > 2000, delivery: claimResult(id) }; });
  }
  function claimResult(id: string) {
    const record = owned(id);
    if (!terminal.has(record.status) || !record.deliveryToken || record.claimed) return null;
    persist({ ...record, claimed: true, claimedAt: now() });
    return { token: record.deliveryToken, text: record.reply?.text ?? '', status: record.status };
  }
  async function send(id: string, prompt: string) {
    if (shuttingDown) throw new Error('SUPERVISOR_SHUTTING_DOWN');
    const record = owned(id);
    if (typeof prompt !== 'string' || !prompt.length || prompt.length > 8000) throw new Error('INVALID_CHILD_PROMPT');
    if (!terminal.has(record.status)) throw new Error('CHILD_BUSY');
    if (capacity() >= maxActive) throw new Error('CHILD_CAPACITY_FULL');
    if (!record.cleanupConfirmed || !record.sessionPath) throw new Error('CHILD_RESUME_UNAVAILABLE');
    const spec = resolveChildSpec(options.config, { profile: record.profile, model_slot: record.modelSlot }, options.parentGrantedTools, options.runtimeTools);
    if (spec.capabilityHash !== record.capabilityHash) throw new Error('CAPABILITY_CHANGED');
    const transportResume = transport.resume;
    if (!transportResume) throw new Error('CHILD_RESUME_UNAVAILABLE');
    record.generation++; record.status = 'starting'; record.claimed = false; record.deliveryToken = undefined; record.reply = undefined; record.cleanupConfirmed = false; persist(record);
    pending.add(id);
    try {
      const handle = await transportResume(record, prompt, spec); handles.set(id, handle);
      if (record.status === 'cancelled') {
        record.cleanupConfirmed = await handle.cancel(); persist(record);
        if (record.cleanupConfirmed) handles.delete(id);
        return { id, generation: record.generation, status: 'cancelled' };
      }
      record.status = 'running'; record.pid = handle.pid; persist(record);
      observeSettlement(record, handle.done);
      return { id, generation: record.generation, status: record.status };
    } catch (error) {
      let confirmed = error?.cleanupConfirmed === true;
      const handle = handles.get(id);
      if (handle) { try { confirmed = await handle.cancel(); } catch { confirmed = false; } }
      record.status = 'failed'; record.error = errorText(error); record.cleanupConfirmed = confirmed;
      if (confirmed) handles.delete(id);
      try { persist(record); } catch { record.cleanupConfirmed = false; records.set(id, record); }
      throw error;
    } finally {
      pending.delete(id);
    }
  }
  async function cancel(id: string) {
    const record = owned(id), handle = handles.get(id);
    if (terminal.has(record.status) && record.cleanupConfirmed === true) return { id, status: record.status, cleanup_confirmed: true };
    record.status = 'cancelled';
    try { persist(record); } catch { records.set(id, record); }
    let confirmed = false;
    if (handle) { try { confirmed = await handle.cancel(); } catch (error) { record.error = errorText(error); } }
    record.cleanupConfirmed = confirmed; record.completedAt = now(); record.deliveryToken = crypto.randomUUID();
    try { persist(record); } catch { record.cleanupConfirmed = false; records.set(id, record); }
    if (confirmed) handles.delete(id);
    return { id, status: record.status, cleanup_confirmed: record.cleanupConfirmed };
  }
  async function shutdown() {
    shuttingDown = true;
    const ids = [...records.values()].filter(record => record.owner.session === owner.session && record.owner.branch === owner.branch && (!terminal.has(record.status) || record.cleanupConfirmed === false)).map(record => record.id);
    await Promise.all(ids.map(cancel));
    const deadline = Date.now() + 30000;
    while (pending.size && Date.now() < deadline) await delay(25);
    return ids.map(id => ({ id, status: owned(id).status, cleanup_confirmed: owned(id).cleanupConfirmed }));
  }
  return { spawnTasks, wait, send, cancel, shutdown, claimResult, get: owned, list: () => [...records.values()].filter(record => record.owner.session === owner.session && record.owner.branch === owner.branch), activeCount: capacity };
}
