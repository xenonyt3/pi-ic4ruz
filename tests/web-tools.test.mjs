import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {root} from '../src/paths.mjs';
import {createWebNetwork,publicAddress} from '../src/web-network.mjs';
import {createWebServices,loadWebConfig} from '../src/web-services.mjs';
import {selectExaResponse} from '../src/web-exa.mjs';
import {registerHarness} from '../src/harness.ts';
import {authorizeToolCall} from '../src/tool-policy.ts';
import {acquireWriterLease,releaseWriterLease} from '../src/workspace-ownership.ts';
import {createFixtureSession,runTool,resultText} from './helpers/session.mjs';

const config={...loadWebConfig(),searchProvider:'duckduckgo'};
const lookup=async()=>[{address:'93.184.216.34'}];
const html=text=>new Response(text,{headers:{'content-type':'text/html'}});
const results='<div class="result results_links"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fdocs">Example &amp; API</a><a class="result__snippet">Use <b>tools</b> safely.</a></div>';

test('web network rejects private/model endpoints, credentials and unsafe redirects before dispatch',async()=>{
  let calls=0;const network=createWebNetwork({config,lookup,blockedOrigins:['https://provider.example/v1'],fetchImpl:async()=>{calls++;return new Response(null,{status:302,headers:{location:'http://127.0.0.1:20128/v1/models'}});}});
  for(const url of ['file:///C:/secret','http://a:b@example.com','http://127.0.0.1:20128/v1','http://169.254.169.254/','http://10.0.0.1/','http://[::ffff:127.0.0.1]/','https://provider.example/v1','http://localhost:9000/'])
    await assert.rejects(network.read(url),/WEB_/);
  assert.equal(calls,0);
  await assert.rejects(network.read('https://example.com'),/WEB_MODEL_ENDPOINT_DENIED/);assert.equal(calls,1);
  await network.validate('http://localhost:5173');
  const privateDns=createWebNetwork({config,lookup:async()=>[{address:'127.0.0.1'}]});
  await assert.rejects(privateDns.validate('https://example.com'),/PRIVATE_ADDRESS/);
  assert.equal(publicAddress('fc00::1'),false);assert.equal(publicAddress('2606:4700::1111'),true);
});

test('web HTTP bounds bytes, content type, statuses and redirect count without forwarding credentials',async()=>{
  for(const [response,error] of [[new Response('bad',{status:429}),'WEB_HTTP_429'],[new Response('x',{headers:{'content-type':'application/pdf'}}),'CONTENT_TYPE'],[html('x'.repeat(2049)),'TOO_LARGE']]) {
    const network=createWebNetwork({config:{...config,maxResponseBytes:2048},lookup,fetchImpl:async(_url,init)=>{assert.equal(new Headers(init.headers).has('Authorization'),false);return response;}});
    await assert.rejects(network.read('https://example.com'),new RegExp(error));
  }
  let calls=0;
  const network=createWebNetwork({config,lookup,fetchImpl:async()=>{calls++;return new Response(null,{status:302,headers:{location:'/next'}});}});
  await assert.rejects(network.read('https://example.com'),/REDIRECT_LIMIT/);assert.equal(calls,6);
  const tls=createWebNetwork({config,lookup,fetchImpl:async()=>{throw Object.assign(new Error('unsafe provider response'),{cause:{code:'CERT_HAS_EXPIRED'}});}});
  await assert.rejects(tls.read('https://example.com'),/WEB_TLS_CERTIFICATE_REJECTED/);
});

test('OMP search unwraps result URLs, reports challenges and distinguishes real empty results from markup drift',async()=>{
  for(const [body,error] of [[results,null],['<div class="anomaly-modal">challenge</div>','CHALLENGE'],['<div class="no-results">No results found</div>',null],['broken markup','FORMAT_UNRECOGNIZED']]) {
    let calls=0;
    const service=createWebServices({config,lookup,fetchImpl:async(url,init)=>{calls++;assert.equal(url,'https://html.duckduckgo.com/html/');assert.equal(init.method,'POST');assert.match(init.body,/q=example/);return html(body);}});
    try {
      if(error)await assert.rejects(service.run('web_search',{query:'example'}),new RegExp(error));
      else {
        const result=await service.run('web_search',{query:'example'});
        if(body===results){assert.match(result.text,/https:\/\/example.com\/docs/);assert.match(result.text,/Example & API/);}
        else assert.equal(result.details.count,0);
      }
      assert.equal(calls,1);
    }finally{await service.close();}
  }
});

