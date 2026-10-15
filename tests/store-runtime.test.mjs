import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { sdk } from '../src/upstream.mjs';
import { root,canonicalPath,isWithin } from '../src/paths.mjs';
import { registerCodemode } from '../src/codemode-policy.ts';
import { createFixtureSession,runTool,resultText } from './helpers/session.mjs';

test('O08 upstream store resume/branch isolation, copy/delete and quotas',async()=>{
  const base=path.join(root,'tests/.tmp');fs.mkdirSync(base,{recursive:true});
  const cwd=fs.mkdtempSync(path.join(base,'store-'));const sessions=path.join(cwd,'sessions');fs.mkdirSync(sessions);
  const manager=sdk.SessionManager.create(cwd,sessions);
  let f=await createFixtureSession({cwd,sessionManager:manager,extensions:[pi=>registerCodemode(pi)]});
  const call=code=>runTool(f,'codemode',{code});
  try {
    assert.equal((await call('store("value",{n:1}); text("saved");')).isError,false);
    const leaf=manager.getLeafId();const sessionFile=manager.getSessionFile();
    assert.equal((await call('store("value",{n:2});')).isError,false);
    await f.session.navigateTree(leaf,{summarize:false});
    assert.match(resultText(await call('text(load("value"));')),/"n":1/);
    const copy=await call('const copy=load("value"); copy.n=99; text(load("value"));');
    assert.match(resultText(copy),/"n":1/);
    const overflow=await call('store("tooBig","x".repeat(300000));');assert.equal(overflow.isError,true);
    assert.match(resultText(overflow),/RangeError|limit|exceed|large/i);
    const total=await call('for(let i=0;i<6;i++) store("quota"+i,"x".repeat(240000));');assert.equal(total.isError,true);
    assert.match(resultText(await call('text(load("quota0"));')),/undefined/);
    f.dispose();
    f=await createFixtureSession({cwd,sessionManager:sdk.SessionManager.open(sessionFile,sessions),extensions:[pi=>registerCodemode(pi)]});
    assert.match(resultText(await call('text(load("value"));')),/"n":1/);
    assert.equal((await call('store("value",undefined);')).isError,false);
    assert.match(resultText(await call('text(load("value"));')),/undefined/);
    assert.equal(manager.getBranch().some(e=>JSON.stringify(e).includes('D:/.vault-brain')),false);
  } finally {f.dispose();assert.ok(isWithin(canonicalPath(base),canonicalPath(cwd)));fs.rmSync(cwd,{recursive:true,force:true});}
});
