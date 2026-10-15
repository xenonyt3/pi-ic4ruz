import test from 'node:test';
import assert from 'node:assert/strict';
import {sdk} from '../src/upstream.mjs';
import {tui} from '../src/ui-runtime.mjs';
import {renderThinking,renderAssistantText,thinkingSummary,createReasonTheme} from '../src/reason-ui.mjs';
import {sourceOracle,baseTheme} from './helpers/ui.mjs';
import {assistantMessage} from './helpers/session.mjs';
import {withoutZones} from './helpers/assistant-ui.mjs';
import {thinkingSamples} from './helpers/reasoning-ui.mjs';

sdk.initTheme('dark');
const theme=createReasonTheme(baseTheme());
const render=(text,width,_theme,options)=>renderThinking(text,width,theme,{...options,noColor:false});
const message=text=>assistantMessage([{type:'thinking',thinking:text,thinkingSignature:'opaque-signature'}]);
const component=(msg,hidden=true,getRenderer=()=>render,onError,transformers=[],padding=1)=>new sdk.AssistantMessageComponent(msg,hidden,undefined,'Thinking',padding,transformers,undefined,undefined,getRenderer,onError);

test('thinking hidden/expanded rows match Reason source and preserve signed content',()=>{
  for(const width of [80,120])for(const expanded of [false,true])for(const text of Object.values(thinkingSamples)){
    const oracle=sourceOracle(),msg=message(text),before=JSON.stringify(msg);
    const expected=new oracle.Row({kind:'reasoning',key:'fixture',text},oracle.theme,{reasoning:expanded,toolOutput:false},false).render(width);
    const output=component(msg,!expanded).render(width);
    assert.deepEqual(withoutZones(output),Array.from(expected));
    assert.equal(JSON.stringify(msg),before);assert.ok(output.every(line=>tui.visibleWidth(line)<=width));
  }
});

test('thinking labels are per-run, use last bold heading, and update as content streams',()=>{
  assert.equal(thinkingSummary('## First `path`\nNo heading'),'First path');
  assert.equal(thinkingSummary(thinkingSamples.latest),'Latest decision');
  const first=component(message('First task')),second=component(message('Second task'));
  assert.match(first.render(80).join(''),/Thinking: First task/);
  assert.match(second.render(80).join(''),/Thinking: Second task/);
  first.updateContent(message('First task\n**Updated heading**'),true);
  assert.match(first.render(80).join(''),/Thinking: Updated heading/);
  assert.doesNotMatch(second.render(80).join(''),/Updated heading/);
});

test('thinking absent, undefined, invalid and throwing hooks retain exact stock output',()=>{
  for(const hidden of [false,true]){
    const msg=message(thinkingSamples.markdown);
    const stock=new sdk.AssistantMessageComponent(msg,hidden,undefined,'Thinking').render(80);
    assert.deepEqual(component(msg,hidden,()=>undefined).render(80),stock);
    assert.deepEqual(component(msg,hidden,()=>()=>undefined).render(80),stock);
    for(const invalid of [()=>null,()=>[],()=>['bad\nline'],()=>[42],()=>['x'.repeat(81)],()=>{throw Error('fixture');}]){
      let errors=0;
      assert.deepEqual(component(msg,hidden,()=>invalid,()=>errors++).render(80),stock);assert.equal(errors,1);
    }
  }
});

test('text and thinking rows retain source separation without changing tool boundaries or fallback',()=>{
  const text={type:'text',text:'First answer.'},thinking={type:'thinking',thinking:'Check next step.'};
  for(const content of [[text,thinking],[thinking,text],[text,thinking,{type:'text',text:'Final answer.'}]]){
    const oracle=sourceOracle(),msg=assistantMessage(content),before=JSON.stringify(msg);
    const expected=content.flatMap(block=>new oracle.Row({kind:block.type==='text'?'assistant':'reasoning',key:block.type,text:block.text??block.thinking},oracle.theme,{reasoning:false,toolOutput:false},false).render(80));
    const row=new sdk.AssistantMessageComponent(msg,true,undefined,'Thinking',1,[],()=>((value,width)=>renderAssistantText(value,width,theme,{noColor:false})),undefined,()=>render);
    assert.deepEqual(withoutZones(row.render(80)),Array.from(expected));
    assert.equal(JSON.stringify(msg),before);
  }
  const msg=assistantMessage([text,{type:'toolCall',id:'x',name:'read',arguments:{}},thinking],{stopReason:'toolUse'});
  const output=component(msg,true).render(80).join('\n');assert.doesNotMatch(output,/\x1b\]133;/);
  const stock=new sdk.AssistantMessageComponent(msg,true,undefined,'Thinking').render(80);
  assert.deepEqual(component(msg,true,()=>()=>undefined).render(80),stock);
});

test('thinking expanded transform receives correct width and streaming state; collapsed stays untransformed',()=>{
  for(const padding of [0,1,3]){
    const seen=[];
    const row=component(message('raw details'),true,()=>render,undefined,[(text,context)=>{seen.push(context);return text.replace('raw','transformed');}],padding);
    row.updateContent(message('raw details'),true);row.render(80);assert.equal(seen.length,0);
    row.setHideThinkingBlock(false);assert.match(row.render(80).join(''),/transformed details/);
    assert.equal(seen.at(-1).availableWidth,80-2*(padding+2));assert.equal(seen.at(-1).isStreaming,true);assert.equal(seen.at(-1).messageType,'assistant-thinking');
  }
});

test('thinking clicks and global toggles keep upstream MouseRegion and visibility behavior',()=>{
  const msg=message('First line\nSecond detail'),before=JSON.stringify(msg),row=component(msg);
  row.render(80);
  const region=row.children[0].children.find(child=>child instanceof tui.MouseRegion);
  assert.ok(region);
  const result=region.onMouse({type:'click',button:'left',x:3,y:0});
  assert.equal(result.handled,true);
  assert.match(row.render(80).join(''),/Second detail/);
  assert.doesNotMatch(row.render(80).join(''),/Thinking:/);
  row.setHideThinkingBlock(true);assert.match(row.render(80).join(''),/Thinking:/);
  assert.equal(JSON.stringify(msg),before);
});

test('thinking narrow resize, cached arrays, controls and NO_COLOR preserve content safely',()=>{
  const row=component(message(thinkingSamples.long));
  for(const width of [8,20,80,120,80])assert.ok(row.render(width).every(line=>tui.visibleWidth(line)<=width));
  const frozen=Object.freeze(['safe']);
  const cached=component(message('raw'),true,()=>()=>frozen);
  assert.deepEqual(cached.render(80),cached.render(80));assert.deepEqual(frozen,['safe']);
  for(const expanded of [false,true]){
    const output=renderThinking('hello\x1b]0;untrusted\x07',80,theme,{expanded,noColor:true}).join('');
    assert.doesNotMatch(output,/\x1b/);assert.match(output,/hello/);
  }
});