test('OMP extraction preserves headings, code and tables, filters sections and strips executable markup',async()=>{
  const body='<html><head><title>Fixture</title></head><body><nav>Ignore nav</nav><main><h1>Guide</h1><p>Read the guide.</p><h2>Setup</h2><pre><code>npm test\n</code></pre><table><tr><th>Name</th><th>Value</th></tr><tr><td>A</td><td>1</td></tr></table><script>SECRET_SCRIPT</script><style>SECRET_STYLE</style></main></body></html>';
  const service=createWebServices({config,lookup,fetchImpl:async()=>html(body)});
  try {
    const result=await service.run('web_extract',{url:'https://example.com/docs',selector:'main'});
    const value=JSON.parse(result.text);assert.match(value.markdown,/# Guide/);assert.match(value.markdown,/```/);assert.match(value.markdown,/Name/);assert.doesNotMatch(value.markdown,/SECRET_SCRIPT|SECRET_STYLE|Ignore nav/);
    const outline=JSON.parse((await service.run('web_extract',{url:'https://example.com/docs',selector:'main',outline:true})).text);
    assert.match(outline.markdown,/# Guide/);assert.doesNotMatch(outline.markdown,/npm test/);
    await assert.rejects(service.run('web_extract',{url:'https://example.com',selector:'#missing'}),/EXTRACT_EMPTY/);
    const automatic=await service.run('web_extract',{url:'https://example.com'});assert.match(automatic.text,/Guide/);
  }finally{await service.close();}
});

test('OMP Google search renders only when required and never changes provider on a challenge',async()=>{
  const google='<div class="MjjYud"><a href="https://nodejs.org/docs"><h3>Node.js docs</h3></a><div class="VwiC3b">Official documentation</div></div>';
  for(const render of [false,true]) {
    let browserCalls=0;
    const services=createWebServices({config:{...config,searchProvider:'google'},lookup,fetchImpl:async()=>html(render?'/httpservice/retry/enablejs':google),browserFactory:()=>({run:async args=>{browserCalls++;assert.equal(args.action,'search_html');return {url:args.url,text:google};},close:async()=>{}})});
    try{const result=await services.run('web_search',{query:'Node.js docs'});assert.equal(result.details.provider,'google');assert.equal(result.details.transport,render?'browser':'http');assert.equal(result.details.count,1);assert.match(result.text,/nodejs.org\/docs/);assert.equal(browserCalls,render?1:0);}finally{await services.close();}
  }
  let calls=0;
  const service=createWebServices({config:{...config,searchProvider:'google'},lookup,fetchImpl:async()=>{calls++;return html('detected unusual traffic');},browserFactory:()=>{throw Error('Unexpected browser fallback');}});
  await assert.rejects(service.run('web_search',{query:'test'}),/CHALLENGE/);assert.equal(calls,1);await service.close();
});

test('OMP Exa public MCP handles JSON/text/SSE and accounts only matching terminal frames without HTTP EOF',async()=>{
  for(const mode of ['json','text','sse']) {
    let cancelled=false;
    const services=createWebServices({config:{...config,searchProvider:'exa'},lookup,fetchImpl:async(url,init)=>{
      assert.equal(url,'https://mcp.exa.ai/mcp?tools=web_search_exa');
      const headers=new Headers(init.headers);assert.equal(headers.has('authorization'),false);assert.equal(headers.has('x-api-key'),false);assert.equal(headers.get('x-exa-source'),'oh-my-pi');
      const request=JSON.parse(init.body);assert.equal(request.method,'tools/call');assert.equal(request.params.name,'web_search_exa');assert.equal(request.params.arguments.numResults,3);
      const structuredContent={results:[{title:'Node docs',url:'https://nodejs.org/docs',text:'Reference documentation'},{title:'unsafe',url:'javascript:alert(1)'}]};
      const result=mode==='text'?{content:[{type:'text',text:'Title: Node docs\nURL: https://nodejs.org/docs\nText: Reference documentation'}]}:{structuredContent};
      const rpc=JSON.stringify({jsonrpc:'2.0',id:request.id,result});
      if(mode!=='sse')return new Response(rpc,{headers:{'content-type':'application/json'}});
      return new Response(new ReadableStream({start(controller){
        controller.enqueue(new TextEncoder().encode('event: message\ndata: '+JSON.stringify({jsonrpc:'2.0',method:'notifications/progress',params:{}})+'\n\n'));
        controller.enqueue(new TextEncoder().encode('event: message\ndata: '+rpc+'\n\n'));
      },cancel(){cancelled=true;}}),{headers:{'content-type':'text/event-stream'}});
    }});
    try{const result=await services.run('web_search',{query:'Node docs',limit:3});assert.equal(result.details.provider,'exa');assert.equal(result.details.transport,'public-mcp');assert.equal(result.details.count,1);assert.match(result.text,/nodejs.org/);if(mode==='sse')assert.equal(cancelled,true);}finally{await services.close();}
  }
});

test('Exa rejects errors, malformed RPC, wrong IDs and unexpected payloads without a fallback',async()=>{
  assert.throws(()=>selectExaResponse('data: {bad}\n\n','text/event-stream','id'),/RPC_INVALID/);
  assert.throws(()=>selectExaResponse(JSON.stringify({jsonrpc:'2.0',id:'other',result:{}}),'application/json','id'),/RESPONSE_MISSING/);
  for(const mode of ['error','tool-error','shape']) {
    let calls=0;const service=createWebServices({config:{...config,searchProvider:'exa'},lookup,fetchImpl:async(_url,init)=>{
      calls++;const request=JSON.parse(init.body);const content=mode==='error'?{error:{code:-32000,message:'synthetic error'}}:{result:mode==='tool-error'?{isError:true,content:[{type:'text',text:'provider error'}]}:{unexpected:42}};
      return new Response(JSON.stringify({jsonrpc:'2.0',id:request.id,...content}),{headers:{'content-type':'application/json'}});
    }});
    try{await assert.rejects(service.run('web_search',{query:'fixture'}),/WEB_SEARCH_/);assert.equal(calls,1);}finally{await service.close();}
  }
});

test('web cancellation, redaction and output caps do not create model requests',async()=>{
  let started;const ready=new Promise(resolve=>started=resolve);
  const service=createWebServices({config,lookup,fetchImpl:async(_url,init)=>{started();return new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true}));}});
  const pending=service.run('web_extract',{url:'https://example.com'});await ready;await service.abort();await assert.rejects(pending);await service.close();
  const redacted=createWebServices({config:{...config,maxOutputChars:1000},lookup,secrets:['fixture-provider-secret'],fetchImpl:async()=>new Response('fixture-provider-secret '+'x'.repeat(2000),{headers:{'content-type':'text/plain'}})});
  const result=await redacted.run('web_extract',{url:'https://example.com'});assert.doesNotMatch(result.text,/fixture-provider-secret/);assert.match(result.text,/REDACTED/);assert.match(result.text,/TRUNCATED/);await redacted.close();
  await assert.rejects(redacted.run('web_search',{query:'test'}),/DISABLED/);
});

