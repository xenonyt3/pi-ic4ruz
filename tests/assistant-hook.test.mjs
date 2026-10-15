import test from 'node:test';
import assert from 'node:assert/strict';
import {sdk} from '../src/upstream.mjs';
import * as stock from '../runtime/node_modules/@earendil-works/pi-coding-agent/dist/index.js';
import {tui} from '../src/ui-runtime.mjs';
import {renderAssistantText,createReasonTheme} from '../src/reason-ui.mjs';
import {baseTheme,sourceOracle} from './helpers/ui.mjs';
import {assistantMessage} from './helpers/session.mjs';
import {assistantSamples,withoutZones} from './helpers/assistant-ui.mjs';

sdk.initTheme('dark');stock.initTheme('dark');
const theme=createReasonTheme(baseTheme());
const renderer=(text,width)=>renderAssistantText(text,width,theme,{noColor:false});
const message=text=>assistantMessage([{type:'text',text}]);

test('assistant absent/undefined hook remains byte-identical to stock across stop reasons and mixed blocks',()=>{
  for(const width of [8,80,120])for(const stopReason of ['stop','error','aborted','length','toolUse']){
    for(const content of [[{type:'text',text:assistantSamples.indented}],[],[{type:'thinking',thinking:'Check contract'},{type:'text',text:'result'},{type:'toolCall',id:'t',name:'read',arguments:{path:'fixture'}}]]){
      const msg=assistantMessage(content,{stopReason,errorMessage:'fixture failure'});
      const expected=new stock.AssistantMessageComponent(msg).render(width);
      assert.deepEqual(new sdk.AssistantMessageComponent(msg).render(width),expected);
      assert.deepEqual(new sdk.AssistantMessageComponent(msg,false,undefined,'Thinking...',1,[],()=>()=>undefined).render(width),expected);
    }
  }
});

test('assistant text matches Reason oracle for Markdown, indentation, tabs, whitespace and deltas at 80/120',()=>{
  for(const width of [80,120])for(const text of Object.values(assistantSamples)){
    const oracle=sourceOracle();
    const expected=new oracle.Row({kind:'assistant',key:'fixture',text},oracle.theme,{reasoning:false,toolOutput:false},false).render(width);
    const msg=message(text),before=JSON.stringify(msg);
    const component=new sdk.AssistantMessageComponent(msg,false,undefined,'Thinking',1,[],()=>renderer);
    component.updateContent(msg,true);
    const output=component.render(width);
    assert.deepEqual(withoutZones(output),Array.from(expected));
    assert.ok(output.every(line=>tui.visibleWidth(line)<=width));
    assert.equal(JSON.stringify(msg),before);
    assert.equal(output.join('').match(/\x1b\]133;A\x07/g)?.length,1);
    assert.equal(output.join('').match(/\x1b\]133;B\x07/g)?.length,1);
  }
});

test('assistant malformed/throwing hooks fall back; cached hook arrays remain unchanged',()=>{
  const msg=message('**Retain message**'),expected=new sdk.AssistantMessageComponent(msg).render(80);
  for(const invalid of [()=>{throw Error('fixture');},()=>null,()=>[],()=>[42],()=>['bad\nline'],()=>['x'.repeat(81)]]){
    let errors=0;
    assert.deepEqual(new sdk.AssistantMessageComponent(msg,false,undefined,'Thinking...',1,[],()=>invalid,()=>errors++).render(80),expected);
    assert.equal(errors,1);
  }
  const frozen=Object.freeze(['kept']);
  const component=new sdk.AssistantMessageComponent(msg,false,undefined,'Thinking...',1,[],()=>()=>frozen);
  assert.deepEqual(component.render(80),component.render(80));assert.deepEqual(frozen,['kept']);
});

test('assistant hook preserves transformers, streaming flag, thinking visibility, tool boundaries and errors',()=>{
  const seen=[],transform=(text,context)=>{seen.push(context);return text.replace('raw','transformed');};
  let streaming;
  const content=[{type:'thinking',thinking:'Check contract'},{type:'text',text:'raw value'},{type:'toolCall',id:'fixture',name:'read',arguments:{}}];
  const msg=assistantMessage(content,{stopReason:'length'}),before=JSON.stringify(msg);
  const component=new sdk.AssistantMessageComponent(msg,true,undefined,'Thinking label',1,[transform],()=>((text,width,_theme,flag)=>{streaming=flag;return renderer(text,width);}));
  component.updateContent(msg,true);
  let output=component.render(80).join('\n');
  assert.match(output,/Thinking label/);assert.match(output,/transformed value/);assert.match(output,/truncated before completion/);
  assert.doesNotMatch(output,/\x1b\]133;/);assert.equal(streaming,true);
  assert.ok(seen.some(ctx=>ctx.messageType==='assistant'&&ctx.isStreaming&&ctx.availableWidth===78));
  component.setHideThinkingBlock(false);output=tui.stripTerminalSequences(component.render(80).join('\n'));
  assert.match(output,/Check contract/);assert.equal(JSON.stringify(msg),before);
  for(const stopReason of ['error','aborted']){
    const rendered=new sdk.AssistantMessageComponent(assistantMessage([{type:'text',text:'partial'}],{stopReason,errorMessage:'visible failure'}),false,undefined,'Thinking',1,[],()=>renderer).render(80).join('\n');
    assert.match(rendered,/visible failure/);
  }
});

test('assistant streaming updates and resize preserve final content and stock empty-message suppression',()=>{
  const component=new sdk.AssistantMessageComponent(undefined,false,undefined,'Thinking',1,[],()=>renderer);
  for(const text of ['','    const','    const value = 42;','    const value = 42;\n    return value;']){
    const msg=message(text);component.updateContent(msg,true);
    for(const width of [8,80,120,80]){
      const actual=component.render(width);
      assert.ok(actual.every(line=>tui.visibleWidth(line)<=width));
      if(!text)assert.deepEqual(actual,[]);
      else assert.deepEqual(actual,new sdk.AssistantMessageComponent(msg,false,undefined,'Thinking',1,[],()=>renderer).render(width));
    }
  }
});

test('assistant control sequences are stripped while NO_COLOR and source text are preserved',()=>{
  const text='> Quote\n\n\tcode\x1b]0;untrusted\x07',before=text;
  const output=renderAssistantText(text,80,theme,{noColor:true}).join('\n');
  assert.doesNotMatch(output,/\x1b/);assert.equal(text,before);assert.match(output,/Quote/);assert.match(output,/code/);
});

test('assistant renderer and Markdown transformers agree on user-configured output padding',()=>{
  for(const padding of [0,1,3]){
    let available;
    const text=Array(25).fill('word').join(' ');
    const component=new sdk.AssistantMessageComponent(message(text),false,undefined,'Thinking',padding,[(value,context)=>{available=context.availableWidth;return value;}],()=>((value,width,_theme,_streaming,outputPad)=>renderAssistantText(value,width,theme,{noColor:false,padding:outputPad})));
    const actual=withoutZones(component.render(80));
    assert.equal(available,80-2*padding);
    assert.deepEqual(actual,['',...renderAssistantText(text,80,theme,{noColor:false,padding})]);
    component.setOutputPad(1);
    assert.deepEqual(withoutZones(component.render(80)),['',...renderer(text,80)]);
  }
});
