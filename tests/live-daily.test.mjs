import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {root} from '../src/paths.mjs';
import {validateLiveConfig} from '../src/live-config.mjs';
import {validateBudget,EvaluationBudget} from '../src/evaluation-budget.mjs';
import {LiveBudgetTransport} from '../src/live-budget-transport.mjs';
import {createLiveRuntime} from '../src/live-interactive.mjs';
import {liveConfig,sse} from './helpers/live-fixture.mjs';

const base=path.join(root,'tests/.tmp');fs.mkdirSync(base,{recursive:true});
function setup(){
  const directory=fs.mkdtempSync(path.join(base,'daily-')),workspace=path.join(directory,'work');fs.mkdirSync(workspace);
  const config=structuredClone(liveConfig);delete config.budget;config.accounting={mode:'provider',id:'daily-fixture'};
  const validate=value=>validateLiveConfig(value,{env:{PI_LIVE_TEST_KEY:'daily-synthetic-credential'},cwd:workspace});
  return {...validate(config),directory,validate,dispose(){fs.rmSync(directory,{recursive:true,force:true});}};
}
const payload=budget=>({model:budget.model,stream:true,stream_options:{include_usage:true},max_completion_tokens:budget.perRequestMaxOutputTokens,messages:[]});
async function request(gate,kind='parent',body=payload(gate.budget)){
  const call=gate.createCall({kind});try{const response=await call.fetch(gate.endpoint,{method:'POST',body:JSON.stringify(body)});await response.text();}finally{call.finish();}
}

test('daily mode is explicit, omits usage caps, rejects mixed policies and cannot bypass campaign validation',async()=>{
  const f=setup();try{
    assert.equal(f.budget.accountingOnly,true);assert.equal(f.budget.maxRequests,null);assert.equal(f.budget.maxDurationMs,null);
    assert.equal(f.budget.perRequestMaxOutputTokens,4000);
    assert.throws(()=>f.validate({...f.config,accounting:undefined}),/ALLOWANCE_REQUIRED/);
    for(const accounting of [null,{mode:'unlimited',id:'x'},{mode:'provider',id:'../x'},{mode:'provider',id:'x',maxRequests:100},{mode:'provider',id:'x',perRequestMaxOutputTokens:0}])assert.throws(()=>f.validate({...f.config,accounting}),/LIVE_/);
    assert.throws(()=>f.validate({...f.config,budget:liveConfig.budget}),/CONFLICT/);
    assert.throws(()=>validateBudget(f.budget),/INVALID_EVALUATION_ACCOUNTING_MODE/);
    assert.throws(()=>new EvaluationBudget(f.budget),/INVALID_EVALUATION_ACCOUNTING_MODE/);
    assert.throws(()=>new LiveBudgetTransport({...f,ledgerPath:path.join(f.directory,'campaign.json')}),/INVALID_EVALUATION_ACCOUNTING_MODE/);
    await assert.rejects(createLiveRuntime({...f,options:{headlessEvaluation:true}}),/NOT_FOR_EVALUATION/);
  }finally{f.dispose();}
});

test('daily parent/child/retry/summary usage persists across restart and months idle without a local deadline',async()=>{
  const f=setup();let gate,now=1000,calls=0;
  const open=()=>new LiveBudgetTransport({...f,interactive:true,clock:()=>now,ledgerPath:path.join(f.directory,'ledger.json'),fetchImpl:async()=>{calls++;return sse({usage:{prompt_tokens:20000,completion_tokens:10}});}});
  try{
    gate=open();
    await Promise.all(['parent','child','retry','summary'].map(kind=>request(gate,kind)));
    assert.equal(gate.state.inputTokens,80000);assert.equal(gate.state.outputTokens,40);assert.equal(gate.state.status,'running');
    assert.equal(gate.timer,undefined);assert.equal(gate.remainingMs(),Infinity);
    const started=gate.state.startedAt;gate.close();now+=90*86400000;gate=open();
    await request(gate);assert.equal(calls,5);assert.equal(gate.state.requests.length,5);assert.equal(gate.state.inputTokens,100000);assert.equal(gate.state.startedAt,started);
    assert.deepEqual(gate.state.requests.slice(0,4).map(r=>r.kind),['parent','child','retry','summary']);
    assert.equal(JSON.parse(fs.readFileSync(gate.file)).inputTokens,100000);
  }finally{gate?.close();f.dispose();}
});

