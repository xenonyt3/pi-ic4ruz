import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {once} from 'node:events';
import {root} from '../src/paths.mjs';
import {createWebServices,loadWebConfig} from '../src/web-services.mjs';
import {installLiveNetworkGuard} from '../src/live-network-guard.mjs';
import {getOwnedProcessPids} from '../src/process-lifecycle.mjs';

const publicCheck=process.argv.includes('--public');
if(process.argv.slice(2).some(arg=>arg!=='--public'))throw new Error('WEB_VERIFY_ARGUMENT');
const directory=path.join(root,'artifacts/evaluations/web-tools',new Date().toISOString().replaceAll(':','-'));
const workspace=path.join(directory,'work');fs.mkdirSync(workspace,{recursive:true});
const page='<!doctype html><html><head><title>Pi OMP browser fixture</title></head><body><main><h1>Browser fixture</h1><button id="add" onclick="document.querySelector(\'#count\').textContent=String(++window.count)">Add item</button><p id="count">0</p><label>Name <input id="name" oninput="document.querySelector(\'#out\').textContent=this.value"></label><p id="out"></p><select id="theme"><option value="light">Light</option><option value="dark">Dark</option></select><a href="/second">Second page</a></main><script>window.count=0;console.log("fixture-ready");console.error("fixture-console-error");setTimeout(()=>{const p=document.createElement("p");p.id="ready";p.textContent="Ready";document.body.append(p)},100)</script></body></html>';
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(req.url==='/second'?'<html><body><h1>Second page</h1></body></html>':page);});
server.listen(0,'127.0.0.1');await once(server,'listening');
const origin=`http://127.0.0.1:${server.address().port}`;
const fetchImpl=installLiveNetworkGuard();
const config={...loadWebConfig(),localOrigins:[origin],timeoutMs:15000};
const service=createWebServices({config,fetchImpl,lookup:fetchImpl.lookup,workspace,directory});
const checks=[];let publicResults=null;let failure;
const call=async args=>JSON.parse((await service.run('browser',args)).text);
try {
  await assert.rejects(fetch(origin),/LIVE_UNBROKERED_NETWORK_DENIED/);checks.push('global-network-still-denied');
  const extract=await service.run('web_extract',{url:origin,selector:'main'});assert.match(extract.text,/Browser fixture/);checks.push('guarded-http-extraction');
  const open=await call({action:'open',url:origin});assert.match(open.snapshot,/Add item/);checks.push('native-open-omp-aria-snapshot');
  const ref=open.snapshot.match(/button "Add item"[^\n]*\[ref=(e\d+)\]/)?.[1];assert.ok(ref,open.snapshot);
  await call({action:'click',selector:`@${ref}`});
  assert.equal((await call({action:'evaluate',script:'document.querySelector("#count").textContent'})).result,'1');checks.push('aria-ref-click-and-page-evaluate');
  await call({action:'fill',selector:'#name',text:'Pi fixture'});
  assert.equal((await call({action:'evaluate',script:'document.querySelector("#out").textContent'})).result,'Pi fixture');checks.push('fill-input-events');
  await call({action:'select',selector:'#theme',values:['dark']});
  assert.equal((await call({action:'evaluate',script:'document.querySelector("#theme").value'})).result,'dark');checks.push('select-option');
  await call({action:'wait',selector:'#ready'});checks.push('wait-for-render');
  const consoleResult=await call({action:'console'});assert.ok(consoleResult.console.entries.some(entry=>entry.text==='fixture-console-error'));checks.push('omp-console-capture');
  await call({action:'resize',width:390,height:844});
  assert.equal((await call({action:'evaluate',script:'window.innerWidth'})).result,390);checks.push('mobile-viewport');
  const screenshot=await call({action:'screenshot',path:'fixture.png'});assert.ok(screenshot.bytes>100);assert.equal(fs.readFileSync(path.join(workspace,'fixture.png')).subarray(1,4).toString(),'PNG');checks.push('workspace-png-screenshot');
  const rendered=await call({action:'extract',selector:'main'});assert.match(rendered.markdown,/Pi fixture/);checks.push('rendered-extraction');
  await call({action:'open',url:origin+'/second',newTab:true});assert.equal((await call({action:'tabs'})).tabs.length,2);await call({action:'close_tab'});checks.push('tab-lifecycle');
  await assert.rejects(service.run('browser',{action:'screenshot',path:'../escape.png'}));assert.equal(fs.existsSync(path.join(directory,'escape.png')),false);checks.push('screenshot-path-denied-and-cleaned');
  await call({action:'open',url:origin});
  const controller=new AbortController();const pending=service.run('browser',{action:'evaluate',script:'new Promise(()=>{})'},controller.signal);const timer=setTimeout(()=>controller.abort(),150);
  await assert.rejects(pending,/CANCELLED/);clearTimeout(timer);assert.deepEqual(getOwnedProcessPids(),[]);checks.push('cancel-confirms-native-tree-exit');
  await call({action:'open',url:origin});await service.abort();assert.deepEqual(getOwnedProcessPids(),[]);checks.push('shutdown-confirms-native-tree-exit');
  if(publicCheck) {
    publicResults={};
    for(const [name,args] of [['web_search',{query:'Node.js documentation',limit:3}],['web_extract',{url:'https://example.com'}]]) {
      try{const result=await service.run(name,args);publicResults[name]={passed:true,details:result.details};if(name==='web_search')assert.ok(result.details.count>0);}
      catch(error){publicResults[name]={passed:false,reason:String(error.message).slice(0,200)};}
    }
  }
}catch(error){failure=String(error?.message??error).slice(0,1000);}
finally{try{await service.close();}catch(error){failure??=String(error?.message??error);}server.closeAllConnections();server.close();}
const passed=!failure&&(!publicResults||Object.values(publicResults).every(result=>result.passed));
const report={passed,nativePassed:!failure,checks,publicResults,failure,inferenceRequests:0,brain:false,ownedProcessesRemaining:getOwnedProcessPids(),directory};
fs.writeFileSync(path.join(directory,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));if(!passed)process.exitCode=1;
