import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {root} from '../../src/paths.mjs';
import {createCodexBudgetBroker} from '../../src/codex-budget-broker.mjs';
import {buildBehaviorPlan} from '../../src/behavior-plan.mjs';
import {installLiveNetworkGuard} from '../../src/live-network-guard.mjs';
import {responsesFixture} from './responses-fixture.mjs';
const base=fs.mkdtempSync(path.join(root,'tests/.tmp/broker-native-'));
let count=0;
const directory=()=>{const d=path.join(base,String(++count));fs.mkdirSync(d);return d;};
test.after(()=>fs.rmSync(base,{recursive:true,force:true}));
const endpoint='http://127.0.0.1:9/v1/responses';
const budget={...buildBehaviorPlan({comparison:'codex'}).perRun,maxAttempts:1,allowanceId:'fixture',provider:'9router',model:'cx/gpt-6-astra',responseModels:['cx/gpt-6-astra'],thinkingLevel:'low',brainEnabled:false};
const payload={model:budget.model,stream:true,store:false,max_output_tokens:2000,reasoning:{effort:'low'},input:[]};
const {listenLoopback}=installLiveNetworkGuard();
// The test client can only address the explicitly generated loopback broker.
function localClient(url,token,body,route='/responses',terminalOnly=false) {
  const source=`const u=new URL(process.argv[1]);if(u.hostname!=='127.0.0.1')throw Error('fixture host');const r=await fetch(u,{method:'POST',headers:{Authorization:'Bearer '+process.argv[2]},body:process.argv[3]});let text='';if(process.argv[4]==='terminal'){const reader=r.body.getReader(),decoder=new TextDecoder();while(true){const v=await reader.read();if(v.done)break;text+=decoder.decode(v.value,{stream:true});if(text.includes('event: response.completed')){await reader.cancel();break;}}}else text=await r.text();console.log(JSON.stringify({status:r.status,text}));`;
  const child=spawn(process.execPath,['--input-type=module','-e',source,url+route,token,JSON.stringify(body),terminalOnly?'terminal':'eof'],{windowsHide:true,env:{...process.env,NODE_OPTIONS:''},stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',()=>{});
  return new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>{if(code!==0)reject(Error('FIXTURE_CLIENT_FAILED'));else{try{resolve(JSON.parse(output));}catch(error){reject(error);}}});});
}
test('native broker enforces cap and credential boundary without changing prompts or model',async()=>{
  let forwarded;const broker=await createCodexBudgetBroker({listenLoopback,budget,baseUrl:'http://127.0.0.1:9/v1',key:'synthetic-provider-secret',ledgerPath:path.join(directory(),'ledger.json'),fetchImpl:async(url,init)=>{assert.equal(url,endpoint);assert.equal(init.headers.Authorization,'Bearer synthetic-provider-secret');forwarded=JSON.parse(init.body);return responsesFixture();}});
  try{
    const body={...payload};delete body.max_output_tokens;
    const result=await localClient(broker.baseUrl,broker.token,body);
    assert.equal(result.status,200);assert.deepEqual(forwarded,{...body,max_output_tokens:2000});
    assert.equal(broker.gate.state.requests[0].status,'accounted');
    assert.ok(!JSON.stringify(broker.gate.state).includes('synthetic-provider-secret'));
  }finally{await broker.close();}
});
test('broker denies foreign credentials and unaccountable compaction routes without sending',async()=>{
  for(const scenario of ['auth','route']){
    let sends=0;const broker=await createCodexBudgetBroker({listenLoopback,budget,baseUrl:'http://127.0.0.1:9/v1',key:'synthetic',ledgerPath:path.join(directory(),'ledger.json'),fetchImpl:async()=>{sends++;return responsesFixture();}});
    try{const result=await localClient(broker.baseUrl,scenario==='auth'?'wrong':broker.token,payload,scenario==='route'?'/responses/compact':'/responses');assert.equal(result.status,502);assert.equal(sends,0);assert.ok(broker.gate.state.stopReason);}finally{await broker.close();}
  }
});
test('terminal completion releases an upstream with no EOF and permits the next turn',async()=>{
  let cancelled=0,sends=0;
  const broker=await createCodexBudgetBroker({listenLoopback,budget,baseUrl:'http://127.0.0.1:9/v1',key:'synthetic',ledgerPath:path.join(directory(),'ledger.json'),fetchImpl:async(_url,init)=>{
    sends++;const data=new TextEncoder().encode(await responsesFixture().text());
    return new Response(new ReadableStream({start(c){c.enqueue(data);init.signal.addEventListener('abort',()=>c.error(Error('synthetic trailing disconnect')),{once:true});},cancel(){cancelled++;}}),{headers:{'Content-Type':'text/event-stream'}});
  }});
  try{
    for(const terminalOnly of [true,false]){const result=await localClient(broker.baseUrl,broker.token,payload,'/responses',terminalOnly);assert.equal(result.status,200);}
    assert.equal(sends,2);assert.equal(cancelled,2);assert.equal(broker.gate.state.stopReason,undefined);
    assert.equal(broker.gate.state.inputTokens,200);assert.equal(broker.gate.state.outputTokens,40);
    assert.ok(broker.gate.state.requests.every(record=>record.status==='accounted'&&record.terminalEvent==='response.completed'));
  }finally{await broker.close();}
});
