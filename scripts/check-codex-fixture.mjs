import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {root} from '../src/paths.mjs';
import {runCodexCell,verifyCodexExecutable} from '../src/codex-evaluation.mjs';
import {buildBehaviorPlan} from '../src/behavior-plan.mjs';
import {createBehaviorWorkspace,loadBehaviorCorpus} from '../src/behavior-corpus.mjs';
import {validateLiveConfig} from '../src/live-config.mjs';
import {responsesFixture} from '../tests/helpers/responses-fixture.mjs';
import {installLiveNetworkGuard} from '../src/live-network-guard.mjs';
import {runBehaviorCampaign} from '../src/behavior-evaluation.mjs';
import {sse} from '../tests/helpers/live-fixture.mjs';
import {assertIsolation} from '../launch.mjs';
import {auditBaseline} from './audit-baseline.mjs';

if(process.argv.length!==4||process.argv[2]!=='--codex')throw Error('CODEX_FIXTURE_ARGUMENTS');
const executable=path.resolve(process.argv[3]),pin=verifyCodexExecutable(executable),plan=buildBehaviorPlan({comparison:'codex'});
const base=path.join(root,'tests/.tmp');fs.mkdirSync(base,{recursive:true});
const directory=fs.mkdtempSync(path.join(base,'codex-native-'));
const config={schemaVersion:1,mode:'interactive-live',provider:'9router',api:'openai-completions',baseUrl:'http://127.0.0.1:9/v1',model:plan.model.model,models:[plan.model.model],responseModels:[plan.model.model],thinkingLevel:'low',contextWindow:32768,credentialEnv:'FIXTURE_KEY'};
const checks=[];
const {listenLoopback}=installLiveNetworkGuard();
// Provider traffic is exclusively the injected synthetic stream; no credential is loaded.
for(const scenario of ['stream-tool','wrong-model','missing-usage','cancel','cancel-tool']){
  const workspace=path.join(directory,scenario,'workspace'),control=path.join(directory,scenario,'control');
  createBehaviorWorkspace(loadBehaviorCorpus().tasks[0],workspace);
  const resolved=validateLiveConfig({...config,budget:{...plan.perRun,maxDurationMs:60000,allowanceId:'fixture-'+scenario,authorized:true}},{cwd:workspace,env:{FIXTURE_KEY:'synthetic-upstream-secret'}});
  let requests=0,toolOutput=false;const controller=new AbortController();
  const result=await runCodexCell({...resolved,config:{...config,prompt:'Read the local package.json and report the project name.'},directory:control,executable,signal:controller.signal,onEvent:event=>{
    if(scenario==='cancel-tool'&&event.type==='item.started'&&event.item?.type==='command_execution')setTimeout(()=>controller.abort(),300);
  },fetchImpl:Object.assign(async(url,init)=>{
    assert.equal(url,'http://127.0.0.1:9/v1/responses');assert.equal(init.headers.Authorization,'Bearer synthetic-upstream-secret');
    const body=JSON.parse(init.body);requests++;assert.equal(body.model,config.model);assert.equal(body.reasoning.effort,'low');assert.equal(body.max_output_tokens,2000);
    if(scenario==='cancel'){
      setTimeout(()=>controller.abort(),100);
      return new Response(new ReadableStream({start(c){init.signal.addEventListener('abort',()=>c.error(Error('fixture cancelled')),{once:true});}}));
    }
    if(scenario==='wrong-model')return responsesFixture({model:'unapproved'});
    if(scenario==='missing-usage')return responsesFixture({usage:null});
    fs.writeFileSync(path.join(control,`request-${requests}.json`),JSON.stringify(body,null,2));
    if(requests===1){
      const namespaces=body.input.filter(item=>item.type==='additional_tools').flatMap(item=>item.tools);
      assert.ok(!namespaces.some(tool=>tool.name==='collaboration'),'single-agent policy');
      assert.ok(namespaces.find(tool=>tool.name==='functions')?.tools.some(tool=>tool.name==='exec'),'native tool dispatcher exposed');
      const cmd=scenario==='cancel-tool'?'Start-Sleep -Seconds 60':"if ($env:CODEX_BENCHMARK_TOKEN -or $env:FIXTURE_KEY) { throw 'credential inherited' }; Set-Content -Path fixture.txt -Value 'fixture-written'; Get-Content package.json";
      return responsesFixture({tool:{custom:true,namespace:'functions',name:'exec',input:`text(await tools.exec_command(${JSON.stringify({cmd,max_output_tokens:500,yield_time_ms:1000})}));`}});
    }
    toolOutput=body.input.some(item=>['function_call_output','custom_tool_call_output'].includes(item.type)&&JSON.stringify(item.output).includes('name'));
    return responsesFixture();
  },{listenLoopback})});
  const check={scenario,requests,cleanupConfirmed:result.cleanupConfirmed,stopReason:result.gate.state.stopReason??null,modelStopReason:result.modelStopReason,toolOutput,error:result.failure??null};
  checks.push(check);console.log(JSON.stringify(check));
  assert.ok(result.cleanupConfirmed,`cleanup ${scenario}; inspect ${control}`);
  if(scenario==='stream-tool'){assert.equal(result.modelStopReason,'stop');assert.equal(requests,2);assert.ok(toolOutput);assert.equal(result.failure,undefined);assert.equal(fs.readFileSync(path.join(workspace,'fixture.txt'),'utf8').trim(),'fixture-written');}
  else {assert.ok(result.gate.state.stopReason);assert.equal(requests,1);}
}
assert.ok(auditBaseline().passed);assertIsolation(undefined,path.join(root,'workspace'));
let current,queue,cellRequests=0;
const tasks=loadBehaviorCorpus().tasks,campaignId='fixture-codex-'+Date.now();
const scripted=Object.assign(async(url,init)=>{
  const body=JSON.parse(init.body);cellRequests++;
  if(current.condition==='codex'){
    assert.ok(url.endsWith('/responses'));
    if(cellRequests>1)return responsesFixture();
    const task=tasks.find(task=>task.id===current.taskId);
    const code=`const fs=require('fs');for(const [file,text] of Object.entries(${JSON.stringify(task.referenceChanges)}))fs.writeFileSync(file,text);const env={...process.env};delete env.NODE_TEST_CONTEXT;const r=require('child_process').spawnSync(process.execPath,['--test'],{env,encoding:'utf8'});console.log(r.stdout);if(r.status!==0)process.exit(1);`;
    const cmd=`node -e "eval(Buffer.from('${Buffer.from(code).toString('base64')}','base64').toString())"`;
    return responsesFixture({tool:{custom:true,namespace:'functions',name:'exec',input:`text(await tools.exec_command(${JSON.stringify({cmd,max_output_tokens:1000,yield_time_ms:10000})}));`}});
  }
  assert.ok(url.endsWith('/chat/completions'));
  const tool=queue.shift();return sse({model:config.model,...(tool?{tool}:{text:'Synthetic reference changes applied.'})});
},{listenLoopback});
const campaign=await runBehaviorCampaign({config,comparison:'codex',codexExecutable:executable,
  approval:{schemaVersion:1,authorized:true,campaignId,protocolHash:plan.protocolHash,...plan.limits},env:{FIXTURE_KEY:'synthetic-upstream-secret'},fetchImpl:scripted,
  onProgress:event=>{
    if(event.phase==='start'){current=plan.jobs.find(job=>job.id===event.job);cellRequests=0;queue=Object.entries(tasks.find(task=>task.id===current.taskId).referenceChanges).map(([file,content])=>({name:'write',args:{path:file,content}}));}
    else console.log(JSON.stringify(event));
  }});
