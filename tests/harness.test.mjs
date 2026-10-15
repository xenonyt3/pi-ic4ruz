import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import { root,canonicalPath,isWithin } from '../src/paths.mjs';
import { registerHarness } from '../src/harness.ts';
import { createFixtureSession,runTool,resultText } from './helpers/session.mjs';

test('integrated harness declares five tools, enforces leases and preserves direct/nested shell contracts',async()=>{
  const base=path.join(root,'tests/.tmp');fs.mkdirSync(base,{recursive:true});const cwd=fs.mkdtempSync(path.join(base,'harness-'));
  let harness;
  const f=await createFixtureSession({cwd,extensions:[pi=>{harness=registerHarness(pi,{cwd,allowSyntheticTurns:true,registryDir:path.join(cwd,'receipts'),leaseRoot:path.join(cwd,'leases'),telemetryDir:path.join(cwd,'telemetry'),childAgentDir:path.join(cwd,'profiles'),childSessionDir:path.join(cwd,'sessions')});}]});
  try{
    assert.equal(f.errors.length,0,JSON.stringify(f.errors));
    assert.deepEqual(f.session.getActiveToolNames().sort(),['bash','codemode','edit','read','write']);
    assert.equal(harness.getRecall().status,'unavailable');
    const write=await runTool(f,'write',{path:'owned.txt',content:'owned'});assert.equal(write.isError,false,resultText(write));
    assert.deepEqual(fs.readdirSync(path.join(cwd,'leases')),[]);
    const direct=await runTool(f,'bash',{command:'printf direct; exit 7'});assert.equal(direct.isError,true,resultText(direct));
    const nested=await runTool(f,'codemode',{code:'const result=await tools.bash({command:"printf nested; exit 7"});text(result.exit_code);text(result.output);'});
    assert.equal(nested.isError,false,resultText(nested));assert.match(resultText(nested),/7.*nested/s);
    assert.equal(harness.policy.pendingWriterCalls().length,0);
    assert.deepEqual(fs.readdirSync(path.join(cwd,'leases')),[]);
    assert.ok(harness.telemetry.records.some(record=>record.type==='request'));
    const spawned=await runTool(f,'codemode',{code:'text(await tools.agents_spawn({tasks:[{prompt:"synthetic pointer fixture",profile:"code_explorer"}]}));'});
    assert.equal(spawned.isError,false,resultText(spawned));
    const child=harness.getSupervisor().list()[0];assert.ok(child);
    const receipt=(await harness.getSupervisor().wait([child.id],15000))[0];assert.equal(receipt.status,'completed');
    assert.ok(f.sessionManager.getBranch().some(entry=>entry.type==='custom'&&entry.customType==='reason_harness_pointer_v1'&&entry.data.childId===child.id));
  }finally{await harness.getSupervisor().shutdown();f.dispose();assert.ok(isWithin(canonicalPath(base),canonicalPath(cwd)));fs.rmSync(cwd,{recursive:true,force:true});}
});
