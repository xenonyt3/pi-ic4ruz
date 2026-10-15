import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {root} from '../src/paths.mjs';
import {parseLiveArgs,validateLiveConfig} from '../src/live-config.mjs';
import {createLiveRuntime} from '../src/live-interactive.mjs';
import {LiveBudgetTransport} from '../src/live-budget-transport.mjs';
import {liveConfig,sse} from './helpers/live-fixture.mjs';

const base=path.join(root,'tests/.tmp');fs.mkdirSync(base,{recursive:true});
const key='synthetic-live-test-secret';
function setup(overrides={}) {
  const directory=fs.mkdtempSync(path.join(base,'interactive-')),workspace=path.join(directory,'work');fs.mkdirSync(workspace);
  const config={...structuredClone(liveConfig),...overrides};
  const resolved=validateLiveConfig(config,{env:{PI_LIVE_TEST_KEY:key},cwd:workspace});
  return {...resolved,directory,dispose(){fs.rmSync(directory,{recursive:true,force:true});}};
}
async function open(fixture,fetchImpl,options={}) {
  const live=await createLiveRuntime({...fixture,fetchImpl,options});
  await live.host.session.bindExtensions({mode:'rpc',onError:error=>{throw new Error(error.message);}});
  return live;
}

test('live opt-in, incomplete config, model, credential, endpoint and fresh allowance fail before request',()=>{
  for(const args of [[],['--live'],['--config','x'],['--live','--config','x','prompt'],['--live','--config','x','--api-key','secret']])assert.throws(()=>parseLiveArgs(args),/LIVE_/);
  assert.equal(parseLiveArgs(['--live','--config','local','--check']).check,true);
  const f=setup();
  try{
    const validate=config=>validateLiveConfig(config,{env:{PI_LIVE_TEST_KEY:key},cwd:f.workspace});
    for(const patch of [{model:'unknown'},{models:[]},{baseUrl:'https://user:secret@example.com'},{api:'openai-responses'},{credentialEnv:'MISSING'},
      {budget:{...liveConfig.budget,authorized:false}},{budget:{...liveConfig.budget,maxRequests:0}},{budget:{...liveConfig.budget,maxCost:1}}])assert.throws(()=>validate({...liveConfig,...patch}),/LIVE_|INVALID_/);
    assert.throws(()=>validateLiveConfig(liveConfig,{env:{PI_LIVE_TEST_KEY:key},cwd:root}),/ISOLATION/);
  }finally{f.dispose();}
});

test('actual SDK streams deltas, executes tools, compacts, resumes and retains one allowance', {timeout:60000},async()=>{
  const f=setup();let calls=0;
  const fetchImpl=async(_url,init)=>{
    assert.equal(new Headers(init.headers).get('Authorization'),`Bearer ${key}`);
    calls++;
    return calls===1?sse({tool:{name:'write',args:{path:'answer.txt',content:'written through live gate'}}}):sse({text:calls===3?'Persistent summary.':'streamed reply'});
  };
  let live;
  try{
    live=await open(f,fetchImpl);const updates=[];live.host.session.subscribe(e=>{if(e.type==='message_update')updates.push(e.assistantMessageEvent.type);});
    await live.host.session.prompt('Write a fixture file.');
    assert.equal(fs.readFileSync(path.join(f.workspace,'answer.txt'),'utf8'),'written through live gate');
    assert.ok(updates.includes('text_delta'));assert.equal(calls,2);
    const file=live.host.session.sessionFile;
    // Realistic history is needed to cross the configured retained-context boundary.
    for(let i=0;i<4;i++){
      live.host.session.sessionManager.appendMessage({role:'user',content:'large fixture history '.repeat(600),timestamp:Date.now()});
      live.host.session.sessionManager.appendMessage({role:'assistant',content:[{type:'text',text:'large fixture answer '.repeat(600)}],api:'openai-completions',provider:'9router',model:'fixture-model',usage:{input:20,output:10,totalTokens:30,cacheRead:0,cacheWrite:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},stopReason:'stop',timestamp:Date.now()});
    }
    await live.host.session.compact();assert.ok(calls>2);
    const beforeResume=calls;
    assert.equal(live.gate.state.requests.length,calls);
    assert.equal(live.getHarness().policy.pendingWriterCalls().length,0);
    await live.close();live=await open(f,fetchImpl,{session:file});
    assert.equal(live.gate.state.inputTokens,20*beforeResume);await live.host.session.prompt('Continue.');
    assert.ok(calls>beforeResume);assert.equal(live.gate.state.requests.length,calls);assert.equal(live.gate.state.inputTokens,20*calls);
    const records=fs.readFileSync(file,'utf8')+fs.readFileSync(path.join(f.directory,'ledger.json'),'utf8');
    assert.ok(!records.includes(key));assert.match(live.status(),/LIVE 9router\/fixture-model/);
  }finally{await live?.close();f.dispose();}
});

