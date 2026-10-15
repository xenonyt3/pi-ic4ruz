import test from 'node:test';
import assert from 'node:assert/strict';
import {sdk} from '../src/upstream.mjs';
import {tui} from '../src/ui-runtime.mjs';
import {createReasonTheme,editorSurface,ReasonEditor,renderToolHeader,renderFooter,wrapToolPresentation,registerReasonUI} from '../src/reason-ui.mjs';
import {baseTheme,sourceOracle,host,renderContext} from './helpers/ui.mjs';
import {createFixtureSession,runTool,resultText,assistantMessage,messageStream} from './helpers/session.mjs';
import {registerHarness} from '../src/harness.ts';
const theme=createReasonTheme(baseTheme());
const plain=lines=>tui.stripTerminalSequences(lines.join('\n'));

function recordingUI({query=async()=>({})}={}) {
  const keys=new tui.KeybindingsManager({...tui.TUI_KEYBINDINGS,'app.interrupt':{defaultKeys:'escape'},'app.exit':{defaultKeys:'ctrl+d'},'app.tools.expand':{defaultKeys:'ctrl+o'}});
  const components={},statuses=new Map(),working=[],frames=[];let current=baseTheme(),colorListener;
  const runtime={...host,queryTerminalColors:query,onTerminalColorSchemeChange:listener=>{colorListener=listener;return()=>{colorListener=undefined;};},requestRender(){if(components.footer)frames.push(plain(components.footer.render(80)));}};
  const editorTheme={borderColor:s=>current.fg('muted',s),selectList:{selectedPrefix:s=>s,selectedText:s=>s,description:s=>s,scrollInfo:s=>s,noMatch:s=>s}};
  const ui={get theme(){return current;},setTheme:theme=>{current=theme;return{success:true};},
    setHeader:factory=>{components.header?.dispose?.();components.header=factory?.(runtime,current);},
    setEditorComponent:factory=>{components.editor=factory?.(runtime,editorTheme,keys);},
    setFooter:factory=>{components.footer=factory?.(runtime,current,{getExtensionStatuses:()=>statuses,onBranchChange:()=>()=>{}});},
    setWorkingMessage:message=>working.push(message),setWorkingIndicator(){},setHiddenThinkingLabel(){},notify(){},setStatus:(key,value)=>statuses.set(key,value)};
  return {ui,components,working,frames,runtime,getTheme:()=>current,hasColorListener:()=>!!colorListener};
}

