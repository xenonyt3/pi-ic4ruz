import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {root} from '../../src/paths.mjs';
import {registerReasonUI} from '../../src/reason-ui.mjs';
import {sdk,ai} from '../../upstream-patches/transcript-hook/build/package/prototype-exports.mjs';
import {assistantMessage} from './session.mjs';

const directory=fs.mkdtempSync(path.join(root,'tests/.tmp/transcript-host-'));
const agentDir=path.join(directory,'agent'),sessions=path.join(directory,'sessions');
fs.mkdirSync(agentDir);fs.mkdirSync(sessions);
const model={id:'offline-model',name:'Offline fixture',provider:'fixture',api:'openai-completions',baseUrl:'http://127.0.0.1:9',reasoning:false,input:['text'],contextWindow:32768,maxTokens:1024,cost:{input:0,output:0,cacheRead:0,cacheWrite:0}};
const modelRuntime=await sdk.ModelRuntime.create({credentials:new ai.InMemoryCredentialStore(),modelsPath:null,modelsStorePath:path.join(agentDir,'models-store.json'),allowModelNetwork:false,refreshOnCreate:false});
modelRuntime.hasConfiguredAuth=()=>true;modelRuntime.getAuth=async()=>({auth:{apiKey:'offline-synthetic'},env:{}});
modelRuntime.streamSimple=()=>{throw Error('UNEXPECTED_MODEL_REQUEST');};
let binding,enabled=true;
const factory=async({sessionManager,sessionStartEvent})=>{
  const settingsManager=sdk.SettingsManager.inMemory({packages:[],defaultTools:['read'],hideThinkingBlock:true,cacheWarming:'off',retry:{enabled:false},compaction:{enabled:false},enableAnalytics:false,enableInstallTelemetry:false,quietStartup:true,theme:'dark'});
  const services=await sdk.createAgentSessionServices({cwd:directory,agentDir,settingsManager,modelRuntime,
    resourceLoaderOptions:{noExtensions:true,noSkills:true,noPromptTemplates:true,noThemes:true,noContextFiles:true,systemPromptOverride:()=>'',appendSystemPromptOverride:()=>[],extensionFactories:[pi=>{
      if(!enabled)return;
      registerReasonUI(pi,{cwd:directory});
      pi.on('session_start',(_event,ctx)=>{
        assert.equal(ctx.mode,'tui');assert.equal(typeof ctx.ui.setUserMessageRenderer,'function');binding=ctx.ui;
        assert.equal(typeof ctx.ui.setAssistantTextRenderer,'function');
        assert.equal(typeof ctx.ui.setThinkingRenderer,'function');
      });
    }]}});
  const created=await sdk.createAgentSessionFromServices({services,sessionManager,sessionStartEvent,model,thinkingLevel:'off'});
  return{...created,services,diagnostics:[]};
};
const manager=sdk.SessionManager.create(directory,sessions);
manager.appendModelChange(model.provider,model.id);
manager.appendMessage({role:'user',content:'Preserve **literal** and `code`.',timestamp:Date.now()});
manager.appendMessage(assistantMessage([{type:'thinking',thinking:'**Restore the contract**\nRetain signed fixture detail.',thinkingSignature:'opaque-fixture'},{type:'text',text:'    const restored = 42;\n    return restored;'}]));
const sessionFile=manager.getSessionFile();
const runtime=await sdk.createAgentSessionRuntime(factory,{cwd:directory,agentDir,sessionManager:manager});
const output=[];
const terminal={columns:80,rows:24,kittyProtocolActive:false,start(){},stop(){},drainInput:async()=>{},write:data=>output.push(data),moveBy(){},hideCursor(){},showCursor(){},clearLine(){},clearFromCursor(){},clearScreen(){},setTitle(){},setProgress(){}};
const mode=new sdk.InteractiveMode(runtime,{terminal,tuiMode:'fullscreen'});
let receipt;
try{
  const before=JSON.stringify(runtime.session.messages);
  await mode.init();
  mode.ui.renderNow(true);
  assert.match(output.join(''),/\*\*literal\*\*/);
  assert.match(output.join(''),/\u203a/);
  assert.equal(JSON.stringify(runtime.session.messages),before);
  assert.match(output.join(''),/```/);
  assert.match(output.join(''),/Thinking: Restore the contract/);
  mode.toggleThinkingBlockVisibility();mode.ui.renderNow(true);
  assert.equal(mode.hideThinkingBlock,false);assert.match(output.join(''),/Retain signed fixture detail/);
  mode.toggleThinkingBlockVisibility();mode.ui.renderNow(true);assert.equal(mode.hideThinkingBlock,true);
  assert.equal(JSON.stringify(runtime.session.messages),before);
  const streamFrames=[],thinkingFrames=[];
  const stopWatching=runtime.session.subscribe(event=>{
    if(event.type==='message_update'&&event.assistantMessageEvent?.type==='text_delta'){
      mode.ui.renderNow(true);streamFrames.push(mode.streamingComponent.render(80));
    }
    if(event.type==='message_update'&&event.assistantMessageEvent?.type==='thinking_delta'){
      mode.ui.renderNow(true);thinkingFrames.push(mode.streamingComponent.render(80));
    }
  });
  runtime.session.agent.streamFunction=()=>{
    const stream=new ai.AssistantMessageEventStream();
    const emit=async()=>{
      let text='',thinking='';
      const partial=()=>assistantMessage([{type:'thinking',thinking,thinkingSignature:'stream-fixture'},{type:'text',text}],{stopReason:'stop'});
      stream.push({type:'start',partial:partial()});
      stream.push({type:'thinking_start',contentIndex:0,partial:partial()});
      for(const delta of ['Inspect the contract.','\n**Latest stream decision**']){
        await new Promise(resolve=>setImmediate(resolve));thinking+=delta;
        stream.push({type:'thinking_delta',contentIndex:0,delta,partial:partial()});
      }
      stream.push({type:'thinking_end',contentIndex:0,content:thinking,partial:partial()});
      stream.push({type:'text_start',contentIndex:1,partial:partial()});
      for(const delta of ['    const streamed = 42;','\n    return streamed;']){
        await new Promise(resolve=>setImmediate(resolve));text+=delta;
        stream.push({type:'text_delta',contentIndex:1,delta,partial:partial()});
      }
      stream.push({type:'text_end',contentIndex:1,content:text,partial:partial()});
      stream.push({type:'done',reason:'stop',message:partial()});
    };
    void emit().catch(error=>{stream.push({type:'error',reason:'error',error:assistantMessage([],{stopReason:'error',errorMessage:String(error)})});});
    return stream;
  };
  await runtime.session.prompt('Offline stream fixture; preserve indentation.');
  stopWatching();mode.ui.renderNow(true);
  assert.equal(streamFrames.length,2);assert.match(streamFrames.at(-1).join('\n'),/```/);
  assert.equal(thinkingFrames.length,2);assert.match(thinkingFrames.at(-1).join('\n'),/Thinking: Latest stream decision/);
  assert.ok(runtime.session.messages.some(message=>message.role==='assistant'&&message.content.some(block=>block.type==='text'&&block.text==='    const streamed = 42;\n    return streamed;')));
  const messages=JSON.stringify(runtime.session.messages);
  binding.setUserMessageRenderer(()=>{throw Error('fixture renderer failure');});
  mode.ui.renderNow(true);await new Promise(resolve=>setImmediate(resolve));mode.ui.renderNow(true);
  assert.equal(mode.userMessageRenderer,undefined);
  assert.equal(JSON.stringify(runtime.session.messages),messages);
  assert.match(output.join(''),/restored stock Pi rendering/);
  binding.setAssistantTextRenderer(()=>{throw Error('fixture assistant failure');});
  mode.ui.renderNow(true);await new Promise(resolve=>setImmediate(resolve));mode.ui.renderNow(true);
  assert.equal(mode.assistantTextRenderer,undefined);
  assert.equal(JSON.stringify(runtime.session.messages),messages);
  assert.match(output.join(''),/Assistant-text renderer failed/);
  binding.setThinkingRenderer(()=>{throw Error('fixture thinking failure');});
  mode.ui.renderNow(true);await new Promise(resolve=>setImmediate(resolve));mode.ui.renderNow(true);
  assert.equal(mode.thinkingRenderer,undefined);assert.equal(JSON.stringify(runtime.session.messages),messages);
  assert.match(output.join(''),/Thinking renderer failed/);
  binding.setUserMessageRenderer(text=>[text]);mode.resetExtensionUI();
  assert.equal(mode.userMessageRenderer,undefined);
  assert.equal(mode.assistantTextRenderer,undefined);
  assert.equal(mode.thinkingRenderer,undefined);
  const switched=await runtime.switchSession(sessionFile);
  assert.equal(switched.cancelled,false);
  mode.ui.renderNow(true);assert.equal(typeof mode.userMessageRenderer,'function');
  assert.equal(typeof mode.assistantTextRenderer,'function');
  assert.equal(typeof mode.thinkingRenderer,'function');
  assert.equal(runtime.session.messages.find(message=>message.role==='user').content,'Preserve **literal** and `code`.');
  const userEntry=runtime.session.sessionManager.getEntries().find(entry=>entry.type==='message'&&entry.message.role==='user');
  const forked=await runtime.fork(userEntry.id,{position:'at'});assert.equal(forked.cancelled,false);
  assert.equal(typeof mode.userMessageRenderer,'function');
  assert.equal(typeof mode.assistantTextRenderer,'function');
  assert.equal(typeof mode.thinkingRenderer,'function');
  assert.equal(runtime.session.messages.find(message=>message.role==='user').content,'Preserve **literal** and `code`.');
  enabled=false;await mode.handleReloadCommand();assert.equal(mode.userMessageRenderer,undefined);assert.equal(mode.assistantTextRenderer,undefined);assert.equal(mode.thinkingRenderer,undefined);
  enabled=true;await mode.handleReloadCommand();assert.equal(typeof mode.userMessageRenderer,'function');assert.equal(typeof mode.assistantTextRenderer,'function');assert.equal(typeof mode.thinkingRenderer,'function');
  receipt={transcriptUnchanged:true,fallback:true,reset:true,resumed:true,forked:true,reloaded:true,assistantHook:true,streamDeltas:streamFrames.length,assistantFallback:true,thinkingHook:true,thinkingDeltas:thinkingFrames.length,thinkingFallback:true,thinkingToggle:true,network:'disabled'};
}finally{
  await runtime.dispose();
  mode.ui.stop();mode.footerDataProvider.dispose();mode.themeController.dispose?.();
}
console.log('TRANSCRIPT_HOST_PASS:'+JSON.stringify(receipt));