test('real brokered child and parent share ledger; child tools and cleanup remain active', {timeout:60000},async()=>{
  const f=setup();let calls=0,live;
  fs.writeFileSync(path.join(f.workspace,'input.txt'),'read me');
  try{
    live=await open(f,async()=>{calls++;return calls===1?sse({tool:{name:'read',args:{path:'input.txt'}}}):sse();});
    const supervisor=live.getHarness().getSupervisor();
    const child=await supervisor.spawnTasks([{prompt:'Read input.txt.',profile:'code_explorer',model_slot:'subagent'}]);
    assert.equal(child.subagent_session_ids.length,1);
    await supervisor.wait(child.subagent_session_ids,30000,100);
    assert.equal(supervisor.get(child.subagent_session_ids[0]).status,'completed');
    assert.equal(supervisor.get(child.subagent_session_ids[0]).cleanupConfirmed,true);
    await live.host.session.prompt('Parent reply.');
    assert.equal(live.gate.state.requests.filter(r=>r.kind==='child').length,2);
    assert.equal(live.gate.state.requests.length,3);
  }finally{await live?.close();f.dispose();}
});

test('wrong response model, provider errors, missing usage and cancel stop conservatively without secret logging', {timeout:60000},async()=>{
  for(const scenario of ['wrong-model','missing-model','error','usage','cancel']){
    const f=setup();let live,calls=0,started;
    const sent=new Promise(resolve=>started=resolve);
    try{
      live=await open(f,async(_url,init)=>{
        calls++;started();
        if(scenario==='wrong-model')return sse({model:'silent-fallback'});
        if(scenario==='missing-model')return sse({model:null});
        if(scenario==='error')return new Response(`error: Bearer ${key}`,{status:429});
        if(scenario==='usage')return sse({usage:null});
        return new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new Error(key)),{once:true}));
      });
      const pending=live.host.session.prompt('fixture');await sent;
      if(scenario==='cancel')await live.host.session.abort();await pending;
      assert.equal(calls,1);assert.equal(live.gate.state.status,'stopped');
      if(scenario==='wrong-model')assert.equal(live.gate.state.stopReason,'response_model_mismatch');
      if(scenario==='missing-model')assert.equal(live.gate.state.stopReason,'response_model_missing');
      assert.ok(!JSON.stringify(live.host.session.messages).includes(key));
      await live.host.session.prompt('retry rejected');assert.equal(calls,1);
      await live.close();live=undefined;
      await assert.rejects(open(f,async()=>{throw Error('should not send');}),/BUDGET_STOP/);
    }finally{await live?.close();f.dispose();}
  }
});