test('O14 slice: compact tool headers match the extracted 0.2.269 source oracle',()=>{
  const oracle=sourceOracle();
  for(const width of [12,80,120])for(const status of ['running','done','failed','stopped']){
    const entry={kind:'tool',key:'x',tool:'read',invocation:'src/normalize.mjs',state:status,output:''};
    const expected=new oracle.Row(entry,oracle.theme,{toolOutput:false,reasoning:false},true).render(width)[0];
    assert.equal(renderToolHeader({name:'read',args:{path:entry.invocation},status},theme,width),expected);
  }
});
test('O14 slice: failure tail stays visible, expansion restores full output, execution identity is unchanged',()=>{
  const execute=async()=>{},definition={name:'bash',execute,parameters:{},renderResult:result=>new tui.Text(result.content[0].text,0,0)};
  const wrapped=wrapToolPresentation(definition),context=renderContext({}, {isError:true});
  assert.equal(wrapped.execute,execute);assert.equal(wrapped.parameters,definition.parameters);
  const result={content:[{type:'text',text:Array.from({length:12},(_,i)=>`line ${i}`).join('\n')}]};
  const short=plain(wrapped.renderResult(result,{expanded:false,isPartial:false},theme,context).render(80));
  assert.match(short,/8 earlier lines/);assert.match(short,/line 11/);
  const expanded=plain(wrapped.renderResult(result,{expanded:true,isPartial:false},theme,context).render(80));
  assert.match(expanded,/line 0\s*\n/);assert.match(expanded,/line 11/);
});
test('O14 slice: upstream editor preserves multiline, Unicode, bracketed paste, cancel and exit across resize',()=>{
  const keys=new tui.KeybindingsManager({...tui.TUI_KEYBINDINGS,'app.interrupt':{defaultKeys:'escape'},'app.exit':{defaultKeys:'ctrl+d'},'app.tools.expand':{defaultKeys:'ctrl+o'}});
  tui.setKeybindings(keys);
  const editorTheme={borderColor:s=>s,selectList:{selectedPrefix:s=>s,selectedText:s=>s,description:s=>s,scrollInfo:s=>s,noMatch:s=>s}};
  const editor=new ReasonEditor(host,editorTheme,keys);editor.focused=true;
  editor.setPaddingX(0); // The host copies its default padding after creating custom editors.
  editor.handleInput('\u001b[200~first\nCAF\u00c9\u001b[201~');
  assert.match(editor.getText(),/first\nCAF/);
  for(const width of [8,80,120])assert.ok(editor.render(width).every(line=>tui.visibleWidth(line)<=width));
  assert.match(plain(editor.render(80)),/\u203a/);
  let cancelled=false,exited=false;editor.onEscape=()=>{cancelled=true;};editor.onCtrlD=()=>{exited=true;};
  editor.handleInput('\u001b');assert.equal(cancelled,true);
  editor.setText('');editor.handleInput('\u0004');assert.equal(exited,true);
});
test('O14 slice: footer represents actual unknown usage, failed children and narrow paths without terminal injection',()=>{
  const state={model:'astra',provider:'9router',contextPercent:null,cwd:'D:/long/'.repeat(30)+'\u001b]0;bad\u0007',children:[{status:'failed',cleanupConfirmed:false}],statuses:['Brain unavailable']};
  const rendered=renderFooter(state,theme,80);
  assert.ok(rendered.every(line=>tui.visibleWidth(line)<=80));
  assert.match(plain(rendered),/context unknown/);assert.match(plain(rendered),/1 failed/);assert.match(plain(rendered),/cleanup pending/);
  assert.doesNotMatch(rendered.join(''),/\u001b\]/);
});
test('O14 slice: UI hooks restore stock presentation after a component failure and ignore RPC installation',()=>{
  const handlers=new Map(),factories={},calls=[];
  const pi={on:(name,fn)=>handlers.set(name,fn),registerTool(){}};
  const ui={theme:baseTheme(),setTheme:()=>({success:true}),notify:message=>calls.push(message)};
  for(const name of ['setHeader','setFooter','setEditorComponent','setWorkingIndicator','setWorkingMessage','setHiddenThinkingLabel'])ui[name]=value=>{factories[name]=value;calls.push(name);};
  const binding=registerReasonUI(pi,{cwd:'D:/fixture',getChildren:()=>{throw Error('bad renderer dependency');}});
  const ctx={mode:'rpc',ui,model:{id:'fixture',provider:'fixture'},getContextUsage:()=>undefined};
  handlers.get('session_start')({},ctx);assert.equal(calls.length,0);
  handlers.get('session_start')({}, {...ctx,mode:'tui'});
  const footer=factories.setFooter(host,theme,{onBranchChange:()=>()=>{},getExtensionStatuses:()=>new Map()});
  assert.deepEqual(footer.render(80),[]);assert.equal(binding.failed(),true);assert.equal(factories.setEditorComponent,undefined);
  assert.ok(calls.some(message=>message.includes('restored Pi presentation')));
});
test('O14 slice: long failure and status text retain their ending at 80 and 120 columns',()=>{
  const message='Failure at D:/'+('deep-path/'.repeat(18))+'target.mjs: release the writer lease before retrying.';
  for(const width of [80,120]){
    const wrapped=wrapToolPresentation({name:'bash'});
    const rendered=wrapped.renderResult({content:[{type:'text',text:message}]},{expanded:false,isPartial:false},theme,renderContext({}, {isError:true})).render(width);
    assert.ok(rendered.every(line=>tui.visibleWidth(line)<=width));
    assert.match(plain(rendered),/before\s+retrying\./);
    const footer=renderFooter({statuses:[message],children:[{status:'completed',cleanupConfirmed:true}]},theme,width);
    assert.match(plain(footer),/before\s+retrying\./);assert.match(plain(footer),/1 child completed/);
  }
});
test('O14 slice: theme retains the host constructor across SDK realms',()=>{
  class HostTheme extends sdk.Theme {}
  const base=baseTheme();const fg={},bg={};
  for(const [key,color] of Object.entries(base.colors))(key.endsWith('Bg')?bg:fg)[key]=tui.colorToHex(color);
  const hostTheme=new HostTheme(fg,bg,'256color',{appearance:'dark'});
  assert.ok(createReasonTheme(hostTheme) instanceof HostTheme);
});
test('O14 slice: real SDK tool policy and execution still work with presentation enabled',async()=>{
  const config={features:{brain:false},ui:{reasonTerminal:true},maxActiveChildren:3};
  const fixture=await createFixtureSession({extensions:[pi=>registerHarness(pi,{config,allowSyntheticTurns:true})]});
  try{
    assert.deepEqual(fixture.session.getActiveToolNames().sort(),['bash','codemode','edit','read','write']);
    const result=await runTool(fixture,'read',{path:'not-present.txt'});
    assert.equal(result.isError,true);assert.match(resultText(result),/ENOENT|not.*found|Could not/i);
    assert.equal(fixture.errors.length,0);
  }finally{fixture.dispose();}
});

