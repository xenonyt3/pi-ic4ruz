import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {root} from '../../src/paths.mjs';
import {sdk,ai,runtimeLabel} from '../../src/upstream.mjs';
import {tui} from '../../src/ui-runtime.mjs';
import {registerReasonUI} from '../../src/reason-ui.mjs';
import {assistantMessage,fixtureModel as model} from './session.mjs';
import {sourceOracle} from './ui.mjs';

export const layoutCases=[
  ['consecutive tools',[{type:'toolCall',id:'a',name:'read',arguments:{path:'alpha.txt'}},{type:'toolCall',id:'b',name:'read',arguments:{path:'beta.txt'}}]],
  ['text tool text',[{type:'text',text:'Before tool.'},{type:'toolCall',id:'a',name:'read',arguments:{path:'alpha.txt'}},{type:'text',text:'After tool.'}]],
  ['thinking tool text',[{type:'thinking',thinking:'**Inspect CAF\u00c9**',thinkingSignature:'opaque-fixture'},{type:'toolCall',id:'a',name:'read',arguments:{path:'alpha.txt'}},{type:'text',text:'After tool.'}]],
  ['text text thinking',[{type:'text',text:'First block.'},{type:'text',text:'Second block.'},{type:'thinking',thinking:'**Next step**'}]],
  ['interleaved tools',[{type:'toolCall',id:'a',name:'read',arguments:{path:'alpha.txt'}},{type:'text',text:'Between tools.'},{type:'toolCall',id:'b',name:'read',arguments:{path:'beta.txt'}}]],
  ['empty blocks',[{type:'text',text:'  '},{type:'toolCall',id:'a',name:'read',arguments:{path:'alpha.txt'}},{type:'thinking',thinking:'  '},{type:'toolCall',id:'b',name:'read',arguments:{path:'beta.txt'}}]],
];
export const stripZones=lines=>lines.map(line=>line.replace(/\x1b\]133;[ABC]\x07/g,''));
export function expectedRows(content,width,expanded=false,oracle=sourceOracle()){
  const display={reasoning:expanded,toolOutput:false};
  const entries=[{kind:'user',key:'user',text:'Inspect **literal** CAF\u00c9.'},...content.flatMap((block,index)=>{
    if(block.type==='toolCall')return [{kind:'tool',key:block.id,tool:block.name,invocation:block.arguments.path,state:'done',output:'fixture success'}];
    const text=block.text??block.thinking;if(!text?.trim())return [];
    return [{kind:block.type==='text'?'assistant':'reasoning',key:String(index),text}];
  })];
  return oracle.compose(entries,width,oracle.theme,display);
}

export async function createLayoutHost(){
  const directory=fs.mkdtempSync(path.join(root,'tests/.tmp/layout-host-')),agentDir=path.join(directory,'agent');fs.mkdirSync(agentDir);
  const modelRuntime=await sdk.ModelRuntime.create({credentials:new ai.InMemoryCredentialStore(),modelsPath:null,modelsStorePath:path.join(agentDir,'models-store.json'),allowModelNetwork:false,refreshOnCreate:false});
  modelRuntime.hasConfiguredAuth=()=>true;modelRuntime.getAuth=async()=>({auth:{apiKey:'offline-synthetic'},env:{}});modelRuntime.streamSimple=()=>{throw Error('UNEXPECTED_MODEL_REQUEST');};
  let ui,binding;
  const factory=async({sessionManager,sessionStartEvent})=>{
    const settingsManager=sdk.SettingsManager.inMemory({packages:[],defaultTools:['read'],hideThinkingBlock:true,cacheWarming:'off',retry:{enabled:false},compaction:{enabled:false},enableAnalytics:false,enableInstallTelemetry:false,quietStartup:true,theme:'dark'});
    const services=await sdk.createAgentSessionServices({cwd:directory,agentDir,settingsManager,modelRuntime,resourceLoaderOptions:{noExtensions:true,noSkills:true,noPromptTemplates:true,noThemes:true,noContextFiles:true,systemPromptOverride:()=>'',appendSystemPromptOverride:()=>[],extensionFactories:[pi=>{
      binding=registerReasonUI(pi,{cwd:directory,offline:false});pi.on('session_start',(_event,ctx)=>{ui=ctx.ui;});
    }]}});
    return {...await sdk.createAgentSessionFromServices({services,sessionManager,sessionStartEvent,model,thinkingLevel:'off'}),services,diagnostics:[]};
  };
  const manager=sdk.SessionManager.create(directory,path.join(directory,'sessions'));
  const runtime=await sdk.createAgentSessionRuntime(factory,{cwd:directory,agentDir,sessionManager:manager});
  const terminal={columns:120,rows:40,kittyProtocolActive:false,start(){},stop(){},drainInput:async()=>{},write(){},moveBy(){},hideCursor(){},showCursor(){},clearLine(){},clearFromCursor(){},clearScreen(){},setTitle(){},setProgress(){}};
  const mode=new sdk.InteractiveMode(runtime,{terminal,tuiMode:'fullscreen'});await mode.init();
  return {mode,runtime,terminal,get ui(){return ui;},get binding(){return binding;},
    render(content,width,stopReason='toolUse'){
      const user={role:'user',content:'Inspect **literal** CAF\u00c9.',timestamp:0};
      const assistant=assistantMessage(content,{stopReason});
      const results=content.filter(block=>block.type==='toolCall').map(block=>({role:'toolResult',toolCallId:block.id,toolName:block.name,content:[{type:'text',text:'fixture success'}],isError:false,timestamp:0}));
      const messages=[user,assistant,...results],before=JSON.stringify(messages);
      mode.chatContainer.clear();mode.renderSessionItems(messages);
      const lines=stripZones(mode.chatContainer.render(width));assert.equal(JSON.stringify(messages),before);
      return {lines,messages};
    },
    async dispose(){await runtime.dispose();mode.ui.stop();mode.footerDataProvider.dispose();mode.themeController.dispose?.();}
  };
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const host=await createLayoutHost(),cases=[];
  try{
    for(const [name,content] of layoutCases)for(const width of [80,120]){
      const actual=host.render(content,width).lines,expected=expectedRows(content,width);
      cases.push({name,width,matched:JSON.stringify(actual.map(tui.stripTerminalSequences))===JSON.stringify(expected.map(tui.stripTerminalSequences)),actual:actual.map(tui.stripTerminalSequences),expected:expected.map(tui.stripTerminalSequences)});
    }
  }finally{await host.dispose();}
  const file=path.join(root,`upstream-patches/transcript-hook/${process.argv.includes('--verify')?'layout-parity':'layout-gap'}.json`);
  fs.writeFileSync(file,JSON.stringify({runtime:runtimeLabel,kind:'actual-Pi-InteractiveMode-vs-Reason-source-layout-gap',cases},null,2));
  console.log(JSON.stringify({file,cases:cases.length,matched:cases.filter(row=>row.matched).length}));
}