test('parent cancellation drains brokered child; exhausted allowance never dispatches a parent suffix', {timeout:60000},async()=>{
  const f=setup({budget:{...liveConfig.budget,maxRequests:1}});let live,calls=0,started;
  const sent=new Promise(resolve=>started=resolve);
  try{
    live=await open(f,async(_url,init)=>{calls++;started();return new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(Error('cancelled')),{once:true}));});
    const supervisor=live.getHarness().getSupervisor();
    const child=await supervisor.spawnTasks([{prompt:'Wait for cancel.',profile:'code_explorer',model_slot:'subagent'}]);
    await sent;await live.host.session.prompt('Cannot exceed the shared request cap.');
    await live.host.session.abort();
    assert.equal(calls,1);assert.equal(live.gate.state.stopReason,'capacity');
    assert.equal(supervisor.get(child.subagent_session_ids[0]).cleanupConfirmed,true);
    assert.equal(supervisor.activeCount(),0);
  }finally{await live?.close();f.dispose();}
});

test('interactive user shell uses shared writer lease; model/effort switches cannot silently change the funded model',async()=>{
  const f=setup();let live,lease;
  const {acquireWriterLease,releaseWriterLease}=await import('../src/workspace-ownership.ts');
  try{
    live=await open(f,async()=>sse());
    await assert.rejects(live.host.session.setModel({...live.host.session.model,id:'wrong-model'}),/MODEL_PINNED/);
    live.host.session.setThinkingLevel('high');assert.equal(live.host.session.thinkingLevel,'off');
    const hook=await live.host.session.extensionRunner.emitUserBash({type:'user_bash',command:'echo lease',cwd:f.workspace,excludeFromContext:false});
    assert.ok(hook.operations);
    lease=await acquireWriterLease({workspace:f.workspace,owner:'other-writer',leaseRoot:path.join(root,'agent/writer-leases')});
    await assert.rejects(hook.operations.exec('echo lease',f.workspace,{onData:()=>{}}),/WRITER_BUSY/);
    await releaseWriterLease(lease,{cleanupConfirmed:true});lease=undefined;
    let output='';await hook.operations.exec('echo lease',f.workspace,{onData:data=>output+=data});assert.match(output,/lease/);
    assert.equal(live.gate.state.requests.length,0);
  }finally{if(lease)await releaseWriterLease(lease,{cleanupConfirmed:true});await live?.close();f.dispose();}
});

test('live parent network guard blocks unbrokered fetch, sockets, HTTP and DNS',()=>{
  const source=`import assert from 'node:assert/strict';import net from 'node:net';import http from 'node:http';import dns from 'node:dns';
    import {installLiveNetworkGuard} from ${JSON.stringify(pathToFileURL(path.join(root,'src/live-network-guard.mjs')).href)};
    installLiveNetworkGuard();
    await assert.rejects(fetch('http://127.0.0.1:9'),/UNBROKERED/);
    assert.throws(()=>net.connect(9,'127.0.0.1'),/UNBROKERED/);
    assert.throws(()=>http.get('http://127.0.0.1:9'),/UNBROKERED/);
    assert.throws(()=>dns.lookup('fixture.invalid',()=>{}),/UNBROKERED/);console.log('LIVE_NETWORK_GUARD_PASS');`;
  const result=spawnSync(process.execPath,['--input-type=module','-e',source],{encoding:'utf8',windowsHide:true,timeout:10000});
  assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/LIVE_NETWORK_GUARD_PASS/);
});

test('shutdown waits for interactive shell process cleanup and writer lease release', {timeout:30000},async()=>{
  const f=setup();let live,ready,settled=false,pending;
  const started=new Promise(resolve=>ready=resolve);
  try{
    live=await open(f,async()=>sse());
    const hook=await live.host.session.extensionRunner.emitUserBash({type:'user_bash',command:'echo START; sleep 30',cwd:f.workspace,excludeFromContext:false});
    pending=live.host.session.executeBash('echo START; sleep 30',text=>{if(text.includes('START'))ready();},{operations:hook.operations}).finally(()=>settled=true);
    await started;await live.close();live=undefined;
    assert.equal(settled,true);assert.equal((await pending).cancelled,true);
    const {acquireWriterLease,releaseWriterLease}=await import('../src/workspace-ownership.ts');
    const lease=await acquireWriterLease({workspace:f.workspace,owner:'after-exit',leaseRoot:path.join(root,'agent/writer-leases')});
    await releaseWriterLease(lease,{cleanupConfirmed:true});
  }finally{await live?.close();await pending;f.dispose();}
});