test('real SDK discovers OMP tools through codemode, enforces browser writer lease and keeps Brain off',async()=>{
  const base=path.join(root,'tests/.tmp');fs.mkdirSync(base,{recursive:true});const cwd=fs.mkdtempSync(path.join(base,'web-sdk-'));const leaseRoot=path.join(cwd,'leases');
  let browserCalls=0;let closed=0;let harness;
  const services=createWebServices({config,lookup,workspace:cwd,directory:cwd,fetchImpl:async()=>html(results),browserFactory:()=>({run:async()=>{browserCalls++;return {tabs:[]};},close:async()=>{closed++;}})});
  const cfg=JSON.parse(fs.readFileSync(path.join(root,'config/harness.json'),'utf8'));cfg.ui.reasonTerminal=false;
  const f=await createFixtureSession({cwd,extensions:[pi=>{harness=registerHarness(pi,{cwd,config:cfg,allowSyntheticTurns:true,webServices:services,leaseRoot,registryDir:path.join(cwd,'receipts'),telemetryDir:path.join(cwd,'telemetry')});}]});
  try {
    assert.deepEqual(f.session.getActiveToolNames().sort(),['bash','codemode','edit','read','write']);
    const search=await runTool(f,'codemode',{code:'text(await tools.web_search({query:"example"}));'});assert.equal(search.isError,false,resultText(search));assert.match(resultText(search),/example.com/);
    const lease=await acquireWriterLease({workspace:cwd,owner:'other-writer',leaseRoot});
    try{const denied=await runTool(f,'codemode',{code:'text(await tools.browser({action:"tabs"}));'});assert.match(resultText(denied),/WRITER_BUSY/);assert.equal(browserCalls,0);}finally{await releaseWriterLease(lease,{cleanupConfirmed:true});}
    const tabs=await runTool(f,'codemode',{code:'text(await tools.browser({action:"tabs"}));'});assert.equal(tabs.isError,false,resultText(tabs));assert.equal(browserCalls,1);assert.deepEqual(fs.readdirSync(leaseRoot),[]);
    assert.throws(()=>authorizeToolCall({toolName:'browser'},{workspace:cwd,allowedTools:['browser'],readOnly:true}),/READ_ONLY/);
    const incomplete=await runTool(f,'codemode',{code:'text(await tools.browser({action:"open"}));'});assert.match(resultText(incomplete),/ARGUMENT_REQUIRED/);assert.equal(browserCalls,1);
    assert.equal(cfg.features.brain,false);assert.equal(f.errors.length,0);
  }finally{await services.close();await harness.getSupervisor().shutdown();f.dispose();fs.rmSync(cwd,{recursive:true,force:true});}
  assert.ok(closed>0);
});

test('offline harness exposes honest web-unavailable errors without opening network',async()=>{
  let harness;
  const cfg=JSON.parse(fs.readFileSync(path.join(root,'config/harness.json'),'utf8'));cfg.ui.reasonTerminal=false;
  const f=await createFixtureSession({extensions:[pi=>{harness=registerHarness(pi,{config:cfg,allowSyntheticTurns:true,cwd:process.cwd()});}]});
  try{const result=await runTool(f,'codemode',{code:'text(await tools.web_search({query:"example"}));'});assert.match(resultText(result),/WEB_TOOLS_OFFLINE/);}
  finally{await harness.getSupervisor().shutdown();f.dispose();}
});
