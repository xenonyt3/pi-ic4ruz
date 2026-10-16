import fs from 'node:fs';
import path from 'node:path';
import {root} from './paths.mjs';
import {loadBehaviorCorpus,digest} from './behavior-corpus.mjs';

export function buildBehaviorPlan({comparison='stock-core'}={}) {
  if(!['stock-core','codex'].includes(comparison))throw Error('BEHAVIOR_COMPARISON_INVALID');
  const corpus=loadBehaviorCorpus();
  const conditions=[comparison,'prototype'];
  const perRun={maxRequests:12,maxInputTokens:comparison==='codex'?240000:120000,maxOutputTokens:comparison==='codex'?24000:12000,perRequestMaxOutputTokens:comparison==='codex'?2000:1000,maxDurationMs:300000};
  const jobs=[];
  for(let attempt=1;attempt<=2;attempt++)for(const task of attempt===1?corpus.tasks:[...corpus.tasks].reverse())for(const condition of attempt===1?conditions:[...conditions].reverse())jobs.push({id:`${task.id}-${condition}-${attempt}`,taskId:task.id,condition,attempt});
  const limits=Object.fromEntries(['maxRequests','maxInputTokens','maxOutputTokens','maxDurationMs'].map(key=>[key,perRun[key]*jobs.length]));
  const plan={schemaVersion:1,protocol:corpus.manifest.corpusVersion,corpusHash:corpus.hash,
    model:{provider:'9router',model:'cx/gpt-6-astra',thinkingLevel:'low',contextWindow:32768,api:'openai-completions'},
    conditions,attemptsPerTaskAndCondition:2,perRun,limits,jobs,
    tasks:corpus.tasks.map(task=>({id:task.id,title:task.title,prompt:task.prompt,promptHash:digest(task.prompt),startingTree:task.fileHashes,allowedChanges:task.allowedChanges})),
    common:{brain:false,automaticRetries:false,cacheWarming:false,maxActiveChildren:3,oneWriterPerWorkspace:true,resourceDiscovery:false,transport:'LiveBudgetTransport',ledgerPolicy:'fixed disjoint suballowances; no transfers or reruns'},
    differences:{'stock-core':'Pinned stock SDK with read/bash/edit/write; common budget, telemetry, file policy and owned shell adapters; no harness context/codemode/delegation',prototype:'Selected pinned candidate SDK with current harness context/codemode/delegation; same safety adapters; UI disabled for both'},
    reasonComparison:'not available; no direct Reason parity claim',pricing:'unknown',interpretation:'small exploratory paired comparison; no statistical superiority or parity percentage',
    implementationHashes:Object.fromEntries(['scripts/evaluate-behavior.mjs','src/behavior-corpus.mjs','src/behavior-verifier.mjs','src/behavior-plan.mjs','src/behavior-evaluation.mjs','src/live-interactive.mjs','src/live-budget-transport.mjs','src/child-supervisor.ts','src/harness.ts','prompts/harness.md','config/harness.json','config/child-profiles.json'].map(file=>[file,digest(fs.readFileSync(path.join(root,file)))]))};
  if(comparison==='codex'){
    plan.protocol='codex-pi-v2';
    plan.codex=JSON.parse(fs.readFileSync(path.join(root,'config/codex-benchmark.json'),'utf8'));
    plan.common.delegation=false;
    plan.common.maxActiveChildren=0;
    plan.common.comparisonScope='single-agent task completion; delegation and long-context quality unmeasured';
    plan.differences={codex:'Pinned native Codex exec; native prompts/tools; Responses SSE through shared budget gate; workspace-write sandbox; fresh scoped CODEX_HOME; no plugins/skills/memory/web/delegation',prototype:'Pinned Pi candidate with harness context/codemode; Chat Completions SSE through shared budget gate; owned shell/file policy; no Brain/resource discovery/UI/delegation'};
    plan.transportDifference='Codex Responses versus Pi Chat Completions; endpoint conversion/cache differences at 9router are uncontrolled; not a pure harness causal estimate';
    for(const file of ['src/codex-evaluation.mjs','src/codex-budget-broker.mjs','src/live-network-guard.mjs','src/process-lifecycle.mjs','src/workspace-ownership.ts','scripts/codex-job.ps1','scripts/check-codex-fixture.mjs','tests/helpers/responses-fixture.mjs','config/codex-benchmark.json'])plan.implementationHashes[file]=digest(fs.readFileSync(path.join(root,file)));
  }
  return {...plan,protocolHash:digest(plan),liveAuthorized:false};
}
export function validateBehaviorBudget(approval,plan) {
  if(approval?.schemaVersion!==1||approval.authorized!==true)throw Error('BEHAVIOR_NEW_AUTHORIZATION_REQUIRED');
  if(!/^[a-zA-Z0-9_-]{1,32}$/.test(approval.campaignId??''))throw Error('BEHAVIOR_CAMPAIGN_ID');
  if(approval.protocolHash!==plan.protocolHash)throw Error('BEHAVIOR_PROTOCOL_CHANGED');
  for(const [name,limit]of Object.entries(plan.limits))if(approval[name]!==limit)throw Error('BEHAVIOR_AUTHORIZED_LIMIT_MISMATCH');
  if(Object.keys(approval).some(key=>!['schemaVersion','authorized','campaignId','protocolHash',...Object.keys(plan.limits)].includes(key)))throw Error('BEHAVIOR_AUTHORIZATION_UNKNOWN_FIELD');
  return Object.freeze({...approval});
}
