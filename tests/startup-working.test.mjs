import test from 'node:test';
import assert from 'node:assert/strict';
import {shimmer,renderWorking,rasterBraille,piBitmap,piMark,piName,ReasonStartup,ReasonWorking,motion} from '../src/ui-startup.mjs';
import {registerReasonUI,ReasonEditor} from '../src/reason-ui.mjs';
import {tui} from '../src/ui-runtime.mjs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {root} from '../src/paths.mjs';
import {run} from './helpers/process.mjs';
import {baseTheme,sourceOracle} from './helpers/ui.mjs';

function fakeClock(){
  let time=0,next=0;const timers=new Map();
  return {now:()=>time,setInterval:(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id;},clearInterval:id=>timers.delete(id),timers,
    advance:ms=>{time+=ms;for(const {fn} of [...timers.values()])fn();}};
}
const plain=lines=>tui.stripTerminalSequences(lines.join('\n'));

test('startup/working: exact source shimmer including light, NO_COLOR, Unicode and sweep/pause boundaries',()=>{
  const {constants}=sourceOracle();
  assert.deepEqual([motion.sweepMs,motion.pauseMs,motion.workingMs,motion.startupMs],[constants.esA,constants.LeI,constants.cAQ,constants.vAQ]);
  for(const noColor of [false,true])for(const appearance of ['dark','light']){
    const oracle=sourceOracle({noColor});
    if(appearance==='light')oracle.theme.setTerminalColors({background:{r:255,g:255,b:255}});
    for(const label of ['Thinking','Writing','Running read','Running CAF\u00c9 \ud83e\uddea'])for(const progress of [0,0.2,0.5,0.8,1])
      assert.equal(shimmer(label,progress,{appearance,noColor}),oracle.theme.shimmer(label,progress));
    for(const now of [0,80,700,1399,1400,1800,1899,1900])for(const width of [1,8,32,80,120]){
      const row=new oracle.Working(oracle.theme.shimmer,oracle.theme.muted,()=>now);
      row.label='Thinking';row.detail='2s \u00b7 escape to cancel';row.tip='Tip: / commands';
      const actual=renderWorking({label:row.label,detail:row.detail,tip:row.tip,now,appearance,noColor},width);
      assert.deepEqual(actual,Array.from(row.render(width)));assert.ok(actual.every(line=>tui.visibleWidth(line)<=width));
    }
  }
});

test('startup/working: source braille sampler and responsive startup layout with explicit Pi asset substitution',()=>{
  const clock=fakeClock(),host={terminal:{rows:40,columns:120},requestRender(){}};
  const oracle=sourceOracle({mark:piMark,name:piName});
  for(const rows of [6,8,16])for(const turn of [0,0.08,-0.03])
    assert.deepEqual(rasterBraille(piBitmap,rows,rows*2,turn),Array.from(oracle.raster(piBitmap,rows,rows*2,turn)));
  const details=()=>['Pi 1.0.0+reason-ui.3 \u00b7 fixture/offline-model','D:\\workspace\\CAF\u00c9'];
  const actual=new ReasonStartup({host,details,clock});
  const expected=new oracle.Startup(details,new oracle.Lockup(details,value=>value),()=>host.terminal.rows);
  for(const rows of [16,22,23,24,40])for(const width of [1,12,32,43,44,80,120]){
    host.terminal.rows=rows;
    const reference=Array.from(expected.render(width));
    // The source's narrow fallback spells its product name; only that branding is substituted.
    if(!actual.large(width)&&![4,3].some(size=>12+3+tui.visibleWidth(piName(size)[0])+2<=width))reference[0]=tui.truncateToWidth(' Pi',width);
    assert.deepEqual(actual.render(width),reference);
    assert.ok(actual.render(width).every(line=>tui.visibleWidth(line)<=width));
  }
  actual.dispose();
});

