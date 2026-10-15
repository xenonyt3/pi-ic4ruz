import test from 'node:test';
import assert from 'node:assert/strict';
import { Type } from '../src/upstream.mjs';
import { registerCodemode } from '../src/codemode-policy.ts';
import { assertNoIdentifierCollisions, registerDeferredFileTools, registerToolPolicy, CORE_TOOLS } from '../src/tool-policy.ts';
import { createFixtureSession, runTool, resultText } from './helpers/session.mjs';

test('O03 exactly five initial declarations, deferred catalog/schema lookup and unknown', async()=>{
  const f=await createFixtureSession({extensions:[pi=>registerCodemode(pi),pi=>registerDeferredFileTools(pi,process.cwd())]});
  try {
    assert.deepEqual(f.session.getActiveToolNames().sort(),[...CORE_TOOLS].sort());
    const result=await runTool(f,'codemode',{code:'text(await describeTool("definitely_unknown")); text(await describeTool("ls")); text(await describeNamespace("workspace")); text(await searchTools("list directory"));'});
    assert.equal(result.isError,false,resultText(result));
    assert.match(resultText(result),/undefined/); assert.match(resultText(result),/ls/);
    const declarations=f.envelopes[0].messages.find(m=>m.role==='system')?.toolsAdded;
    assert.deepEqual(declarations.map(t=>t.name).sort(),[...CORE_TOOLS].sort());
    assert.doesNotMatch(declarations.find(t=>t.name==='codemode').description,/models\.classify|models\.generateImages/);
  } finally {f.dispose();}
});
test('O03 normalized collisions rejected',()=>{
  assert.throws(()=>assertNoIdentifierCollisions(['tool-a','tool_a']),/COLLISION/);
});
test('O03 registry changes are reflected in callable discovery',async()=>{
  const f=await createFixtureSession({extensions:[pi=>registerCodemode(pi),pi=>pi.registerTool({name:'catalog_entry',description:'live registry entry',parameters:Type.Object({}),defaultActive:false,namespace:{name:'fixture',description:'Fixture catalog'},execute:async()=>({content:[]})})]});
  try {
    const before=await runTool(f,'codemode',{code:'text(await describeTool("catalog_entry"));'});
    assert.match(resultText(before),/undefined/);
    f.session.setActiveToolsByName([...CORE_TOOLS,'catalog_entry']);
    const after=await runTool(f,'codemode',{code:'text(await describeTool("catalog_entry"));'});
    assert.match(resultText(after),/live registry entry/);
  } finally {f.dispose();}
});
