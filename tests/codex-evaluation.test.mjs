import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {root} from '../src/paths.mjs';
import {LiveBudgetTransport} from '../src/live-budget-transport.mjs';
import {buildBehaviorPlan,validateBehaviorBudget} from '../src/behavior-plan.mjs';
import {codexConfiguration,verifyCodexExecutable} from '../src/codex-evaluation.mjs';
import {responsesFixture} from './helpers/responses-fixture.mjs';

const base=path.join(root,'tests/.tmp');fs.mkdirSync(base,{recursive:true});
const directories=[];
const directory=()=>{const d=fs.mkdtempSync(path.join(base,'codex-test-'));directories.push(d);return d;};
test.after(()=>{for(const d of directories)fs.rmSync(d,{recursive:true,force:true});});
const endpoint='http://127.0.0.1:9/v1/responses';
const budget={...buildBehaviorPlan({comparison:'codex'}).perRun,maxAttempts:1,allowanceId:'fixture',provider:'9router',model:'cx/gpt-6-astra',responseModels:['cx/gpt-6-astra'],thinkingLevel:'low',brainEnabled:false};
const payload={model:budget.model,stream:true,store:false,max_output_tokens:2000,reasoning:{effort:'low'},input:[{role:'user',content:'Synthetic fixture'}]};
const makeGate=(options={})=>new LiveBudgetTransport({budget,endpoint,interactive:true,api:'openai-responses',ledgerPath:path.join(directory(),'ledger.json'),fetchImpl:async()=>responsesFixture(),...options});
async function request(gate,body=payload,kind='parent_or_summary',signal){const call=gate.createCall({kind,signal});try{const r=await call.fetch(endpoint,{method:'POST',body:JSON.stringify(body)});await r.text();}finally{call.finish();}}