test('startup/working: startup settles at 2400ms, never restarts on resize, and disposes early on interaction',()=>{
  const clock=fakeClock();let renders=0;
  const host={terminal:{rows:40,columns:120},requestRender:()=>renders++};
  const header=new ReasonStartup({details:()=>['Pi'],host,clock,fresh:true});
  assert.equal(clock.timers.size,1);assert.equal([...clock.timers.values()][0].ms,33);
  clock.advance(500);assert.notEqual(header.turn,0);header.render(120);
  host.terminal.rows=16;assert.ok(header.render(32).length<10);
  clock.advance(1900);assert.equal(header.turn,0);assert.equal(clock.timers.size,0);
  host.terminal.rows=40;header.render(120);assert.equal(clock.timers.size,0);
  const early=new ReasonStartup({details:()=>['Pi'],host,clock,fresh:true});
  early.stop();assert.equal(clock.timers.size,0);early.dispose();header.dispose();
  const count=renders;clock.advance(5000);assert.equal(renders,count);
  const resume=new ReasonStartup({details:()=>['Pi'],host,clock,fresh:false});assert.equal(clock.timers.size,0);resume.dispose();
});

test('startup/working: redraw only when visible frame changes and release timers on idle/dispose/failure',()=>{
  const clock=fakeClock();let renders=0,label='Thinking',failed=0,throws=false;
  const row=new ReasonWorking({host:{requestRender:()=>renders++},clock,onFailure:()=>failed++,getState:()=>{
    if(throws)throw Error('fixture');return {label,noColor:false,detail:'0s'};
  }});
  row.update();row.render(80);assert.equal(clock.timers.size,1);
  clock.advance(700);assert.ok(renders>1);row.render(80);
  clock.advance(800);row.render(80);const count=renders;
  clock.advance(80);assert.equal(renders,count);
  label='';row.update();assert.equal(clock.timers.size,0);assert.deepEqual(row.render(80),[]);
  label='Writing';row.update();row.render(80);throws=true;clock.advance(80);
  assert.equal(failed,1);assert.equal(clock.timers.size,0);assert.deepEqual(row.render(80),[]);
});

function adapterFixture(){
  const handlers=new Map(),clock=fakeClock(),components={},visibility=[];
  let theme=baseTheme();
  const host={terminal:{rows:40,columns:120},requestRender(){}};
  const ui={get theme(){return theme;},setTheme:value=>{theme=value;return {success:true};},
    setHeader:factory=>{components.header?.dispose();components.header=factory?.(host,theme);},
    setFooter:factory=>{components.footer?.dispose();components.footer=factory?.(host,theme,{onBranchChange:()=>()=>{},getExtensionStatuses:()=>new Map()});},
    setWidget:(_key,factory)=>{components.working?.dispose();components.working=factory?.(host,theme);},
    setWorkingVisible:value=>visibility.push(value),setWorkingMessage(){},setWorkingIndicator(){},setHiddenThinkingLabel(){},
    setEditorComponent(){},notify(){}};
  const binding=registerReasonUI({on:(name,fn)=>handlers.set(name,fn),registerTool(){},appendEntry(){}},{cwd:'D:/fixture',offline:false,clock});
  const ctx={mode:'tui',ui,cwd:'D:/actual',model:{id:'actual-model',provider:'own-provider'},sessionManager:{getBranch:()=>[]},getContextUsage:()=>undefined};
  return {clock,components,visibility,binding,ctx,emit:(name,event={})=>handlers.get(name)(event,ctx)};
}

