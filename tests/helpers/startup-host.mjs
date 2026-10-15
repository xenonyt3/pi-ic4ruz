import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {root} from '../../src/paths.mjs';
import {sdk,ai} from '../../src/upstream.mjs';
import {tui} from '../../src/ui-runtime.mjs';
import {registerReasonUI} from '../../src/reason-ui.mjs';
import {assistantMessage,fixtureModel as model} from './session.mjs';

const native=process.argv.includes('--native'),tick=native?650:20;
const directory=fs.mkdtempSync(path.join(root,'tests/.tmp/startup-host-'));
const agentDir=path.join(directory,'agent');fs.mkdirSync(agentDir);
const receiptPath=native?path.join(root,'artifacts/ui-replay/startup-native-host.json'):null;
fs.writeFileSync(path.join(directory,'unicode.txt'),'CAF\u00c9 offline fixture');
const modelRuntime=await sdk.ModelRuntime.create({credentials:new ai.InMemoryCredentialStore(),modelsPath:null,modelsStorePath:path.join(agentDir,'models-store.json'),allowModelNetwork:false,refreshOnCreate:false});
modelRuntime.hasConfiguredAuth=()=>true;modelRuntime.getAuth=async()=>({auth:{apiKey:'offline-synthetic'},env:{}});
modelRuntime.streamSimple=()=>{throw Error('UNEXPECTED_MODEL_REQUEST');};
const timers=new Set(),clock={now:()=>Date.now(),setInterval:(fn,ms)=>{const timer=setInterval(fn,ms);timers.add(timer);return timer;},clearInterval:timer=>{timers.delete(timer);clearInterval(timer);}};
let binding;
const factory=async({sessionManager,sessionStartEvent})=>{
  const settingsManager=sdk.SettingsManager.inMemory({packages:[],defaultTools:['read'],hideThinkingBlock:true,cacheWarming:'off',retry:{enabled:false},compaction:{enabled:false},enableAnalytics:false,enableInstallTelemetry:false,quietStartup:true,theme:'dark'});
  const services=await sdk.createAgentSessionServices({cwd:directory,agentDir,settingsManager,modelRuntime,
    resourceLoaderOptions:{noExtensions:true,noSkills:true,noPromptTemplates:true,noThemes:true,noContextFiles:true,systemPromptOverride:()=>'',appendSystemPromptOverride:()=>[],extensionFactories:[pi=>{
      binding=registerReasonUI(pi,{cwd:directory,offline:false,clock});
      pi.registerTool({...sdk.createReadToolDefinition(directory),execute:async(id,args,signal)=>{
        await delay(tick*2,undefined,{signal});return {content:[{type:'text',text:'CAF\u00c9 offline fixture'}]};
      }});
    }]}});
  return {...await sdk.createAgentSessionFromServices({services,sessionManager,sessionStartEvent,model,thinkingLevel:'off'}),services,diagnostics:[]};
};
const runtime=await sdk.createAgentSessionRuntime(factory,{cwd:directory,agentDir,sessionManager:sdk.SessionManager.inMemory(directory)});
const output=[],terminal={columns:120,rows:40,kittyProtocolActive:false,start(){},stop(){},drainInput:async()=>{},write:data=>output.push(data),moveBy(){},hideCursor(){},showCursor(){},clearLine(){},clearFromCursor(){},clearScreen(){},setTitle(){},setProgress(){}};
const mode=new sdk.InteractiveMode(runtime,{...(native?{}:{terminal}),tuiMode:'fullscreen'});
const frames=[],events=[];
const row=()=>mode.extensionWidgetsAbove.get('prototype-working');
function capture(stage){
  mode.ui.renderNow(true);
  const lines=row()?.render(mode.ui.terminal.columns)??[];
  const frame={stage,columns:mode.ui.terminal.columns,rows:mode.ui.terminal.rows,lines,plain:tui.stripTerminalSequences(lines.join('\n')),timers:timers.size};
  frames.push(frame);
  if(native)fs.writeFileSync(path.join(root,'artifacts/ui-replay/startup-native-progress.json'),JSON.stringify({pid:process.pid,stage,frames:frames.length}));
  return frame;
}
runtime.session.subscribe(event=>{events.push(event.type);});
let scenario='normal',round=0;
runtime.session.agent.streamFunction=(_model,_context,options)=>{
  const stream=new ai.AssistantMessageEventStream();
  void (async()=>{
    try{
      let content=[];
      const partial=()=>assistantMessage(structuredClone(content));
      stream.push({type:'start',partial:partial()});
      await delay(tick,undefined,{signal:options?.signal});capture('thinking');
      content=[{type:'thinking',thinking:'**Native fixture**\nInspect CAF\u00c9.'}];
      stream.push({type:'thinking_delta',contentIndex:0,delta:content[0].thinking,partial:partial()});
      await delay(tick,undefined,{signal:options?.signal});
      content.push({type:'text',text:'Offline Unicode: CAF\u00c9.'});
      stream.push({type:'text_delta',contentIndex:1,delta:content[1].text,partial:partial()});
      await delay(tick,undefined,{signal:options?.signal});capture('writing');
      if(scenario==='cancel'){
        capture('awaiting-cancel');
        if(!native)setTimeout(()=>runtime.session.abort(),20);
        await delay(15000,undefined,{signal:options?.signal});throw Error('NATIVE_CANCEL_TIMEOUT');
      }
      if(scenario==='error')throw Error('Synthetic provider error; no network');
      if(round++===0){
        content.push({type:'toolCall',id:'offline-read',name:'read',arguments:{path:'unicode.txt'}});
        setTimeout(()=>capture('tool'),Math.floor(tick/2));
      }
      stream.push({type:'done',reason:content.some(block=>block.type==='toolCall')?'toolUse':'stop',message:partial()});
    }catch(error){
      const reason=options?.signal?.aborted?'aborted':'error';
      stream.push({type:'error',reason,error:assistantMessage([],{stopReason:reason,errorMessage:String(error.message)})});
    }
  })();return stream;
};
let receipt;
try{
  await mode.init();capture('idle');assert.equal(mode.workingVisible,false);
  await delay(native?2700:1);
  for(scenario of ['normal','error','cancel']){
    round=0;await runtime.session.prompt(`Offline ${scenario} fixture`);
    const ended=capture(scenario);assert.deepEqual(ended.lines,[]);assert.equal(timers.size,0);
    const footer=tui.stripTerminalSequences(mode.customFooter.render(120).join('\n'));
    assert.match(footer,new RegExp(scenario==='normal'?'idle':scenario==='cancel'?'cancelled':'error'));
  }
  assert.ok(frames.some(frame=>frame.plain.includes('Thinking')));
  assert.ok(frames.some(frame=>frame.plain.includes('Writing')));
  assert.ok(frames.some(frame=>frame.plain.includes('Running read')));
  assert.equal(globalThis.__prototypeOfflineCounters.blockedNetworkAttempts,0);
  receipt={passed:true,native,modelRequests:0,timersAfterTurns:timers.size,frames,events,network:globalThis.__prototypeOfflineCounters};
  binding.restore();assert.equal(timers.size,0);assert.equal(mode.workingVisible,true);receipt.restore=true;
}finally{
  await runtime.dispose();assert.equal(timers.size,0);
  mode.ui.stop();mode.footerDataProvider.dispose();mode.themeController.dispose?.();
}
if(receiptPath)fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2));
console.log('STARTUP_HOST_PASS:'+JSON.stringify(receipt));
