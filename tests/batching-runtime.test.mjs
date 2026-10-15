import test from 'node:test';
import assert from 'node:assert/strict';
import { Type } from '../src/upstream.mjs';
import { registerCodemode } from '../src/codemode-policy.ts';
import { createFixtureSession,runTool,resultText } from './helpers/session.mjs';

test('O07 actual nested calls overlap at a barrier and allSettled preserves rejection',async()=>{
  let started=0,release;
  const gate=new Promise(resolve=>{release=resolve;});
  const f=await createFixtureSession({extensions:[pi=>registerCodemode(pi),pi=>{
    for(const name of ['first','second'])pi.registerTool({name,description:'independent barrier fixture',exposure:'deferred',parameters:Type.Object({}),execute:async()=>{
      if(++started===2)release();await gate;if(name==='second')throw new Error('PARTIAL_FAILURE');return{content:[{type:'text',text:'first-result'}]};
    }});
  }]});
  const timer=setTimeout(release,3000);
  try{
    const r=await runTool(f,'codemode',{code:'const results=await Promise.allSettled([tools.first({}),tools.second({})]);text(results.map(r=>r.status));'});
    assert.equal(started,2);assert.equal(r.isError,false);assert.match(resultText(r),/fulfilled.*rejected/s);
    const starts=f.events.filter(e=>e.type==='tool_execution_start'&&e.parentToolCallId);
    const ends=f.events.filter(e=>e.type==='tool_execution_end'&&e.parentToolCallId);
    assert.equal(starts.length,2);assert.equal(ends.length,2);
    assert.ok(f.events.indexOf(starts[1])<f.events.indexOf(ends[0]));
  }finally{clearTimeout(timer);release();f.dispose();}
});
test('O07 sequential override prevents overlap for actual nested tool calls',async()=>{
  let active=0,max=0,calls=0;
  const f=await createFixtureSession({extensions:[pi=>registerCodemode(pi),pi=>pi.registerTool({name:'serial',description:'sequential fixture',exposure:'deferred',executionMode:'sequential',parameters:Type.Object({}),execute:async()=>{
    active++;max=Math.max(active,max);await new Promise(resolve=>setTimeout(resolve,10));active--;calls++;return{content:[]};
  }})]});
  try{await runTool(f,'codemode',{code:'await Promise.all([tools.serial({}),tools.serial({})]);'});assert.equal(calls,2);assert.equal(max,1);}finally{f.dispose();}
});
