const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),pty=require(process.argv[2]);
const daily=process.argv.includes('--daily'),node=process.env.PI_NATIVE_NODE_EXE||process.execPath;
const id='native-fixture-'+Date.now(),control=path.join(root,'agent/live-private',id),workspace=path.join(root,'tests/.tmp',id);
fs.mkdirSync(control,{recursive:true});fs.mkdirSync(workspace,{recursive:true});
const configFile=path.join(control,'config.json'),key='native-synthetic-secret';let calls=0;
const strip=value=>value.replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g,'').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const server=http.createServer((req,res)=>{
  let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{
    assert.equal(req.url,'/v1/chat/completions');assert.equal(req.headers.authorization,'Bearer '+key);
    assert.equal(JSON.parse(body).model,'fixture-model');calls++;res.writeHead(200,{'content-type':'text/event-stream'});
    const send=(delta,finish=null,usage)=>res.write('data: '+JSON.stringify({model:'fixture-model',choices:[{index:0,delta,finish_reason:finish}],usage})+'\n\n');
    if(calls===1){send({tool_calls:[{index:0,id:'native-write',type:'function',function:{name:'write',arguments:JSON.stringify({path:'native.txt',content:'synthetic tool output'})}}]},'tool_calls',{prompt_tokens:20,completion_tokens:10});res.end('data: [DONE]\n\n');}
    else if(calls===2){send({content:'NATIVE STREAM '});setTimeout(()=>{send({content:'COMPLETE'},'stop',{prompt_tokens:20,completion_tokens:10});res.end('data: [DONE]\n\n');},350);}
    else {send({content:'CANCEL THIS STREAM'});const timer=setInterval(()=>send({content:'.'}),300);res.on('close',()=>clearInterval(timer));}
  });
});
function start(extra=[]){
  const env={...process.env,PI_LIVE_TEST_KEY:key,TERM:'xterm-256color'};delete env.NODE_OPTIONS;delete env.ELECTRON_RUN_AS_NODE;delete env.NO_COLOR;
  const terminal=pty.spawn(node,[path.join(root,'launch-live.mjs'),'--live','--config',configFile,...extra],{cols:120,rows:40,cwd:workspace,env,useConpty:true});
  let text='',exit;terminal.onData(data=>text+=data);const closed=new Promise(resolve=>terminal.onExit(event=>{exit=event;resolve(event);}));
  const wait=async predicate=>{const until=Date.now()+150000;while(!predicate(strip(text))){if(exit)throw Error('EARLY_EXIT '+exit.exitCode+' '+strip(text).slice(-1500));if(Date.now()>until)throw Error('NATIVE_TIMEOUT '+strip(text).slice(-1500));await sleep(80);}};
  return {terminal,wait,closed,text:()=>text,isExited:()=>!!exit};
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const {liveConfig}=await import(require('node:url').pathToFileURL(path.join(root,'tests/helpers/live-fixture.mjs')).href);
  const config={...liveConfig,baseUrl:`http://127.0.0.1:${server.address().port}/v1`,budget:{...liveConfig.budget,allowanceId:id}};
  if(daily){delete config.budget;config.accounting={mode:'provider',id};}
  fs.writeFileSync(configFile,JSON.stringify(config));
  let a,b;
  try{
    a=start();await a.wait(text=>text.includes('LIVE 9router/fixture-model')&&text.includes('/ commands'));
    if(daily)assert.ok(strip(a.text()).includes('no local usage budget'));
    a.terminal.write('write fixture\r');await a.wait(text=>text.includes('NATIVE STREAM '));assert.ok(!strip(a.text()).includes('NATIVE STREAM COMPLETE'));await a.wait(text=>text.includes('NATIVE STREAM COMPLETE'));
    assert.equal(fs.readFileSync(path.join(workspace,'native.txt'),'utf8'),'synthetic tool output');
    a.terminal.resize(80,24);await sleep(200);a.terminal.resize(120,40);await sleep(200);
    a.terminal.write('\x04');assert.equal((await a.closed).exitCode,0);assert.equal(calls,2);
    assert.ok(!a.text().includes(key));assert.ok(a.text().includes('resume.mjs'));
    b=start(['--continue']);await b.wait(text=>text.includes('NATIVE STREAM COMPLETE')&&text.includes('/ commands'));
    b.terminal.write('cancel fixture\r');await b.wait(text=>text.includes('CANCEL THIS STREAM'));b.terminal.write('\x1b');
    await b.wait(text=>text.includes('missing_or_invalid_usage'));await sleep(300);b.terminal.write('\x03');await sleep(200);b.terminal.write('\x04');
    assert.equal((await b.closed).exitCode,0);assert.equal(calls,3);assert.ok(!b.text().includes(key));
    const ledger=JSON.parse(fs.readFileSync(path.join(control,'ledger.json'),'utf8'));
    assert.equal(ledger.requests.length,3);assert.equal(ledger.status,'stopped');assert.equal(ledger.requests[2].status,'usage_unknown');assert.ok(!fs.existsSync(path.join(control,'ledger.json.lock')));
    const receipt={passed:true,mode:daily?'provider-accounting':'bounded',kind:'Windows ConPTY actual live launcher against loopback synthetic SSE',paidInferenceRequests:0,requests:calls,checks:['explicit live launch','native incremental streaming','write tool','resize','clean exit','resume with accounting','Escape cancellation','Ctrl+C clear','Ctrl+D exit','secret absent from transcript','private resume hint','ledger lock released']};
    fs.mkdirSync(path.join(root,'artifacts/checkpoint'),{recursive:true});fs.writeFileSync(path.join(root,'artifacts/checkpoint',daily?'daily-native-verification.json':'live-native-verification.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
  }finally{try{if(a&&!a.isExited())a.terminal.kill();}catch{}try{if(b&&!b.isExited())b.terminal.kill();}catch{}server.closeAllConnections();server.close();}
})().then(()=>process.exit(0),error=>{server.closeAllConnections();server.close();console.error(error);process.exit(1);});
