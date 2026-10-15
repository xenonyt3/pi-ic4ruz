import fs from 'node:fs';
import path from 'node:path';
import { root, canonicalPath, isWithin } from './paths.mjs';
import { LiveBudgetTransport } from './live-budget-transport.mjs';
import { auditBaseline, sha256 } from '../scripts/audit-baseline.mjs';
import { runCandidateVerifier } from './pilot-verifier.mjs';
import { assertOfflineAcceptance, isCleanupConfirmed } from './evaluation-acceptance.mjs';
import { assertIsolation } from '../launch.mjs';

export const initialSource='export function normalizeLabel(value) {\n  return value.toLowerCase().trim();\n}\n';
export const taskPrompt=`Fix src/normalize.mjs: normalizeLabel must accept only primitive strings (throw TypeError otherwise), trim outer whitespace, collapse every run of whitespace into one ASCII space, and lowercase text. Preserve punctuation and Unicode. Inspect the source and edit only src/normalize.mjs. Do not run shell commands or change tests; the runner verifies your work. If agents_spawn is available, first delegate a read-only diagnosis exactly once to code_explorer with model_slot subagent, then collect its result with agents_wait and do the edit yourself. Otherwise inspect directly. Keep tool output and final explanation brief. For codemode use await tools.read({path:"src/normalize.mjs"}). Delegation arguments are agents_spawn({tasks:[{prompt:"Read src/normalize.mjs and briefly diagnose the required normalizeLabel fix. Do not edit anything.",profile:"code_explorer",model_slot:"subagent"}]}), then agents_wait({ids:result.subagent_session_ids,timeout_ms:120000}).`;
const verifier=`import assert from 'node:assert/strict';
import {normalizeLabel} from '../src/normalize.mjs';
for(const [input,expected]of [[' A  B ','a b'],['\\tHello\\nWORLD\\t','hello world'],['',''],['  ',''],[' A-B  C! ','a-b c!'],[' CAFÉ\\u00a0DATA ','café data']])assert.equal(normalizeLabel(input),expected);
for(const input of [null,undefined,12,{},[],new String('A')])assert.throws(()=>normalizeLabel(input),TypeError);
console.log('VERIFIER_PASS: 12 assertions');
`;
function save(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2));}
function cleanError(error,key){return String(error?.message??error).split(key).join('[REDACTED]').replace(/Bearer\s+\S+/gi,'Bearer [REDACTED]').slice(0,1600);}
export async function runLiveEvaluation({budget,fetchImpl=globalThis.fetch,providerSource='D:/pi-clean/agent/models.json',conditions=['A','B','C'],onProgress=console.log}){
  const live = fetchImpl === globalThis.fetch;
  // QuickJS workers inherit execArgv but run files, which cannot use --input-type.
  if(process.execArgv.some(arg=>arg==='--input-type'||arg.startsWith('--input-type=')))throw new Error('LIVE_FILE_ENTRYPOINT_REQUIRED: launch a .mjs file without --input-type');
  if(live)assertIsolation(undefined,path.join(root,'workspace'));
  if(!/^[a-zA-Z0-9_-]+$/.test(budget.campaign))throw new Error('INVALID_CAMPAIGN_ID');
  if(!conditions.length||conditions.some(c=>!['A','B','C'].includes(c))||new Set(conditions).size!==conditions.length)throw new Error('INVALID_CONDITIONS');
  const directory=path.join(root,'artifacts/evaluations',budget.campaign);
  if(fs.existsSync(path.join(directory,'report.json')))throw new Error('CAMPAIGN_REPORT_EXISTS: no automatic rerun');
  if(!auditBaseline().passed)throw new Error('BASELINE_DRIFT');
  const offline=JSON.parse(fs.readFileSync(path.join(root,'artifacts/verification/all-latest.json'),'utf8'));
  // Injected fixtures are themselves building acceptance; the CLI live path cannot bypass it.
  if(live)assertOfflineAcceptance(offline);
  const provider=JSON.parse(fs.readFileSync(providerSource,'utf8')).providers?.[budget.provider];
  if(!provider||provider.api!=='openai-completions')throw new Error('PROVIDER_CONFIG_MISMATCH');
  const base=new URL(provider.baseUrl);
  if(base.hostname!=='localhost'||base.port!=='20128'||base.username||base.password||base.search)throw new Error('PROVIDER_ENDPOINT_MISMATCH');
  const key=process.env[provider.apiKey]??provider.apiKey;
  if(typeof key!=='string'||!key||key.startsWith('!'))throw new Error('PROVIDER_CREDENTIAL_UNAVAILABLE');
  fs.mkdirSync(directory,{recursive:true});
  process.env.PI_CODING_AGENT_DIR=path.join(directory,'control-agent');process.env.PI_CODING_AGENT_SESSION_DIR=path.join(directory,'control-sessions');process.env.PI_OFFLINE='1';
  fs.mkdirSync(process.env.PI_CODING_AGENT_DIR,{recursive:true});
  const {sdk,ai}=await import('./upstream.mjs');
  const {registerHarness}=await import('./harness.ts');
  const {createProcessChildTransport}=await import('./child-supervisor.ts');
  const profileConfig=JSON.parse(fs.readFileSync(path.join(root,'config/child-profiles.json'),'utf8'));
  profileConfig.profiles={code_explorer:profileConfig.profiles.code_explorer};
  for(const slot of Object.keys(profileConfig.modelSlots))profileConfig.modelSlots[slot]={provider:budget.provider,model:budget.model,thinkingLevel:budget.thinkingLevel};
  const gate=new LiveBudgetTransport({budget,endpoint:base.href.replace(/\/$/,'')+'/chat/completions',ledgerPath:path.join(directory,'ledger.json'),fetchImpl});
  const report={campaign:budget.campaign,model:budget.model,provider:budget.provider,thinkingLevel:budget.thinkingLevel,brain:'disabled_by_user',scope:'one task, one attempt per condition; bounded exploratory pilot',conditions:[],startedAt:new Date().toISOString(),pricing:'unknown',live:fetchImpl===globalThis.fetch,transport:fetchImpl===globalThis.fetch?'live':'injected_fixture',offlineReportHash:sha256(JSON.stringify(offline)),taskHash:sha256(taskPrompt),initialSourceHash:sha256(initialSource),verifierHash:sha256(verifier)};
  try{
  save(path.join(directory,'configuration.json'),{...budget,providerEndpoint:base.href,credentialStored:false});
  const runtime=await sdk.ModelRuntime.create({credentials:new ai.InMemoryCredentialStore(),modelsPath:null,modelsStorePath:path.join(directory,'model-store.json'),allowModelNetwork:false,refreshOnCreate:false});
  runtime.registerProvider(budget.provider,{api:provider.api,baseUrl:provider.baseUrl,apiKey:key,models:[{id:budget.model,name:budget.model,reasoning:true,input:['text'],contextWindow:32768,maxTokens:1000,cost:{input:0,output:0,cacheRead:0,cacheWrite:0},compat:{supportsOpenAIGrammarTools:false,supportsReasoningEffort:true,maxTokensField:'max_completion_tokens'}}]});
  const model=runtime.getModel(budget.provider,budget.model);if(!model)throw new Error('MODEL_REGISTRATION_FAILED');
  function eventStream(message){const stream=new ai.AssistantMessageEventStream();stream.push({type:'start',partial:message});stream.push(message.stopReason==='error'||message.stopReason==='aborted'?{type:'error',reason:message.stopReason,error:message}:{type:'done',reason:message.stopReason,message});return stream;}
  async function complete(context,{kind,condition,signal,sessionId}={}){
    gate.assertOpen();const call=gate.createCall({kind,condition,signal});let message;
    try{
      const stream=runtime.streamSimple(model,context,{apiKey:key,signal,maxTokens:1000,reasoning:budget.thinkingLevel,maxRetries:0,timeoutMs:Math.min(120000,gate.remainingMs()),cacheRetention:'none',sessionId,fetch:call.fetch});
      for await(const _event of stream){}
      message=await stream.result();
    }finally{call.finish();}
    if(message?.errorMessage)message.errorMessage=cleanError(message.errorMessage,key);
    if(gate.state.stopReason==='missing_or_invalid_usage'||gate.state.stopReason==='reported_usage_overshoot')throw new Error(`LIVE_ACCOUNTING_STOP: ${gate.state.stopReason}`);
    return message;
  }
    for(const condition of conditions){
      gate.beginAttempt(condition);onProgress(`Live ${condition}: starting ${budget.model}`);
      const work=path.join(directory,condition,'workspace');if(fs.existsSync(work))throw new Error('WORKSPACE_ALREADY_EXISTS');
      fs.mkdirSync(path.join(work,'src'),{recursive:true});fs.mkdirSync(path.join(work,'test'));
      fs.writeFileSync(path.join(work,'src/normalize.mjs'),initialSource);fs.writeFileSync(path.join(work,'test/verify.mjs'),verifier);
      const agentDir=path.join(directory,condition,'agent');fs.mkdirSync(agentDir,{recursive:true});
      const sessionDir=path.join(directory,condition,'sessions');fs.mkdirSync(sessionDir,{recursive:true});
      const config=JSON.parse(fs.readFileSync(path.join(root,'config/harness.json'),'utf8'));
      config.provider=budget.provider;config.model=budget.model;config.features.brain=false;config.features.codemode=condition!=='A';config.features.delegation=condition==='C';
      const childTransport=createProcessChildTransport({runner:path.join(root,'src/child-runner.mjs'),offlineGuard:path.join(root,'src/offline-guard.mjs'),upstreamPath:path.join(root,'src/upstream.mjs'),policyPath:path.join(root,'src/tool-policy.ts'),codemodePath:path.join(root,'src/codemode-policy.ts'),windowsToolsPath:path.join(root,'src/windows-tools.ts'),writerLeasePath:path.join(root,'src/workspace-ownership.ts'),leaseRoot:path.join(directory,'leases'),agentDir:path.join(directory,condition,'children/profiles'),sessionDir:path.join(directory,condition,'children/sessions'),cwd:work,offline:true,
        modelBroker:async(request,{record,signal})=>{
          if(request.model.provider!==budget.provider||request.model.id!==budget.model)throw new Error('CHILD_MODEL_MISMATCH');
          return complete(request.context,{kind:'child',condition,signal,sessionId:record.id});
        }});
      let harness;
      const settingsManager=sdk.SettingsManager.inMemory({packages:[],defaultTools:condition==='A'?['read','bash','edit','write']:['read','bash','edit','write','codemode'],cacheWarming:'off',retry:{enabled:false,maxRetries:0,provider:{maxRetries:0}},compaction:{enabled:true,reserveTokens:16384,keepRecentTokens:20000},enableAnalytics:false,enableInstallTelemetry:false});
      const loader=new sdk.DefaultResourceLoader({cwd:work,agentDir,settingsManager,noExtensions:true,noSkills:true,noPromptTemplates:true,noThemes:true,noContextFiles:true,systemPrompt:'',appendSystemPrompt:[],extensionFactories:[pi=>{
        pi.on('tool_call',event=>{
          if(['bash','powershell'].includes(event.toolName))throw new Error('PILOT_SHELL_DISABLED: runner executes the verifier');
          if(['edit','write'].includes(event.toolName)&&canonicalPath(path.resolve(work,event.input.path))!==canonicalPath(path.join(work,'src/normalize.mjs')))throw new Error('PILOT_WRITE_TARGET_DENIED');
        });
        harness=registerHarness(pi,{cwd:work,config,liveEvaluation:gate,childProfiles:profileConfig,childTransport,registryDir:path.join(directory,condition,'receipts'),leaseRoot:path.join(directory,'leases'),telemetryDir:path.join(directory,condition,'telemetry')});
      }]});
      await loader.reload();if(loader.getExtensions().errors.length)throw new Error('LIVE_EXTENSION_LOAD_FAILED');
      const {session}=await sdk.createAgentSession({cwd:work,agentDir,modelRuntime:runtime,model,thinkingLevel:budget.thinkingLevel,settingsManager,resourceLoader:loader,sessionManager:sdk.SessionManager.create(work,sessionDir)});
      await session.bindExtensions({mode:'rpc',onError:error=>{onProgress(`Extension event: ${error.event??'unknown'}`);}});
      session.agent.streamFunction=async(requestModel,context,options)=>{
        if(requestModel.provider!==budget.provider||requestModel.id!==budget.model)throw new Error('PARENT_MODEL_MISMATCH');
        return eventStream(await complete(context,{kind:options.sessionId===session.sessionId?'parent':'parent_or_summary',condition,signal:options.signal,sessionId:options.sessionId}));
      };
      const abort=()=>{void session.abort();void harness.getSupervisor().shutdown();};gate.abortController.signal.addEventListener('abort',abort,{once:true});
      const started=Date.now();let error,cleanupError,shutdownResults;
      try{await session.prompt(taskPrompt);}catch(cause){error=cleanError(cause,key);}
      finally{
        try{await session.abort();}catch(cause){cleanupError=cleanError(cause,key);}
        try{shutdownResults=await harness.getSupervisor().shutdown();}catch(cause){cleanupError=cleanError(cause,key);}
        gate.abortController.signal.removeEventListener('abort',abort);session.dispose();
      }
      const verify=runCandidateVerifier(path.join(work,'src/normalize.mjs'),{agentDir});
      const children=harness.getSupervisor().list();
      const cleanupConfirmed=isCleanupConfirmed({shutdownResults,children,activeCount:harness.getSupervisor().activeCount(),pendingWriterCalls:harness.policy.pendingWriterCalls(),writerLeasePresent:!!harness.policy.getExistingLease(),error:cleanupError});
      if(!cleanupConfirmed)gate.stop('cleanup_unconfirmed');
      const testUnchanged=sha256(fs.readFileSync(path.join(work,'test/verify.mjs')))==report.verifierHash;
      const modelStopReason=session.messages.filter(message=>message.role==='assistant').at(-1)?.stopReason??'no_response';
      const result={condition,correct:verify.passed&&testUnchanged,cleanupConfirmed,cleanupError:cleanupError??null,shutdownResults,modelStopReason,verifierExit:verify.status,verifierReceipt:verify.receipt,verifierOutput:cleanError(verify.output,key),testUnchanged,error:error??null,durationMs:Date.now()-started,childCount:children.length,childStatuses:children.map(child=>({id:child.id,status:child.status,cleanupConfirmed:child.cleanupConfirmed})),delegationExercised:condition!=='C'||children.some(child=>child.status==='completed'),finalSourceHash:sha256(fs.readFileSync(path.join(work,'src/normalize.mjs'))),sessionFile:session.sessionFile};
      report.conditions.push(result);save(path.join(directory,'report.json'),report);onProgress(`Live ${condition}: verifier ${result.correct?'PASS':'FAIL'}; requests ${gate.state.requests.length}/${budget.maxRequests}`);
      if(!gate.allowsModelTurns())break;
    }
  }catch(error){report.error=cleanError(error,key);}
  finally{gate.close();report.finishedAt=new Date().toISOString();report.usage={requests:gate.state.requests.length,inputTokens:gate.state.inputTokens,outputTokens:gate.state.outputTokens,cost:null,source:'raw provider SSE usage; unknown charged at reservation'};report.budgetStatus=gate.state.status;report.stopReason=gate.state.stopReason??null;report.baseline=auditBaseline();report.passed=report.conditions.length===conditions.length&&report.conditions.every(result=>result.correct&&result.cleanupConfirmed&&result.delegationExercised&&result.modelStopReason==='stop'&&!result.error)&&!report.error&&!report.stopReason&&report.baseline.passed;save(path.join(directory,'report.json'),report);}
  return{directory,report};
}