test('in-app fork, new session and resume remain bound to the same allowance',async()=>{
  const f=setup();let live,calls=0;
  try{
    live=await open(f,async()=>{calls++;return sse();});
    live.host.setRebindSession(session=>session.bindExtensions({mode:'rpc',onError:()=>{}}));
    await live.host.session.prompt('first');const original=live.host.session.sessionFile;
    const user=live.host.session.sessionManager.getEntries().find(e=>e.type==='message'&&e.message.role==='user');
    assert.equal((await live.host.fork(user.id,{position:'at'})).cancelled,false);
    await live.host.session.prompt('fork');assert.equal(live.gate.state.requests.length,2);
    assert.equal((await live.host.newSession()).cancelled,false);
    await live.host.session.prompt('new');assert.equal(live.gate.state.requests.length,3);
    assert.equal((await live.host.switchSession(original)).cancelled,false);
    await live.host.session.prompt('resumed');assert.equal(live.gate.state.requests.length,4);assert.equal(calls,4);
  }finally{await live?.close();f.dispose();}
});

test('shared ledger denies concurrent launch, cap changes, missing accounting and expired resume',async()=>{
  const f=setup();let live;
  try{
    live=await open(f,async()=>sse());
    await assert.rejects(open(f,async()=>sse()),/LOCKED/);
    await live.host.session.prompt('one');const file=live.host.session.sessionFile;await live.close();live=undefined;
    await assert.rejects(createLiveRuntime({...f,budget:{...f.budget,maxRequests:100},fetchImpl:async()=>sse()}),/CONFIGURATION_CHANGED/);
    const ledger=path.join(f.directory,'ledger.json'),state=JSON.parse(fs.readFileSync(ledger,'utf8'));
    state.startedAt=Date.now()-f.budget.maxDurationMs-1000;fs.writeFileSync(ledger,JSON.stringify(state));
    await assert.rejects(open(f,async()=>sse(),{session:file}),/BUDGET_STOP/);
    fs.unlinkSync(ledger);await assert.rejects(open(f,async()=>sse(),{session:file}),/LEDGER_MISSING/);
  }finally{await live?.close();f.dispose();}
});

test('every physical fetch including retry counts; pending crash charges reservation after explicit lock recovery',async()=>{
  const f=setup({budget:{...liveConfig.budget,maxRequests:2}}),file=path.join(f.directory,'ledger.json');
  const make=()=>new LiveBudgetTransport({budget:f.budget,endpoint:f.endpoint,ledgerPath:file,interactive:true,fetchImpl:async()=>sse()});
  let gate=make();
  const payload={model:f.config.model,stream:true,stream_options:{include_usage:true},max_completion_tokens:1000,messages:[]};
  try{
    const call=gate.createCall({kind:'retry'});
    for(let i=0;i<2;i++){const response=await call.fetch(f.endpoint,{method:'POST',body:JSON.stringify(payload)});await response.text();call.finish();}
    await assert.rejects(call.fetch(f.endpoint,{method:'POST',body:JSON.stringify(payload)}),/EXHAUSTED/);assert.equal(gate.state.requests.length,2);
    gate.close();
    const state=JSON.parse(fs.readFileSync(file,'utf8'));state.status='running';delete state.stopReason;state.requests[1].status='pending';
    state.inputTokens=20;state.outputTokens=10;fs.writeFileSync(file,JSON.stringify(state));
    gate=make();assert.equal(gate.state.requests[1].status,'usage_unknown');assert.equal(gate.state.status,'stopped');
    assert.equal(gate.state.outputTokens,1010);
  }finally{gate.close();f.dispose();}
});
