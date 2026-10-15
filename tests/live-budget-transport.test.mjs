import {pilotBudget} from './helpers/live-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {LiveBudgetTransport} from '../src/live-budget-transport.mjs';import{root}from'../src/paths.mjs';
const base=path.join(root,'tests/.tmp');fs.mkdirSync(base,{recursive:true});
const budget=pilotBudget;
const endpoint='http://127.0.0.1:20128/v1/chat/completions';
const payload={model:budget.model,stream:true,stream_options:{include_usage:true},max_completion_tokens:1000,reasoning_effort:'low',messages:[]};
async function request(gate,body=payload){const call=gate.createCall();try{const r=await call.fetch(endpoint,{method:'POST',body:JSON.stringify(body)});await r.text();return call;}finally{call.finish();}}
test('live budget denies wrong endpoint/model/cap before sending; raw usage includes cached input',async()=>{
  let sends=0;const dir=fs.mkdtempSync(path.join(base,'budget-'));const gate=new LiveBudgetTransport({budget,endpoint,ledgerPath:path.join(dir,'ledger.json'),fetchImpl:async(_url,init)=>{sends++;assert.equal(init.redirect,'error');return new Response('data: {"choices":[],"usage":{"prompt_tokens":20,"completion_tokens":4,"prompt_tokens_details":{"cached_tokens":10}}}\n\ndata: [DONE]\n\n');}});
  try{
    await assert.rejects(request(gate,{...payload,model:'other'}),/LIMIT_DENIED/);await assert.rejects(request(gate,{...payload,max_completion_tokens:1001}),/LIMIT_DENIED/);
    await assert.rejects(gate.createCall().fetch('http://elsewhere.invalid',{method:'POST',body:JSON.stringify(payload)}),/ENDPOINT_DENIED/);assert.equal(sends,0);
    await request(gate);assert.equal(gate.state.inputTokens,20);assert.equal(gate.state.outputTokens,4);assert.equal(gate.state.requests[0].cacheReadTokens,10);
  }finally{gate.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('live budget consumes failed/unknown attempt and cannot be reset by restart',async()=>{
  const dir=fs.mkdtempSync(path.join(base,'budget-'));const file=path.join(dir,'ledger.json');const gate=new LiveBudgetTransport({budget,endpoint,ledgerPath:file,fetchImpl:async()=>new Response('data: [DONE]\n\n')});
  await request(gate);assert.equal(gate.state.requests[0].status,'usage_unknown');await assert.rejects(request(gate),/BUDGET_STOP/);gate.close();
  assert.throws(()=>new LiveBudgetTransport({budget,endpoint,ledgerPath:file}),/ALREADY_USED/);fs.rmSync(dir,{recursive:true,force:true});
});
test('live concurrent parent/child permits share physical attempt cap',async()=>{
  const dir=fs.mkdtempSync(path.join(base,'budget-'));const gate=new LiveBudgetTransport({budget:{...budget,maxRequests:2},endpoint,ledgerPath:path.join(dir,'ledger.json'),fetchImpl:async()=>new Response('data: {"usage":{"prompt_tokens":1,"completion_tokens":1}}\n\n')});
  try{await Promise.all([request(gate),request(gate)]);await assert.rejects(request(gate),/EXHAUSTED/);assert.equal(gate.state.requests.length,2);}finally{gate.close();fs.rmSync(dir,{recursive:true,force:true});}
});