test('daily mode retains pinned endpoint/model, output generation bound, lock and accounting identity',async()=>{
  const f=setup();let gate,sends=0;
  const args={...f,interactive:true,ledgerPath:path.join(f.directory,'ledger.json'),fetchImpl:async()=>{sends++;return sse();}};
  try{
    gate=new LiveBudgetTransport(args);
    assert.throws(()=>new LiveBudgetTransport(args),/LOCKED/);
    await assert.rejects(request(gate,'parent',{...payload(f.budget),model:'silent-fallback'}),/PAYLOAD_LIMIT/);
    await assert.rejects(request(gate,'parent',{...payload(f.budget),max_completion_tokens:4001}),/PAYLOAD_LIMIT/);
    await assert.rejects(gate.createCall().fetch('https://wrong.example',{method:'POST',body:JSON.stringify(payload(f.budget))}),/ENDPOINT_DENIED/);
    assert.equal(sends,0);gate.close();
    assert.throws(()=>new LiveBudgetTransport({...args,budget:{...f.budget,model:'changed'}}),/CONFIGURATION_CHANGED/);
    assert.throws(()=>new LiveBudgetTransport({...args,budget:{...liveConfig.budget,maxAttempts:1,provider:f.budget.provider,model:f.budget.model}}),/CONFIGURATION_CHANGED/);
  }finally{gate?.close();f.dispose();}
});

test('daily unknown usage, cancellation, provider errors and wrong response model still stop conservatively',async()=>{
  for(const scenario of ['unknown','cancel','provider-error','wrong-model']){
    const f=setup();let gate;const controller=new AbortController();
    try{
      gate=new LiveBudgetTransport({...f,interactive:true,ledgerPath:path.join(f.directory,'ledger.json'),fetchImpl:async(_url,init)=>{
        if(scenario==='unknown')return sse({usage:null});
        if(scenario==='wrong-model')return sse({model:'wrong'});
        if(scenario==='provider-error')return new Response('synthetic failure',{status:429});
        controller.abort();throw new Error('cancelled');
      }});
      const call=gate.createCall({signal:controller.signal});
      try{const response=await call.fetch(f.endpoint,{method:'POST',body:JSON.stringify(payload(f.budget))});await response.text();}catch{}finally{call.finish();}
      assert.equal(gate.state.status,'stopped');assert.equal(gate.state.requests.length,1);
      assert.throws(()=>gate.assertOpen(),/STOP/);gate.close();
      gate=new LiveBudgetTransport({...f,interactive:true,ledgerPath:path.join(f.directory,'ledger.json')});assert.throws(()=>gate.assertOpen(),/STOP/);
    }finally{gate?.close();f.dispose();}
  }
});

test('actual daily SDK streams, delegates, summarizes and resumes without resetting accounting',async()=>{
  const f=setup();let live,childCalls=0;
  fs.writeFileSync(path.join(f.workspace,'input.txt'),'daily fixture');
  const fetchImpl=async(_url,init)=>{
    const body=JSON.parse(init.body);
    assert.equal(body.max_completion_tokens,4000);
    return sse();
  };
  const open=async(options={})=>{
    const result=await createLiveRuntime({...f,fetchImpl,options});
    await result.host.session.bindExtensions({mode:'rpc',onError:error=>{throw Error(error.message);}});return result;
  };
  try{
    live=await open();assert.match(live.status(),/provider limits; no local usage budget/);assert.doesNotMatch(live.status(),/\/null/);
    const events=[];const unsub=live.host.session.subscribe(event=>events.push(event));
    await live.host.session.prompt('Synthetic daily parent turn');unsub();assert.ok(events.some(event=>event.type==='message_update'));
    const supervisor=live.getHarness().getSupervisor();const spawned=await supervisor.spawnTasks([{prompt:'Synthetic child reply',profile:'code_explorer',model_slot:'subagent'}]);
    await supervisor.wait(spawned.subagent_session_ids,30000,100);
    const child=supervisor.get(spawned.subagent_session_ids[0]);assert.equal(child.status,'completed');assert.equal(child.cleanupConfirmed,true);
    childCalls=live.gate.state.requests.filter(r=>r.kind==='child').length;assert.ok(childCalls>0);
    for(let i=0;i<4;i++){
      live.host.session.sessionManager.appendMessage({role:'user',content:'large fixture history '.repeat(600),timestamp:Date.now()});
      live.host.session.sessionManager.appendMessage({role:'assistant',content:[{type:'text',text:'large fixture answer '.repeat(600)}],api:'openai-completions',provider:'9router',model:'fixture-model',usage:{input:20,output:10,totalTokens:30,cacheRead:0,cacheWrite:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},stopReason:'stop',timestamp:Date.now()});
    }
    await live.host.session.compact();
    const count=live.gate.state.requests.length;assert.ok(count>=3);const total=live.gate.state.inputTokens,file=live.host.session.sessionFile;
    await live.close();live=await open({session:file});assert.equal(live.gate.state.requests.length,count);assert.equal(live.gate.state.inputTokens,total);
    await live.host.session.prompt('Resumed fixture');assert.equal(live.gate.state.requests.length,count+1);
    assert.equal(live.gate.state.requests.filter(r=>r.kind==='child').length,childCalls);
  }finally{await live?.close();f.dispose();}
});
