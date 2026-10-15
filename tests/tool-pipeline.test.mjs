import test from 'node:test';
import assert from 'node:assert/strict';
import { Type } from '../src/upstream.mjs';
import { registerCodemode } from '../src/codemode-policy.ts';
import { registerToolPolicy } from '../src/tool-policy.ts';
import { createFixtureSession,runTool,resultText } from './helpers/session.mjs';

test('O04 real AgentSession direct/nested policy/schema/throw and result transformations',async()=>{
  let executions=0;
  const f=await createFixtureSession({settings:{defaultTools:['read','bash','edit','write','codemode','guarded']},extensions:[pi=>registerCodemode(pi),pi=>{
    pi.registerTool({name:'guarded',description:'fixture with validation and hooks',parameters:Type.Object({value:Type.String()}),execute:async()=>{executions++;return {content:[{type:'text',text:'original'}]};}});
    pi.on('tool_call',event=>{if(event.toolName==='guarded'&&event.input.value==='blocked')return{block:true,reason:'POLICY_BLOCK'};if(event.toolName==='guarded'&&event.input.value==='throw')throw new Error('HOOK_THROW');});
    pi.on('tool_result',event=>{if(event.toolName==='guarded'&&!event.isError)return{content:[{type:'text',text:'transformed'}]};});
  }]});
  try {
    for(const input of [{value:'blocked'},{value:'throw'},{}]){
      const direct=await runTool(f,'guarded',input); assert.equal(direct.isError,true,JSON.stringify(input)+resultText(direct));
      const nested=await runTool(f,'codemode',{code:`await tools.guarded(${JSON.stringify(input)});`}); assert.equal(nested.isError,true,resultText(nested));
    }
    assert.equal(executions,0);
    const good=await runTool(f,'codemode',{code:'text(await tools.guarded({value:"ok"}));'});
    assert.match(resultText(good),/transformed/); assert.equal(executions,1);
    assert.ok(f.events.some(e=>e.type==='tool_execution_end'&&e.parentToolCallId));
  }finally{f.dispose();}
});

test('O04 registry allowlist removes forbidden deferred tools from child callable context',async()=>{
  let ran=false;
  const f=await createFixtureSession({tools:['read','codemode'],extensions:[pi=>registerCodemode(pi),pi=>pi.registerTool({name:'forbidden',description:'must not execute',exposure:'deferred',parameters:Type.Object({}),execute:async()=>{ran=true;return{content:[]};}})]});
  try{
    const r=await runTool(f,'codemode',{code:'text(await describeTool("forbidden")); await tools.forbidden({});'});
    assert.equal(r.isError,true);assert.equal(ran,false);assert.match(resultText(r),/undefined|not a function/);
  }finally{f.dispose();}
});

test('O04 canonical workspace policy blocks direct/nested outside paths',async()=>{
  let cwd;
  const f=await createFixtureSession({extensions:[pi=>registerCodemode(pi),pi=>pi.on('session_start',(_e,ctx)=>{cwd=ctx.cwd;}),pi=>{
    pi.on('tool_call',async event=>{const {authorizeToolCall}=await import('../src/tool-policy.ts');authorizeToolCall(event,{workspace:cwd,allowedTools:['read','codemode']});});
  }]});
  try{
    const direct=await runTool(f,'read',{path:'D:/pi-clean/launch.mjs'});assert.equal(direct.isError,true);assert.match(resultText(direct),/OUTSIDE|PROTECTED/);
    const nested=await runTool(f,'codemode',{code:'await tools.read({path:"D:/pi-clean/launch.mjs"});'});assert.equal(nested.isError,true);assert.match(resultText(nested),/OUTSIDE|PROTECTED/);
  }finally{f.dispose();}
});