test('startup/working: idle -> thinking -> writing -> overlapping tools -> complete/error/cancel, actual identities',()=>{
  const f=adapterFixture(),{emit,components,clock}=f;
  emit('session_start');assert.equal(clock.timers.size,1);assert.deepEqual(components.working.render(80),[]);
  assert.match(plain(components.header.render(120)),/Pi 1.0.0\+reason-ui.3.*own-provider\/actual-model/);
  assert.match(plain(components.header.render(120)),/D:\/actual/);
  f.ctx.model={id:'next-model',provider:'next-provider'};emit('model_select');
  assert.match(plain(components.header.render(120)),/next-provider\/next-model/);
  for(const ending of ['stop','error','aborted']){
    emit('agent_start');assert.equal(clock.timers.size,1);assert.match(plain(components.working.render(80)),/Thinking/);
    clock.advance(1100);assert.match(plain(components.working.render(80)),/1s/);
    emit('message_update',{assistantMessageEvent:{type:'text_delta'}});assert.match(plain(components.working.render(80)),/Writing/);
    emit('tool_execution_start',{toolCallId:'a',toolName:'read'});emit('tool_execution_start',{toolCallId:'b',toolName:'grep'});
    emit('tool_execution_end',{toolCallId:'a',isError:true});assert.match(plain(components.working.render(80)),/Running grep/);
    emit('message_end',{message:{role:'assistant',stopReason:ending}});
    emit('tool_execution_end',{toolCallId:'b',isError:false});
    if(ending!=='stop'){assert.deepEqual(components.working.render(80),[]);assert.equal(clock.timers.size,0);}
    emit('agent_end');assert.deepEqual(components.working.render(80),[]);assert.equal(clock.timers.size,0);
    assert.match(plain(components.footer.render(80)),new RegExp(ending==='aborted'?'cancelled':ending==='error'?'error':'idle'));
  }
  emit('session_shutdown');assert.equal(clock.timers.size,0);
});

test('startup/working: reset, repeated session start, fallback, shutdown and late timer callbacks clean up',()=>{
  const f=adapterFixture();f.emit('session_start');f.emit('agent_start');
  const old=f.components.working,callback=[...f.clock.timers.values()][0].fn;
  f.emit('session_start');assert.equal(old.disposed,true);assert.equal(f.clock.timers.size,1);
  callback();assert.equal(f.clock.timers.size,1);
  f.binding.restore();assert.equal(f.clock.timers.size,0);assert.equal(f.visibility.at(-1),true);
  f.emit('session_start');f.emit('agent_start');f.ctx.getContextUsage=()=>{throw Error('render failure');};
  f.components.footer.render(80);assert.equal(f.binding.failed(),true);assert.equal(f.clock.timers.size,0);
  f.emit('session_shutdown');assert.equal(f.clock.timers.size,0);
});

test('startup/working: upstream retry and compaction indicators remain visible above custom editor',()=>{
  const keys=new tui.KeybindingsManager(tui.TUI_KEYBINDINGS),identity=x=>x;
  const editor=new ReasonEditor({terminal:{rows:24,columns:80},requestRender(){}},{borderColor:identity,selectList:{selectedPrefix:identity,selectedText:identity,description:identity,scrollInfo:identity,noMatch:identity}},keys);
  for(const kind of ['retry','compaction']){
    editor.setWorkingStatusIndicator({kind,renderInBorder:width=>tui.truncateToWidth(`${kind} in progress`,width)});
    for(const width of [2,8,80,120]){
      const lines=editor.render(width);assert.ok(lines.every(line=>tui.visibleWidth(line)<=width));
      if(width>=80)assert.match(plain(lines),new RegExp(`${kind} in progress`));
    }
  }
});

test('startup/working: actual SDK streams, tool execution, error and abort release timers and restore stock', {timeout:30000},async()=>{
  const result=await run(['--import',pathToFileURL(path.join(root,'src/offline-guard.mjs')).href,path.join(root,'tests/helpers/startup-host.mjs')],{timeout:25000});
  assert.equal(result.code,0,result.stderr+'\n'+result.stdout);
  const line=result.stdout.split('\n').find(value=>value.startsWith('STARTUP_HOST_PASS:'));
  assert.ok(line,result.stdout);const receipt=JSON.parse(line.slice('STARTUP_HOST_PASS:'.length));
  assert.equal(receipt.passed,true);assert.equal(receipt.timersAfterTurns,0);assert.equal(receipt.restore,true);
  assert.equal(receipt.network.blockedNetworkAttempts,0);
});
