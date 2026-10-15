import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { root, canonicalPath, isWithin } from '../src/paths.mjs';
import { runCandidateVerifier } from '../src/pilot-verifier.mjs';
import { assertOfflineAcceptance, isCleanupConfirmed } from '../src/evaluation-acceptance.mjs';

const base=path.join(root,'tests/.tmp');fs.mkdirSync(base,{recursive:true});
const dir=fs.mkdtempSync(path.join(base,'verifier-'));const candidate=path.join(dir,'normalize.mjs');
test.after(()=>{assert.ok(isWithin(canonicalPath(base),canonicalPath(dir)));fs.rmSync(dir,{recursive:true,force:true});});
function run(source){fs.writeFileSync(candidate,source);return runCandidateVerifier(candidate,{agentDir:dir});}
test('verifier requires all assertions and binds receipt to the exact source',()=>{
  const result=run("export function normalizeLabel(v){if(typeof v!=='string')throw new TypeError();return v.trim().replace(/\\s+/gu,' ').toLowerCase();}");
  assert.equal(result.passed,true,JSON.stringify(result));assert.equal(result.receipt.passed,12);
  assert.equal(result.receipt.sourceHash,createHash('sha256').update(fs.readFileSync(candidate)).digest('hex'));
});
test('early process exit, imports, forged markers and unfinished execution cannot pass',()=>{
  for(const source of [
    'export function normalizeLabel(){process.exit(0)}',
    "import process from 'node:process'; process.exit(0); export function normalizeLabel(){}",
    "console.log('VERIFIER_PASS: 12 assertions'); export function normalizeLabel(){return 'wrong'}",
    'export function normalizeLabel(){while(true){}}',
  ])assert.equal(run(source).passed,false,source);
});
test('all children and parent writer state must be clean before a condition can pass',()=>{
  const clean={shutdownResults:[],children:[{status:'completed',cleanupConfirmed:true}],activeCount:0,pendingWriterCalls:[],writerLeasePresent:false};
  assert.equal(isCleanupConfirmed(clean),true);
  assert.equal(isCleanupConfirmed({...clean,children:[...clean.children,{status:'cancelled',cleanupConfirmed:false}]}),false);
  assert.equal(isCleanupConfirmed({...clean,shutdownResults:[{cleanup_confirmed:false}]}),false);
  assert.equal(isCleanupConfirmed({...clean,writerLeasePresent:true}),false);
  assert.equal(isCleanupConfirmed({...clean,activeCount:1}),false);
});
test('stale acceptance and missing live test coverage block the real transport gate',()=>{
  assert.throws(()=>assertOfflineAcceptance({passed:false}),/ACCEPTANCE_REQUIRED/);
  assert.throws(()=>assertOfflineAcceptance({passed:true,suite:'all',sourceUnchanged:true,coverage:[]}),/COVERAGE_MISSING/);
  assert.throws(()=>assertOfflineAcceptance({passed:true,suite:'all',sourceUnchanged:true,coverage:['live-budget-transport','live-evaluation','brokered-child','pilot-verifier'],sourceHashes:{}}),/HASH_MISSING/);
  const files=['src/live-evaluation.mjs','src/live-budget-transport.mjs','src/pilot-verifier.mjs','src/evaluation-acceptance.mjs','src/child-supervisor.ts','src/child-runner.mjs','tests/live-evaluation.test.mjs','tests/pilot-verifier.test.mjs'];
  const sourceHashes=Object.fromEntries(files.map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
  const report={passed:true,suite:'all',sourceUnchanged:true,coverage:['live-budget-transport','live-evaluation','brokered-child','pilot-verifier'],sourceHashes};
  assert.doesNotThrow(()=>assertOfflineAcceptance(report));
  report.sourceHashes['src/live-evaluation.mjs']='stale';
  assert.throws(()=>assertOfflineAcceptance(report),/ACCEPTANCE_STALE/);
});