assert.equal(campaign.state.status,'finished',JSON.stringify(campaign.state.jobs.map(job=>({id:job.id,error:job.error,stop:job.budgetStop,cleanup:job.cleanupConfirmed}))));
assert.equal(campaign.state.allTasksCorrect,true);
assert.ok(campaign.state.jobs.every(job=>job.childRequests===0&&job.cleanupConfirmed));
assert.ok(campaign.state.jobs.filter(job=>job.condition==='prototype').every(job=>!job.callableTools.includes('agents_spawn')));
const before=campaign.state.usage.requests;
await assert.rejects(runBehaviorCampaign({config,comparison:'codex',codexExecutable:executable,approval:campaign.state.approval,env:{FIXTURE_KEY:'synthetic-upstream-secret'},fetchImpl:()=>{throw Error('MUST_NOT_REPLAY');}}),/CAMPAIGN_EXISTS/);
const receipt={schemaVersion:1,passed:true,createdAt:new Date().toISOString(),protocolHash:plan.protocolHash,codex:pin,checks,
  syntheticCampaign:{cells:12,correct:12,requests:before,replayRejected:true,delegationDisabled:true,humanReviewComplete:false},
  externalInference:0,scope:'Native Codex and Pi with scripted reference edits and synthetic streams; verifies plumbing, not model decisions or paid 9router compatibility'};
fs.writeFileSync(path.join(root,'artifacts/checkpoint/codex-native-fixture.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({passed:true,externalInference:0,privateFixtureDirectory:directory}));
