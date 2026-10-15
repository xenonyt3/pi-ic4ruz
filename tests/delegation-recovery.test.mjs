import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import { root,canonicalPath,isWithin } from '../src/paths.mjs';
import { createChildSupervisor } from '../src/child-supervisor.ts';import { loadChildProfiles } from '../src/child-profiles.ts';
const config=loadChildProfiles(path.join(root,'config/child-profiles.json'));
const folders=[];
function fixture(transport,extra={}){const base=path.join(root,'tests/.tmp');fs.mkdirSync(base,{recursive:true});const dir=fs.mkdtempSync(path.join(base,'recovery-'));folders.push(dir);return createChildSupervisor({registryDir:dir,ownerSession:'test',ownerBranch:'main',config:structuredClone(config),parentGrantedTools:['read'],runtimeTools:['read'],transport,...extra});}
test.after(()=>{for(const dir of folders){assert.ok(isWithin(canonicalPath(path.join(root,'tests/.tmp')),canonicalPath(dir)));fs.rmSync(dir,{recursive:true,force:true});}});
const task={profile:'code_explorer',prompt:'exact assignment'};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('O12 failed durable claim does not consume delivery token',async()=>{
  let failClaim=false;
  const s=fixture({start:async record=>({sessionPath:record.id,done:Promise.resolve({status:'completed',text:'answer'}),cancel:async()=>true})},{writeRecord(file,record){if(failClaim&&record.claimed)throw new Error('DISK_FULL');fs.writeFileSync(file,JSON.stringify(record));}});
  const id=(await s.spawnTasks([task])).subagent_session_ids[0];await tick();failClaim=true;
  assert.throws(()=>s.claimResult(id),/DISK_FULL/);assert.equal(s.get(id).claimed,false);
  failClaim=false;assert.equal(s.claimResult(id).text,'answer');assert.equal(s.claimResult(id),null);
});
test('O13 throwing cancellation retains handle and permits cleanup retry',async()=>{
  let attempts=0;
  const s=fixture({start:async record=>({sessionPath:record.id,done:new Promise(()=>{}),cancel:async()=>{if(++attempts===1)throw new Error('IPC_LOST');return true;}})});
  const id=(await s.spawnTasks([task])).subagent_session_ids[0];
  assert.equal((await s.cancel(id)).cleanup_confirmed,false);assert.equal(s.activeCount(),1);
  assert.equal((await s.cancel(id)).cleanup_confirmed,true);assert.equal(s.activeCount(),0);
});
test('O13 shutdown waits for uncommitted startup and prevents future starts',async()=>{
  let release;const gate=new Promise(resolve=>{release=resolve;});let cancelled=0;
  const s=fixture({start:async record=>{await gate;return{sessionPath:record.id,done:new Promise(()=>{}),cancel:async()=>{cancelled++;return true;}};}});
  const started=s.spawnTasks([task]);const shutdown=s.shutdown();release();
  assert.equal((await started).count,0);const drained=await shutdown;
  assert.equal(cancelled,1);assert.equal(drained[0].cleanup_confirmed,true);
  await assert.rejects(s.spawnTasks([task]),/SHUTTING_DOWN/);
});
test('O13 receipt write failure keeps slot and cancels a started process handle',async()=>{
  let cancelled=0;
  const s=fixture({start:async record=>({sessionPath:record.id,done:new Promise(()=>{}),cancel:async()=>{cancelled++;return true;}})},{writeRecord(file,record){if(record.status==='running')throw new Error('DISK_FULL');fs.writeFileSync(file,JSON.stringify(record));}});
  const result=await s.spawnTasks([task]);assert.equal(result.count,0);assert.equal(cancelled,1);assert.equal(s.list()[0].status,'failed');
});
test('O12 cancelling wait leaves its child running',async()=>{
  let cancels=0;
  const s=fixture({start:async record=>({sessionPath:record.id,done:new Promise(()=>{}),cancel:async()=>{cancels++;return true;}})});
  const id=(await s.spawnTasks([task])).subagent_session_ids[0];const controller=new AbortController();
  const waiting=s.wait([id],120000,5000,controller.signal);controller.abort();
  await assert.rejects(waiting,/WAIT_ABORTED/);assert.equal(s.get(id).status,'running');assert.equal(cancels,0);await s.shutdown();
});
