import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { sdk, Type } from './upstream.mjs';
import { root, canonicalPath, isWithin, resolvePrototypePaths } from './paths.mjs';
import { registerCodemode } from './codemode-policy.ts';
import { registerToolPolicy, registerDeferredFileTools, CORE_TOOLS } from './tool-policy.ts';
import { registerWindowsTools } from './windows-tools.ts';
import { registerContextPolicy, restoreRuntimePointers, POINTER_ENTRY_TYPE } from './context-policy.ts';
import { registerTelemetry } from './telemetry.ts';
import { loadCuratedBrainConfig, recallSessionContext } from './brain-config.ts';
import { loadChildProfiles } from './child-profiles.ts';
import { createChildSupervisor } from './child-supervisor.ts';
import { registerDelegation } from './delegation.ts';
import { registerReasonUI } from './reason-ui.mjs';

export function registerHarness(pi, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const config = options.config ?? JSON.parse(fs.readFileSync(path.join(root, 'config/harness.json'), 'utf8'));
  let supervisor, activeContext;
  if(config.ui?.reasonTerminal)pi=registerReasonUI(pi,{cwd,getChildren:()=>supervisor?.list()??[],offline:!options.liveEvaluation&&!options.allowSyntheticTurns}).pi;
  const owner = options.owner ?? `parent-${process.pid}`;
  const enabled = name => config.features?.[name] !== false;
  const turnsAllowed=options.allowSyntheticTurns===true||options.liveEvaluation?.allowsModelTurns?.()===true;
  const leaseRoot = options.leaseRoot ?? path.join(root,'agent/writer-leases');
  const grants = [...CORE_TOOLS,'grep','find','ls','powershell','agents_spawn','agents_wait','sessions_send','sessions_cancel',
    ...['brain_context','brain_search','brain_feedback','brain_note','brain_apply_evidence'].map(name=>`mcp__open_second_brain__${name}`)];
  const policy = registerToolPolicy(pi,{workspace:cwd,allowedTools:grants,owner,leaseRoot});
  if(enabled('codemode'))registerCodemode(pi,config.codemode);
  registerDeferredFileTools(pi,cwd);
  registerWindowsTools(pi,{cwd,owner,leaseRoot,getExistingLease:policy.getExistingLease});
  let telemetryFile;
  const emitTelemetry=options.emitTelemetry??(record=>{
    if(!telemetryFile)return;
    fs.appendFileSync(telemetryFile,JSON.stringify(record)+'\n');
  });
  const telemetry = enabled('telemetry')?registerTelemetry(pi,{emit:emitTelemetry}):{emit:()=>{},records:[]};
  let recall = {status:'unavailable',reason:'OFFLINE_BRAIN_TRANSPORT_NOT_CONNECTED'};
  const recallBrain = query => recallSessionContext({query,beforeDecision:true,callTool:options.brainCaller ?? (async()=>{throw new Error('OFFLINE_BRAIN_TRANSPORT_NOT_CONNECTED');})});
  if(enabled('context'))registerContextPolicy(pi,{guidelines:fs.readFileSync(path.join(root,'prompts/harness.md'),'utf8'),recall:enabled('brain')?recallBrain:undefined,onRecallUnavailable:reason=>telemetry.emit({type:'brain_unavailable',reason})});
  pi.on('before_agent_start',(event,ctx)=>{
    const pointers=restoreRuntimePointers(ctx.sessionManager.getBranch());
    if(Object.keys(pointers).length)event.systemPromptOptions.sections.reason_harness_tasks=JSON.stringify(Object.fromEntries(Object.entries(pointers).slice(-16)));
  });
  if (enabled('brain')&&options.brainTransport) sdk.createMcpExtension({loadConfig:()=>loadCuratedBrainConfig(),createTransport:options.brainTransport,
    logPath:path.join(root,'agent/mcp.log'),updateConfig:()=>{throw new Error('CURATED_BRAIN_CONFIG_READ_ONLY');}})(pi);
  const recordPointer=record=>pi.appendEntry(POINTER_ENTRY_TYPE,{key:`child_${record.id}`,childId:record.id,taskId:record.taskKey?.slice(0,160),generation:record.generation});
  const closedTransport = {start:async()=>{throw Object.assign(new Error('LIVE_CHILD_BUDGET_NOT_CONFIGURED'),{cleanupConfirmed:true});}};
  function startSupervisor(ctx, newBranch=false) {
    activeContext=ctx;
    const branchEntry=[...ctx.sessionManager.getBranch()].reverse().find(entry=>entry.type==='custom'&&entry.customType==='prototype_owner_branch');
    const branch=newBranch?randomUUID():(branchEntry?.data?.branch??randomUUID());
    if(newBranch||!branchEntry)pi.appendEntry('prototype_owner_branch',{branch});
    const profileConfig=options.childProfiles??loadChildProfiles(path.join(root,'config/child-profiles.json'));
    supervisor=createChildSupervisor({registryDir:options.registryDir??path.join(root,'agent/children',ctx.sessionManager.getSessionId(),'receipts'),
      ownerSession:ctx.sessionManager.getSessionId(),ownerBranch:branch,config:profileConfig,parentGrantedTools:grants,runtimeTools:pi.getAllTools().map(tool=>tool.name),
      maxActiveChildren:config.maxActiveChildren,transport:options.childTransport??(!turnsAllowed?closedTransport:undefined),
      runner:path.join(root,'src/child-runner.mjs'),offlineGuard:path.join(root,'src/offline-guard.mjs'),upstreamPath:path.join(root,'src/upstream.mjs'),
      policyPath:path.join(root,'src/tool-policy.ts'),codemodePath:path.join(root,'src/codemode-policy.ts'),windowsToolsPath:path.join(root,'src/windows-tools.ts'),
      writerLeasePath:path.join(root,'src/workspace-ownership.ts'),leaseRoot,agentDir:options.childAgentDir??path.join(root,'agent/children/profiles'),sessionDir:options.childSessionDir??path.join(root,'agent/children/sessions'),cwd,offline:true,
      onCompletion:record=>{
        recordPointer(record);
        if(!activeContext?.isIdle())return;
        const delivery=supervisor.claimResult(record.id);
        if(delivery)pi.sendMessage({customType:'child_completion',content:delivery.text.slice(0,8000),display:true,details:{id:record.id,status:delivery.status,token:delivery.token}},{triggerTurn:false});
      }});
  }
  const delegate=new Proxy({}, {get:(_target,name)=>(...args)=>{
    if(!supervisor)throw new Error('PARENT_SESSION_NOT_READY');
    const result=supervisor[name](...args);
    if(name==='spawnTasks'||name==='send')return Promise.resolve(result).then(value=>{
      const ids=name==='send'?[value.id]:value.subagent_session_ids;
      for(const id of ids)recordPointer(supervisor.get(id));
      return value;
    });
    return result;
  }});
  if(enabled('delegation'))registerDelegation(pi,{supervisor:delegate,Type});
  pi.on('session_start',async(_event,ctx)=>{
    const telemetryDir=options.telemetryDir??path.join(root,'agent/telemetry');fs.mkdirSync(telemetryDir,{recursive:true});
    telemetryFile=path.join(telemetryDir,`${ctx.sessionManager.getSessionId()}.jsonl`);
    startSupervisor(ctx);
    if(enabled('brain'))recall=await recallBrain('current workspace and prior decisions');
    if(recall.status==='unavailable')ctx.ui.setStatus('brain','Brain: unavailable (offline)');
  });
  async function drain() {
    const children=await supervisor?.shutdown()??[];
    return children.every(child=>child.cleanup_confirmed===true)&&policy.pendingWriterCalls().length===0;
  }
  pi.on('session_before_switch',async event=>{
    if(event.targetSessionFile&&!isWithin(canonicalPath(resolvePrototypePaths().sessions),canonicalPath(event.targetSessionFile)))return{cancel:true};
    if(!await drain())return{cancel:true};
  });
  pi.on('session_before_fork',async()=>({cancel:!await drain()}));
  pi.on('session_before_tree',async()=>({cancel:!await drain()}));
  pi.on('session_tree',(_event,ctx)=>startSupervisor(ctx,true));
  pi.on('session_shutdown',async()=>{await drain();});
  if(!turnsAllowed){
    pi.on('input',(_event,ctx)=>{ctx.ui.notify('LIVE_BUDGET_NOT_CONFIGURED: offline verification only','warning');return{action:'handled'};});
    pi.on('session_before_compact',()=>({cancel:true}));
  }
  return {policy,telemetry,getSupervisor:()=>supervisor,getRecall:()=>recall};
}
