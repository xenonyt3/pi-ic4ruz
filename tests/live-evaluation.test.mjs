import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import{randomUUID}from'node:crypto';
import{root}from'../src/paths.mjs';import{runLiveEvaluation}from'../src/live-evaluation.mjs';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

test('file-worker-incompatible launch flags fail before acceptance, credentials or model requests',()=>{
  const source=`import {runLiveEvaluation} from ${JSON.stringify(pathToFileURL(path.join(root,'src/live-evaluation.mjs')).href)}; await runLiveEvaluation({budget:{}});`;
  const result=spawnSync(process.execPath,['--input-type=module','-e',source],{encoding:'utf8',windowsHide:true,timeout:15000});
  assert.equal(result.status,1);
  assert.match(result.stderr,/LIVE_FILE_ENTRYPOINT_REQUIRED/);
});
test('live pilot driver uses real SDK with injected provider, runs verifier, and charges three calls', {timeout:60000},async()=>{
  const budget={...JSON.parse(fs.readFileSync(path.join(root,'config/evaluation-astra.json'),'utf8')),campaign:'test-live-'+randomUUID()};let calls=0;
  const fixed="export function normalizeLabel(value) {\n  if (typeof value !== 'string') throw new TypeError('string required');\n  return value.trim().replace(/\\s+/gu, ' ').toLowerCase();\n}\n";
  const fetchImpl=async(url,init={})=>{
    assert.match(String(url),/\/chat\/completions$/);
    calls++;const body=JSON.parse(init.body);assert.equal(body.model,budget.model);assert.equal(body.reasoning_effort,'low');assert.equal(body.max_completion_tokens,1000);
    let delta,finish;
    if(calls<3){delta={tool_calls:[{index:0,id:'call-'+calls,type:'function',function:{name:calls===1?'read':'write',arguments:JSON.stringify(calls===1?{path:'src/normalize.mjs'}:{path:'src/normalize.mjs',content:fixed})}}]};finish='tool_calls';}
    else{delta={content:'Fixed normalization.'};finish='stop';}
    return new Response(`data: ${JSON.stringify({id:'fixture-'+calls,model:budget.model,choices:[{index:0,delta,finish_reason:finish}],usage:{prompt_tokens:20,completion_tokens:10,total_tokens:30}})}\n\ndata: [DONE]\n\n`,{headers:{'content-type':'text/event-stream'}});
  };
  const result=await runLiveEvaluation({budget,fetchImpl,conditions:['A'],onProgress:()=>{}});
  assert.equal(calls,3,JSON.stringify(result.report));assert.equal(result.report.passed,true,JSON.stringify(result.report));assert.equal(result.report.usage.requests,3);assert.equal(result.report.usage.inputTokens,60);assert.equal(result.report.usage.outputTokens,30);assert.equal(result.report.brain,'disabled_by_user');
});
test('pilot rejects an early-exit candidate even when the model reports completion', {timeout:60000},async()=>{
  const budget={...JSON.parse(fs.readFileSync(path.join(root,'config/evaluation-astra.json'),'utf8')),campaign:'test-live-early-exit-'+randomUUID()};let calls=0;
  const fetchImpl=async()=>{
    calls++;
    const delta=calls===1?{tool_calls:[{index:0,id:'write-exit',type:'function',function:{name:'write',arguments:JSON.stringify({path:'src/normalize.mjs',content:'export function normalizeLabel(){process.exit(0)}'})}}]}:{content:'Done'};
    return new Response(`data: ${JSON.stringify({choices:[{index:0,delta,finish_reason:calls===1?'tool_calls':'stop'}],usage:{prompt_tokens:20,completion_tokens:10}})}\n\ndata: [DONE]\n\n`,{headers:{'content-type':'text/event-stream'}});
  };
  const {report}=await runLiveEvaluation({budget,fetchImpl,conditions:['A'],onProgress:()=>{}});
  assert.equal(calls,2);assert.equal(report.passed,false);assert.equal(report.conditions[0].correct,false);assert.equal(report.conditions[0].cleanupConfirmed,true);assert.equal(report.conditions[0].verifierReceipt.passed,0);
});

test('condition C discovers deferred delegation and completes a brokered child before editing', {timeout:60000},async()=>{
  const budget={...JSON.parse(fs.readFileSync(path.join(root,'config/evaluation-astra.json'),'utf8')),campaign:'test-live-delegation-'+randomUUID()};let calls=0;
  const fixed="export function normalizeLabel(value) { if (typeof value !== 'string') throw new TypeError('string required'); return value.trim().replace(/\\s+/gu, ' ').toLowerCase(); }";
  const fetchImpl=async(_url,init)=>{
    calls++;const body=JSON.parse(init.body);
    let name,args,content;
    if(calls===1){name='codemode';args={code:"text(await searchTools('agents_spawn', {limit:5}));"};}
    else if(calls===2){
      const toolResults=body.messages.filter(message=>message.role==='tool');
      assert.match(JSON.stringify(toolResults),/agents_spawn/);
      name='codemode';args={code:"const result=await tools.agents_spawn({tasks:[{prompt:'Read src/normalize.mjs and diagnose the fix. Do not edit.',profile:'code_explorer',model_slot:'subagent'}]}); text(await tools.agents_wait({ids:result.subagent_session_ids,timeout_ms:120000}));"};
    }
    else if(calls===3){name='read';args={path:'src/normalize.mjs'};}
    else if(calls===4){content='Reject non-primitive strings and collapse whitespace before lowercasing.';}
    else if(calls===5){name='write';args={path:'src/normalize.mjs',content:fixed};}
    else if(calls===6){content='Fixed after collecting child diagnosis.';}
    else{assert.fail('Unexpected model request');}
    const delta=name?{tool_calls:[{index:0,id:'delegation-'+calls,type:'function',function:{name,arguments:JSON.stringify(args)}}]}:{content};
    return new Response(`data: ${JSON.stringify({choices:[{index:0,delta,finish_reason:name?'tool_calls':'stop'}],usage:{prompt_tokens:20,completion_tokens:10}})}\n\ndata: [DONE]\n\n`,{headers:{'content-type':'text/event-stream'}});
  };
  const {report,directory}=await runLiveEvaluation({budget,fetchImpl,conditions:['C'],onProgress:()=>{}});
  assert.equal(report.passed,true,JSON.stringify(report));assert.equal(calls,6);
  assert.equal(report.conditions[0].childCount,1);assert.equal(report.conditions[0].childStatuses[0].status,'completed');
  assert.equal(report.conditions[0].cleanupConfirmed,true);assert.equal(report.conditions[0].delegationExercised,true);
  const ledger=JSON.parse(fs.readFileSync(path.join(directory,'ledger.json'),'utf8'));
  assert.equal(ledger.requests.filter(request=>request.kind==='child').length,2);
});