test('O14 surface: measured dark/light colors match the extracted source; missing colors keep borders',()=>{
  for(const colors of [{background:{r:16,g:16,b:16},foreground:{r:240,g:240,b:240}},{background:{r:245,g:245,b:245},foreground:{r:20,g:20,b:20}}]){
    const oracle=sourceOracle();oracle.theme.setTerminalColors(colors);
    const surface=editorSurface(colors,{noColor:false});
    assert.equal(surface.paint('hello\x1b[0m world'),oracle.theme.surface()('hello\x1b[0m world'));
  }
  assert.equal(editorSurface({}),null);
  assert.equal(editorSurface({background:{r:999,g:0,b:0}},{noColor:false}),null);
  assert.equal(editorSurface({background:{r:0,g:0,b:0}},{noColor:true}),null);
});
test('O14 surface: editor text/cursor and fallback borders match source across 80/120 resize',()=>{
  const keys=new tui.KeybindingsManager(tui.TUI_KEYBINDINGS);
  for(const width of [80,120])for(const measured of [false,true]){
    const oracle=sourceOracle(),colors={background:{r:16,g:16,b:16},foreground:{r:240,g:240,b:240}};
    if(measured)oracle.theme.setTerminalColors(colors);
    const look={surface:()=>oracle.theme.surface(),muted:oracle.theme.muted,dim:oracle.theme.dim,marker:oracle.theme.accent};
    const reference=new oracle.Editor(host,oracle.theme.editor,look);
    const actual=new ReasonEditor(host,oracle.theme.editor,keys,{markerColor:oracle.theme.accent,getSurface:()=>measured?editorSurface(colors,{noColor:false}):null});
    for(const editor of [reference,actual]){editor.focused=true;editor.setText('first\nCAF\u00c9');}
    assert.deepEqual(actual.render(width),Array.from(reference.render(width)));
    assert.ok(actual.render(width).every(line=>tui.visibleWidth(line)<=width));
  }
});
test('O14 lifecycle: late color replies cannot mutate a shut down UI; unsupported query keeps fallback',async()=>{
  let late,resolve;const pending=new Promise(done=>{resolve=done;});
  const record=recordingUI({query:options=>{late=options.onLateReply;return pending;}}),handlers=new Map();
  const pi={on:(name,fn)=>handlers.set(name,fn),registerTool(){}};
  registerReasonUI(pi,{cwd:'D:/fixture'});
  handlers.get('session_start')({}, {mode:'tui',ui:record.ui,getContextUsage:()=>undefined});
  assert.equal(record.hasColorListener(),true);
  const before=record.getTheme();handlers.get('session_shutdown')();
  const light={background:{r:255,g:255,b:255},foreground:{r:0,g:0,b:0}};
  late(light);resolve(light);await pending;await Promise.resolve();
  assert.equal(record.getTheme(),before);assert.equal(record.hasColorListener(),false);
  const unsupported=recordingUI({query:()=>{throw Error('unsupported');}}),other=new Map();
  const binding=registerReasonUI({on:(name,fn)=>other.set(name,fn),registerTool(){}},{cwd:'D:/fixture'});
  other.get('session_start')({}, {mode:'tui',ui:unsupported.ui,getContextUsage:()=>undefined});
  assert.equal(binding.failed(),false);assert.match(plain(unsupported.components.editor.render(80)),/\u2500/);
  other.get('session_shutdown')();
});
test('O14 lifecycle: actual SDK tool/error/aborted events drive UI state without provider inference',async()=>{
  const record=recordingUI();
  const fixture=await createFixtureSession({mode:'tui',uiContext:record.ui,extensions:[pi=>registerReasonUI(pi,{cwd:process.cwd(),offline:false})]});
  try{
    const result=await runTool(fixture,'read',{path:'absent-ui-fixture.txt'});assert.equal(result.isError,true);
    assert.ok(record.working.includes('Running read'));
    for(const stopReason of ['error','aborted']){
      fixture.session.agent.streamFunction=()=>messageStream(assistantMessage([], {stopReason,errorMessage:stopReason==='error'?'fixture provider error':undefined}));
      await fixture.session.prompt('Synthetic terminal state fixture');
      assert.match(plain(record.components.footer.render(80)),new RegExp(stopReason==='aborted'?'cancelled':'error'));
    }
    assert.equal(fixture.errors.length,0);
  }finally{fixture.dispose();}
});
test('O14 lifecycle: overlapping tools, streamed writing and post-compaction unknown state stay honest',()=>{
  const record=recordingUI(),handlers=new Map();
  registerReasonUI({on:(name,fn)=>handlers.set(name,fn),registerTool(){}},{cwd:'D:/fixture',offline:false});
  const ctx={mode:'tui',ui:record.ui,model:{provider:'fixture',id:'model'},getContextUsage:()=>({percent:null})};
  const emit=(name,event={})=>handlers.get(name)(event,ctx);
  emit('session_start');emit('agent_start');
  emit('tool_execution_start',{toolCallId:'a',toolName:'read'});emit('tool_execution_start',{toolCallId:'b',toolName:'grep'});
  emit('tool_execution_end',{toolCallId:'a',toolName:'read',isError:false});assert.equal(record.working.at(-1),'Running grep');
  emit('tool_execution_end',{toolCallId:'b',toolName:'grep',isError:false});
  emit('message_update',{assistantMessageEvent:{type:'text_delta'}});assert.equal(record.working.at(-1),'Writing');
  emit('session_compact');assert.match(plain(record.components.footer.render(80)),/context unknown/);
  emit('session_shutdown');
});
test('O14 surface: real upstream TUI parses terminal color replies through its public query API',async()=>{
  let input;const output=[];
  const terminal={columns:80,rows:24,kittyProtocolActive:false,start:handler=>{input=handler;},stop(){},drainInput:async()=>{},moveBy(){},hideCursor(){},showCursor(){},clearLine(){},clearFromCursor(){},clearScreen(){},setTitle(){},setProgress(){},write(data){
    output.push(data);
    if(data.includes('\x1b]11;?'))queueMicrotask(()=>{
      input('\x1b]10;rgb:f0f0/f0f0/f0f0\x07');input('\x1b]11;rgb:1010/1010/1010\x07');input('\x1b[?1;2c');
    });
  }};
  const runtime=new tui.TuiAltScreen(terminal);
  runtime.start();
  try{
    const colors=await runtime.queryTerminalColors({timeoutMs:100});
    assert.deepEqual(colors.background,{r:16,g:16,b:16});assert.deepEqual(colors.foreground,{r:240,g:240,b:240});
    assert.ok(editorSurface(colors,{noColor:false}).fill.startsWith('\x1b[48;'));
  }finally{runtime.stop();}
});
