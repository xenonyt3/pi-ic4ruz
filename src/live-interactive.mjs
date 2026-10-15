import fs from 'node:fs';
import path from 'node:path';
import { LiveBudgetTransport } from './live-budget-transport.mjs';
import { root, canonicalPath, isWithin } from './paths.mjs';

export async function createLiveRuntime({config,budget,key,workspace,endpoint,options={},fetchImpl=globalThis.fetch,directory}) {
  const {sdk,ai}=await import('./upstream.mjs');
  const {registerHarness}=await import('./harness.ts');
  const {createProcessChildTransport}=await import('./child-supervisor.ts');
  const {createOwnedShellOperations}=await import('./windows-tools.ts');
  directory??=path.join(root,'agent/live-private',budget.allowanceId);
  const sessions=path.join(directory,'sessions'),agentDir=path.join(directory,'control'),ledger=path.join(directory,'ledger.json');
  if(!fs.existsSync(ledger)&&fs.existsSync(sessions)&&fs.readdirSync(sessions).length)throw new Error('LIVE_LEDGER_MISSING: restore accounting before resume');
  fs.mkdirSync(sessions,{recursive:true});fs.mkdirSync(agentDir,{recursive:true});
  let context,host,harness;
  const status=()=>`LIVE ${config.provider}/${config.model} | ${gate.state.requests.length}/${budget.maxRequests} requests | ${gate.state.inputTokens}/${budget.maxInputTokens} input | ${gate.state.outputTokens}/${budget.maxOutputTokens} output | ${gate.state.stopReason??gate.state.status} | cost unknown; Brain disabled`;
  const gate=new LiveBudgetTransport({budget,endpoint,ledgerPath:ledger,interactive:true,fetchImpl:async(url,init)=>{
    const headers=new Headers(init.headers);headers.set('Authorization',`Bearer ${key}`);
    try{return await fetchImpl(url,{...init,headers});}catch{throw new Error('LIVE_TRANSPORT_FAILED');}
  },onChange:()=>context?.ui.setStatus('live',status())});
  gate.abortController.signal.addEventListener('abort',()=>{void host?.session.abort().catch(()=>{});},{once:true});
  try {
    gate.assertOpen();
    const runtime=await sdk.ModelRuntime.create({credentials:new ai.InMemoryCredentialStore(),modelsPath:null,modelsStorePath:path.join(agentDir,'models-store.json'),allowModelNetwork:false,refreshOnCreate:false});
    runtime.registerProvider(config.provider,{api:config.api,baseUrl:config.baseUrl,apiKey:'broker-owned-credential',models:[{
      id:config.model,name:config.model,reasoning:config.thinkingLevel!=='off',input:['text'],contextWindow:config.contextWindow,maxTokens:budget.perRequestMaxOutputTokens,
      cost:{input:0,output:0,cacheRead:0,cacheWrite:0},compat:{supportsOpenAIGrammarTools:false,supportsReasoningEffort:config.thinkingLevel!=='off',supportsUsageInStreaming:true,maxTokensField:'max_completion_tokens'}
    }]});
    const model=runtime.getModel(config.provider,config.model);if(!model)throw new Error('LIVE_MODEL_REGISTRATION_FAILED');
    const underlying=runtime.streamSimple.bind(runtime);
    runtime.getModel=(provider,id)=>provider===model.provider&&id===model.id?model:undefined;
    runtime.getAvailable=async()=>[model];runtime.getAvailableSnapshot=()=>[model];
    runtime.getAllModels=()=>[model];runtime.getAllAvailable=async()=>[model];
    runtime.getAvailableOfType=async type=>type==='chat'?[model]:[];
    const denied=()=>{throw new Error('LIVE_UNBROKERED_MODEL_DENIED');};
    runtime.stream=runtime.streamDeferred=runtime.fetchDeferred=denied;
    function stream(requestModel,transcript,requestOptions={},kind='parent_or_summary') {
      const output=new ai.AssistantMessageEventStream();
      const failure=(reason)=>({role:'assistant',content:[],api:model.api,provider:model.provider,model:model.id,
        usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},
        stopReason:requestOptions.signal?.aborted?'aborted':'error',errorMessage:reason,timestamp:Date.now()});
      void (async()=>{
        let call;
        try{
          if(requestModel.provider!==model.provider||requestModel.id!==model.id)throw new Error('LIVE_MODEL_MISMATCH');
          gate.assertOpen();
          call=gate.createCall({kind,condition:budget.allowanceId,signal:requestOptions.signal});
          const source=underlying(model,transcript,{apiKey:'broker-owned-credential',signal:requestOptions.signal,
            maxTokens:budget.perRequestMaxOutputTokens,reasoning:config.thinkingLevel==='off'?undefined:config.thinkingLevel,
            maxRetries:0,timeoutMs:Math.min(120000,gate.remainingMs()),cacheRetention:'none',fetch:call.fetch});
          for await(const event of source){
            if(event.type==='done'||event.type==='error'){
              call.finish();
              if(event.type==='error'||gate.state.status==='stopped'){
                const message=failure(`LIVE_REQUEST_FAILED: ${gate.state.stopReason??'provider_error'}; inspect local ledger`);
                output.push({type:'error',reason:message.stopReason,error:message});
              }else output.push(event);
            }else output.push(event);
          }
        }catch(error){
          const code=String(error?.message??'').match(/\bLIVE_[A-Z_]+\b/)?.[0]??'LIVE_REQUEST_FAILED';
          const message=failure(`${code}: ${gate.state.stopReason??'request rejected'}`);
          output.push({type:'error',reason:message.stopReason,error:message});
        }finally{call?.finish();}
      })();
      return output;
    }
    runtime.streamSimple=stream;
    const profiles=JSON.parse(fs.readFileSync(path.join(root,'config/child-profiles.json'),'utf8'));
    for(const slot of Object.keys(profiles.modelSlots))profiles.modelSlots[slot]={provider:model.provider,model:model.id,thinkingLevel:config.thinkingLevel};
    const leaseRoot=path.join(root,'agent/writer-leases');
    const childTransport=createProcessChildTransport({runner:path.join(root,'src/child-runner.mjs'),offlineGuard:path.join(root,'src/offline-guard.mjs'),upstreamPath:path.join(root,'src/upstream.mjs'),
      policyPath:path.join(root,'src/tool-policy.ts'),codemodePath:path.join(root,'src/codemode-policy.ts'),windowsToolsPath:path.join(root,'src/windows-tools.ts'),writerLeasePath:path.join(root,'src/workspace-ownership.ts'),
      leaseRoot,agentDir:path.join(directory,'children/profiles'),sessionDir:path.join(directory,'children/sessions'),cwd:workspace,offline:true,
      modelBroker:async(request,{signal})=>stream(request.model,request.context,{signal},'child').result()});
    const factory=async({cwd,sessionManager,sessionStartEvent})=>{
      const userShellCalls=new Set();
      if(canonicalPath(cwd)!==workspace)throw new Error('LIVE_WORKSPACE_CHANGED');
      const binding=sessionManager.getEntries().find(e=>e.type==='custom'&&e.customType==='live_allowance');
      const hasMessages=sessionManager.getEntries().some(e=>e.type==='message');
      if((hasMessages&&!binding)||(binding&&binding.data.fingerprint!==gate.state.fingerprint))throw new Error('LIVE_SESSION_ALLOWANCE_MISMATCH');
      const recorded=sessionManager.getEntries().filter(e=>e.type==='model_change').at(-1);
      if(recorded&&(recorded.provider!==model.provider||recorded.modelId!==model.id))throw new Error('LIVE_SESSION_MODEL_MISMATCH');
      if(!binding)sessionManager.appendCustomEntry('live_allowance',{allowanceId:budget.allowanceId,fingerprint:gate.state.fingerprint});
      const harnessConfig=JSON.parse(fs.readFileSync(path.join(root,'config/harness.json'),'utf8'));
      harnessConfig.features.brain=false;harnessConfig.provider=model.provider;harnessConfig.model=model.id;
      const settingsManager=sdk.SettingsManager.inMemory({packages:[],defaultTools:['read','bash','edit','write','codemode'],hideThinkingBlock:true,cacheWarming:'off',retry:{enabled:false,maxRetries:0,provider:{maxRetries:0}},
        compaction:{enabled:true,reserveTokens:Math.min(16384,Math.floor(config.contextWindow/4)),keepRecentTokens:Math.min(20000,Math.floor(config.contextWindow/4))},enableAnalytics:false,enableInstallTelemetry:false});
      const services=await sdk.createAgentSessionServices({cwd:workspace,agentDir,settingsManager,modelRuntime:runtime,resourceLoaderOptions:{
        noExtensions:true,noSkills:true,noPromptTemplates:true,noThemes:true,noContextFiles:true,systemPromptOverride:()=>'',appendSystemPromptOverride:()=>[],extensionFactories:[pi=>{
          harness=registerHarness(pi,{cwd:workspace,config:harnessConfig,liveEvaluation:gate,childProfiles:profiles,childTransport,leaseRoot,
            sessionRoot:sessions,registryDir:path.join(directory,'receipts',sessionManager.getSessionId()),telemetryDir:path.join(directory,'telemetry')});
          const sessionHarness=harness;
          const shell=createOwnedShellOperations({workspace,owner:`parent-${process.pid}`,leaseRoot,shell:'bash',getExistingLease:sessionHarness.policy.getExistingLease});
          pi.on('user_bash',()=>({operations:{exec(...args){
            const pending=shell.exec(...args).catch(error=>{if(error.code==='CLEANUP_UNCONFIRMED')gate.stop('cleanup_unconfirmed');throw error;});
            userShellCalls.add(pending);
            pending.then(()=>userShellCalls.delete(pending),()=>userShellCalls.delete(pending));
            return pending;
          }}}));
          pi.on('session_start',(_event,ctx)=>{context=ctx;ctx.ui.setStatus('live',status());ctx.ui.setStatus('brain','Brain: disabled');});
          pi.on('input',(_event,ctx)=>{try{gate.assertOpen();}catch{ctx.ui.notify(status(),'warning');return{action:'handled'};}});
          pi.on('session_before_switch',event=>{
            if(event.targetSessionFile&&!isWithin(canonicalPath(sessions),canonicalPath(event.targetSessionFile)))return{cancel:true};
          });
          pi.on('session_shutdown',()=>{
            if(sessionHarness.policy.pendingWriterCalls().length||sessionHarness.getSupervisor()?.list().some(child=>!child.cleanupConfirmed))gate.stop('cleanup_unconfirmed');
            context=undefined;
          });
          pi.registerCommand('live-status',{description:'Show shared persistent allowance and model',handler:async(_args,ctx)=>ctx.ui.notify(status(),'info')});
        }]}});
      if(services.resourceLoader.getExtensions().errors.length)throw new Error('LIVE_EXTENSION_LOAD_FAILED');
      const created=await sdk.createAgentSessionFromServices({services,sessionManager,sessionStartEvent,model,thinkingLevel:config.thinkingLevel});
      if(created.modelFallbackMessage||created.session.model?.id!==model.id||created.session.thinkingLevel!==config.thinkingLevel)throw new Error('LIVE_MODEL_OR_THINKING_FALLBACK_DENIED');
      created.session.agent.streamFunction=stream;
      created.session.getAvailableThinkingLevels=()=>[config.thinkingLevel];
      const setModel=created.session.setModel.bind(created.session);
      created.session.setModel=async requested=>{
        if(requested.provider!==model.provider||requested.id!==model.id)throw new Error('LIVE_MODEL_PINNED: restart with a new explicit configuration');
        return setModel(model);
      };
      // Pi's abort applies to the parent; extend it to owned delegated work too.
      const abort=created.session.abort.bind(created.session),ownedHarness=harness;
      const executeBash=created.session.executeBash.bind(created.session);
      created.session.executeBash=(...args)=>{
        const pending=executeBash(...args);
        userShellCalls.add(pending);
        pending.then(()=>userShellCalls.delete(pending),()=>userShellCalls.delete(pending));
        return pending;
      };
      let aborting;
      created.session.abort=()=>aborting??=(async()=>{
        created.session.abortBash();
        await abort();
        // SDK dispose aborts user-shell jobs but does not await their process cleanup.
        await Promise.allSettled([...userShellCalls]);
        const children=ownedHarness.getSupervisor()?.list()??[];
        await Promise.all(children.filter(c=>!c.cleanupConfirmed).map(c=>ownedHarness.getSupervisor().cancel(c.id)));
      })().finally(()=>{aborting=undefined;});
      return {...created,services,diagnostics:[]};
    };
    let manager;
    if(options.session){
      const file=canonicalPath(options.session);
      if(!isWithin(canonicalPath(sessions),file)||!file.endsWith('.jsonl'))throw new Error('LIVE_FOREIGN_SESSION');
      manager=sdk.SessionManager.open(file,sessions,workspace);
    }else if(options.continue){
      manager=sdk.SessionManager.continueRecent(workspace,sessions);
    }else manager=sdk.SessionManager.create(workspace,sessions);
    host=await sdk.createAgentSessionRuntime(factory,{cwd:workspace,agentDir,sessionManager:manager});
    const dispose=host.dispose.bind(host);let disposing;
    host.dispose=()=>disposing??=(async()=>{await host.session.abort();await dispose();})();
    return {host,gate,status,getHarness:()=>harness,async close(){try{await host.dispose();}finally{gate.close();}}};
  }catch(error){try{await host?.dispose();}finally{gate.close();}throw error;}
}
