import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sdk, Type } from '../src/upstream.mjs';
import { registerCodemode, withHostDeadline, validateScriptOptions } from '../src/codemode-policy.ts';
import { createFixtureSession, runTool, resultText } from './helpers/session.mjs';

const extension = pi => registerCodemode(pi);
test('O02 facade preserves upstream schema, loadout, grammar and renderers; helpers off', () => {
  let upstream, wrapped;
  const pi = { registerTool:tool=>{upstream=tool;}, getAllTools:()=>[], appendEntry:()=>{}, getSettings:()=>({}) };
  sdk.createCodemodeExtension({mode:'on',inlineBudget:3000,models:false})(pi);
  registerCodemode({...pi,registerTool:tool=>{wrapped=tool;}},{factory:()=>api=>api.registerTool(upstream)});
  for (const field of ['parameters','constrainedSampling','renderCall','renderResult']) assert.equal(wrapped[field], upstream[field]);
  assert.equal(typeof wrapped.prepareLoadout,'function');
  assert.equal(wrapped.exposure,'model-only');
  assert.notEqual(wrapped.execute, upstream.execute);
});

test('O02 real AgentSession executes isolated QuickJS await/return/exit and success-only store', async () => {
  const f=await createFixtureSession({extensions:[extension]});
  try {
    let result=await runTool(f,'codemode',{code:'text([typeof process,typeof require,typeof fetch,typeof models]); await Promise.resolve(); store("v",{n:1}); return 7;'});
    assert.equal(result.isError,false,resultText(result));
    assert.match(resultText(result),/undefined.*undefined.*undefined.*undefined/s);
    assert.match(resultText(result),/7/);
    result=await runTool(f,'codemode',{code:'text(load("v")); store("v",{n:2}); text("partial"); throw new Error("fixture-failure");'});
    assert.equal(result.isError,true); assert.match(resultText(result),/partial/);
    result=await runTool(f,'codemode',{code:'text(load("v")); exit(); text("never-after-exit");'});
    assert.match(resultText(result),/"n":1/); assert.doesNotMatch(resultText(result),/never-after-exit/);
  } finally {f.dispose();}
});

test('O02 options ceiling/parser, CPU timeout, unsettled promise and host abort', async () => {
  for (const code of ['', '// @options: {"x":1}\ntext(1)', '// @options: {"timeout_ms":0}\ntext(1)', '// @options: {"timeout_ms":900001}\ntext(1)']) assert.throws(()=>validateScriptOptions(code));
  const f=await createFixtureSession({extensions:[pi=>registerCodemode(pi,{defaultDeadlineMs:150})]});
  try {
    const cpu=await runTool(f,'codemode',{code:'// @options: {"timeout_ms":40}\nwhile(true) {}'});
    assert.equal(cpu.isError,true); assert.match(resultText(cpu),/timeout|timed out/i);
    const pending=await runTool(f,'codemode',{code:'await new Promise(()=>{});'});
    assert.equal(pending.isError,true); assert.match(resultText(pending),/unsettled|pending|HOST_DEADLINE|aborted/i);
    const host=withHostDeadline(async (_id,_args,signal)=>{await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true})); return {content:[]};},{defaultDeadlineMs:10});
    const result=await host('id',{code:'text(1)'},undefined,undefined,undefined);
    assert.equal(result.details.hostDeadline,'HOST_DEADLINE'); assert.equal(result.isError,true);
  } finally {f.dispose();}
});

test('O02 output cap spills full content and heap failure is bounded', async () => {
  const f=await createFixtureSession({extensions:[extension]});
  try {
    const capped=await runTool(f,'codemode',{code:'// @options: {"max_output_tokens":20}\ntext("long-output-".repeat(1000));'});
    assert.equal(capped.isError,false); assert.ok(capped.details.fullOutputPath);
    assert.match(fs.readFileSync(capped.details.fullOutputPath,'utf8'),/long-output-/);
    const heap=await runTool(f,'codemode',{code:'// @options: {"timeout_ms":3000}\nnew ArrayBuffer(300000000);'});
    assert.equal(heap.isError,true); assert.match(resultText(heap),/memory|allocation|out of/i);
  } finally {f.dispose();}
});

test('O02 dangling and aborted nested tools receive cancellation', async () => {
  let aborts=0;
  let calls=0,secondStarted;
  const started=new Promise(resolve=>{secondStarted=resolve;});
  const f=await createFixtureSession({extensions:[extension,pi=>pi.registerTool({name:'slow',description:'synthetic cancellable tool',parameters:Type.Object({}),exposure:'deferred',execute:async(_id,_p,signal)=>{
    if(++calls===2)secondStarted();
    await new Promise(resolve=>{if(signal.aborted){aborts++;resolve();}else signal.addEventListener('abort',()=>{aborts++;resolve();},{once:true});});
    return {content:[{type:'text',text:'aborted'}]};
  }})]});
  try {
    const result=await runTool(f,'codemode',{code:'tools.slow({}); text("done");'});
    assert.match(resultText(result),/done/);
    assert.equal(aborts,1);
    const pending=runTool(f,'codemode',{code:'await tools.slow({});'});
    let timer;
    try {
      await Promise.race([started,new Promise((_resolve,reject)=>{timer=setTimeout(()=>reject(new Error('nested tool did not start')),5000);})]);
      await f.session.abort();await pending;
    } finally {clearTimeout(timer);}
    assert.equal(aborts,2);
  } finally {f.dispose();}
});
