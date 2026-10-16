import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {root} from '../src/paths.mjs';
import {loadBehaviorCorpus} from '../src/behavior-corpus.mjs';
import {buildBehaviorPlan,validateBehaviorBudget} from '../src/behavior-plan.mjs';
import {runBehaviorCampaign} from '../src/behavior-evaluation.mjs';
import {liveConfig,sse} from './helpers/live-fixture.mjs';
import {validateLiveConfig} from '../src/live-config.mjs';
import {createLiveRuntime} from '../src/live-interactive.mjs';

const config={...structuredClone(liveConfig),provider:'9router',model:'cx/gpt-6-astra',models:['cx/gpt-6-astra'],responseModels:['cx/gpt-6-astra'],thinkingLevel:'low'};
const env={PI_LIVE_TEST_KEY:'behavior-fixture-key'};
const approval=()=>({schemaVersion:1,authorized:true,campaignId:'test-'+randomUUID().slice(0,12),protocolHash:buildBehaviorPlan().protocolHash,...buildBehaviorPlan().limits});
const directories=[];
test.after(()=>{for(const directory of directories)fs.rmSync(directory,{recursive:true,force:true});});
test('behavior plan freezes a balanced 12-run goal-only comparison and exact disjoint quota totals',()=>{
  const plan=buildBehaviorPlan();assert.equal(plan.jobs.length,12);assert.equal(plan.protocolHash,buildBehaviorPlan().protocolHash);
  assert.deepEqual(plan.limits,{maxRequests:144,maxInputTokens:1440000,maxOutputTokens:144000,maxDurationMs:3600000});
  for(const task of plan.tasks){
    assert.doesNotMatch(task.prompt,/codemode|agents_spawn|code_explorer|delegate|spawn/i);
    for(const condition of plan.conditions)assert.equal(plan.jobs.filter(job=>job.taskId===task.id&&job.condition===condition).length,2);
  }
  assert.equal(plan.jobs[0].condition,'stock-core');assert.equal(plan.jobs[6].condition,'prototype');
  assert.equal(plan.liveAuthorized,false);assert.match(plan.reasonComparison,/no direct Reason parity/);
});
test('behavior authorization rejects missing consent, old protocol, changed caps and old smoke budget',()=>{
  const plan=buildBehaviorPlan(),valid=approval();assert.doesNotThrow(()=>validateBehaviorBudget(valid,plan));
  for(const a of [undefined,{...valid,authorized:false},{...valid,protocolHash:'old'},{...valid,maxRequests:6},{...valid,apiKey:'secret'}])assert.throws(()=>validateBehaviorBudget(a,plan),/BEHAVIOR_/);
});
test('behavior CLI dry-run cannot infer and live without new approval fails before SDK launch',()=>{
  const command=path.join(root,'scripts/evaluate-behavior.mjs'),guard=pathToFileURL(path.join(root,'src/offline-guard.mjs')).href;
  const dry=spawnSync(process.execPath,['--import',guard,command,'--dry-run'],{encoding:'utf8',windowsHide:true,timeout:15000});
  assert.equal(dry.status,0,dry.stderr);assert.equal(JSON.parse(dry.stdout).liveAuthorized,false);
  const missing=spawnSync(process.execPath,['--import',guard,command,'--live'],{encoding:'utf8',windowsHide:true,timeout:15000});
  assert.equal(missing.status,1);assert.match(missing.stderr,/PRIVATE_CONFIG_REQUIRED/);
});
test('both actual SDK conditions execute all 12 scripted cases, preserve quotas and retain review unknowns', {timeout:120000},async()=>{
  const a=approval(),tasks=loadBehaviorCorpus().tasks;let current,queue,calls=0;
  const result=await runBehaviorCampaign({config,approval:a,env,onProgress:event=>{
    if(event.phase!=='start')return;
    current=buildBehaviorPlan().jobs.find(job=>job.id===event.job);const task=tasks.find(task=>task.id===current.taskId);
    const testFile={invoice:'invoice',investigation:'examples',recovery:'cache'}[task.id];
    // Node's test-worker marker otherwise makes a nested --test exit 0 without running files.
    const command=`env -u NODE_TEST_CONTEXT node --test test/${testFile}.test.mjs`;
    queue=[...(task.id==='recovery'?[{name:'bash',args:{command}}]:[]),
      ...Object.entries(task.referenceChanges).map(([file,content])=>({name:'write',args:{path:file,content}})),
      {name:'bash',args:{command}}];
  },fetchImpl:async(_url,init)=>{
    calls++;const payload=JSON.parse(init.body);assert.equal(payload.model,config.model);assert.equal(payload.reasoning_effort,'low');
    const names=payload.tools.map(tool=>tool.function?.name??tool.name);
    assert.equal(names.includes('codemode'),current.condition==='prototype');
    const tool=queue.shift();return sse({model:config.model,...(tool?{tool}:{text:'Completed the task and ran the visible tests.'})});
  }});
  directories.push(result.directory,path.join(root,'artifacts/evaluations/behavior',a.campaignId));
  assert.equal(result.state.status,'finished',JSON.stringify(result.state));assert.equal(result.state.allTasksCorrect,true,JSON.stringify(result.state));
  assert.equal(result.state.jobs.length,12);assert.equal(result.state.usage.requests,calls);assert.equal(result.state.usage.inputTokens,calls*20);
  assert.equal(result.state.humanReviewComplete,false);
  for(const job of result.state.jobs){
    assert.equal(job.cleanupConfirmed,true);assert.equal(job.humanReview.strategy,null);assert.equal(job.childCount,0);
    assert.equal(job.activeTools.includes('codemode'),job.condition==='prototype');
    assert.equal(job.callableTools.includes('agents_spawn'),job.condition==='prototype');
    assert.equal(job.toolErrors,job.taskId==='recovery'?1:0,JSON.stringify({job:job.id,toolCalls:job.toolCalls,toolErrors:job.toolErrors}));
    assert.ok(!fs.existsSync(path.join(result.directory,job.id,'ledger.json.lock')));
  }
  const before=calls;
  await assert.rejects(runBehaviorCampaign({config,approval:a,env,fetchImpl:async()=>{calls++;return sse();}}),/CAMPAIGN_EXISTS/);
  assert.equal(calls,before);
});
test('missing usage stops the campaign before other preallocated cells can dispatch',async()=>{
  const a=approval();let calls=0;
  const result=await runBehaviorCampaign({config,approval:a,env,fetchImpl:async()=>{calls++;return sse({model:config.model,usage:null});}});
  directories.push(result.directory,path.join(root,'artifacts/evaluations/behavior',a.campaignId));
  assert.equal(calls,1);assert.equal(result.state.status,'stopped');assert.equal(result.state.stopReason,'missing_or_invalid_usage');
  assert.equal(result.state.jobs.filter(job=>job.status==='pending').length,11);
  assert.equal(result.state.usage.outputTokens,1000);
});
test('a cell request cap stops the campaign without borrowing another cell allowance',async()=>{
  const a=approval();let calls=0;
  const result=await runBehaviorCampaign({config,approval:a,env,fetchImpl:async()=>{calls++;return sse({model:config.model,tool:{name:'read',args:{path:'CONTRACT.md'}}});}});
  directories.push(result.directory,path.join(root,'artifacts/evaluations/behavior',a.campaignId));
  assert.equal(calls,12);assert.equal(result.state.usage.requests,12);assert.equal(result.state.stopReason,'capacity');
  assert.equal(result.state.jobs.filter(job=>job.status==='pending').length,11);
});
test('cancelled campaign and wrong model perform no model request',async()=>{
  const a=approval();let calls=0;
  await assert.rejects(runBehaviorCampaign({config:{...config,model:'wrong'},approval:a,env,fetchImpl:async()=>{calls++;}}),/MODEL_CONFIGURATION_MISMATCH/);
  const controller=new AbortController();controller.abort();
  const result=await runBehaviorCampaign({config,approval:a,env,signal:controller.signal,fetchImpl:async()=>{calls++;}});
  directories.push(result.directory);
  assert.equal(calls,0);assert.equal(result.state.stopReason,'campaign_cancelled');
});
test('cancellation during SDK setup prevents the first dispatch',async()=>{
  const a=approval(),controller=new AbortController();let calls=0;
  const result=await runBehaviorCampaign({config,approval:a,env,signal:controller.signal,onProgress:event=>{if(event.phase==='start')controller.abort();},fetchImpl:async()=>{calls++;return sse();}});
  directories.push(result.directory,path.join(root,'artifacts/evaluations/behavior',a.campaignId));
  assert.equal(calls,0);assert.equal(result.state.stopReason,'campaign_cancelled');assert.equal(result.state.jobs[0].cleanupConfirmed,true);
});
test('stock condition uses the pinned stock SDK without changing the runtime selector',async()=>{
  const {sdk}=await import('../runtime/exports.mjs');
  const selector=fs.readFileSync(path.join(root,'config/runtime-selection.json'),'utf8');
  const base=path.join(root,'tests/.tmp');fs.mkdirSync(base,{recursive:true});const directory=fs.mkdtempSync(path.join(base,'stock-condition-'));
  const workspace=path.join(directory,'workspace');fs.mkdirSync(workspace);directories.push(directory);
  const resolved=validateLiveConfig(config,{env,cwd:workspace});
  const live=await createLiveRuntime({...resolved,directory:path.join(directory,'control'),options:{evaluationCondition:'stock-core',headlessEvaluation:true},fetchImpl:async()=>sse()});
  try{assert.ok(live.host.services.modelRuntime instanceof sdk.ModelRuntime);assert.equal(fs.readFileSync(path.join(root,'config/runtime-selection.json'),'utf8'),selector);}
  finally{await live.close();}
});