test('Codex plan freezes balanced single-agent cells and a fresh budget fingerprint',()=>{
  const plan=buildBehaviorPlan({comparison:'codex'}),original=buildBehaviorPlan();
  assert.deepEqual(plan.conditions,['codex','prototype']);assert.equal(plan.jobs.length,12);assert.equal(plan.common.delegation,false);
  assert.equal(plan.jobs[0].condition,'codex');assert.equal(plan.jobs[6].condition,'prototype');
  assert.deepEqual(plan.limits,{maxRequests:144,maxInputTokens:2880000,maxOutputTokens:288000,maxDurationMs:3600000});
  assert.throws(()=>validateBehaviorBudget({schemaVersion:1,authorized:true,campaignId:'old',protocolHash:original.protocolHash,...original.limits},plan),/PROTOCOL_CHANGED/);
  assert.throws(()=>buildBehaviorPlan({comparison:'other'}),/COMPARISON_INVALID/);
  assert.equal(plan.protocolHash,buildBehaviorPlan({comparison:'codex'}).protocolHash);
});
test('Responses rejects hidden history, wrong model, effort and caps before provider dispatch',async()=>{
  let sends=0;const gate=makeGate({fetchImpl:async()=>{sends++;return responsesFixture();}});
  try{
    for(const change of [{model:'fallback'},{reasoning:{effort:'high'}},{max_output_tokens:2001},{stream:false},{store:true},{previous_response_id:'hidden'},{conversation:'hidden'},{background:true}])await assert.rejects(request(gate,{...payload,...change}),/LIMIT_DENIED/);
    assert.equal(sends,0);assert.equal(gate.state.requests.length,0);
    await request(gate);assert.equal(gate.state.inputTokens,100);assert.equal(gate.state.outputTokens,20);assert.equal(gate.state.requests[0].cacheReadTokens,40);
  }finally{gate.close();}
});
test('Responses physical retries, parent, child and summary consume one persistent allowance',async()=>{
  const file=path.join(directory(),'ledger.json'),b={...budget,maxRequests:3};
  const gate=makeGate({budget:b,ledgerPath:file});
  try{await Promise.all(['parent','child','summary'].map(kind=>request(gate,payload,kind)));assert.equal(gate.state.requests.length,3);}finally{gate.close();}
  const resumed=makeGate({budget:b,ledgerPath:file});
  try{await assert.rejects(request(resumed),/EXHAUSTED/);assert.equal(resumed.state.inputTokens,300);}finally{resumed.close();}
});
test('Responses missing usage, HTTP failure and interrupted streams charge reservation and stop',async()=>{
  for(const fetchImpl of [async()=>responsesFixture({usage:null}),async()=>new Response('failure',{status:500}),async()=>{throw Error('cancelled');}]){
    const gate=makeGate({fetchImpl});
    try{try{await request(gate);}catch{}assert.equal(gate.state.requests[0].status,'usage_unknown');assert.ok(gate.state.inputTokens>=8192);assert.equal(gate.state.outputTokens,2000);await assert.rejects(request(gate),/BUDGET_STOP/);}finally{gate.close();}
  }
});
test('Responses wrong response model stops even when valid usage is attached',async()=>{
  const gate=makeGate({fetchImpl:async()=>responsesFixture({model:'fallback'})});
  try{await assert.rejects(request(gate),/MODEL_MISMATCH/);assert.equal(gate.state.stopReason,'response_model_mismatch');}finally{gate.close();}
});
test('Responses pre-cancel and endpoint changes cannot dispatch; concurrent ledger owner is rejected',async()=>{
  const file=path.join(directory(),'ledger.json'),gate=makeGate({ledgerPath:file});
  try{
    assert.throws(()=>makeGate({ledgerPath:file}),/LEDGER_LOCKED/);
    await assert.rejects(request(gate,payload,'parent',AbortSignal.abort()),/CANCELLED/);
    await assert.rejects(gate.createCall().fetch(endpoint+'/compact',{method:'POST',body:JSON.stringify(payload)}),/ENDPOINT_DENIED/);
    assert.equal(gate.state.requests.length,0);
  }finally{gate.close();}
});
test('Responses requires terminal usage and stops on reservation overshoot',async()=>{
  const gate=makeGate({fetchImpl:async()=>responsesFixture({usage:{input_tokens:100,output_tokens:2001,total_tokens:2101}})});
  try{await request(gate);assert.equal(gate.state.stopReason,'reported_usage_overshoot');}finally{gate.close();}
  const incomplete=makeGate({fetchImpl:async()=>new Response('data: '+JSON.stringify({type:'response.created',response:{model:budget.model,usage:{input_tokens:1,output_tokens:1}}})+'\n\n')});
  try{await request(incomplete);assert.equal(incomplete.state.stopReason,'missing_or_invalid_usage');}finally{incomplete.close();}
});

test('guarded native loopback broker enforces credential, route and output-cap boundaries',async()=>{
  const env={...process.env};delete env.NODE_TEST_CONTEXT;delete env.NODE_OPTIONS;
  const child=spawn(process.execPath,['--test',path.join(root,'tests/helpers/codex-broker-fixture.mjs')],{windowsHide:true,env,stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data);
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
  assert.equal(code,0,output);assert.match(output,/tests 3/);assert.match(output,/pass 3/);
});
test('Codex config disables extra services and real credential inheritance; binary pin fails closed',()=>{
  const config=codexConfiguration({model:budget.model,thinkingLevel:'low',contextWindow:32768},'http://127.0.0.1:12345/v1');
  assert.match(config,/wire_api = "responses"/);assert.match(config,/remote_compaction = "unsupported"/);assert.match(config,/\[agents\]\nenabled = false/);
  assert.match(config,/network_access = false/);assert.match(config,/request_max_retries = 0/);assert.match(config,/include_instructions = false/);
  assert.throws(()=>verifyCodexExecutable(process.execPath),/PIN_MISMATCH/);
  assert.throws(()=>verifyCodexExecutable(path.join(directory(),'missing.exe')),/CODEX_EXECUTABLE_PIN_MISMATCH/);
});
