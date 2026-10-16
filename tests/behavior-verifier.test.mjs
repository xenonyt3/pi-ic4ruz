import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {root} from '../src/paths.mjs';
import {loadBehaviorCorpus,createBehaviorWorkspace,scopeChanges} from '../src/behavior-corpus.mjs';
import {verifyBehaviorWorkspace} from '../src/behavior-verifier.mjs';

const base=path.join(root,'tests/.tmp');fs.mkdirSync(base,{recursive:true});
function fixture(task){const directory=fs.mkdtempSync(path.join(base,'behavior-verifier-')),workspace=path.join(directory,'workspace');createBehaviorWorkspace(task,workspace);return {workspace,dispose:()=>fs.rmSync(directory,{recursive:true,force:true})};}
function applyReference(task,workspace){for(const [file,content]of Object.entries(task.referenceChanges))fs.writeFileSync(path.join(workspace,file),content);}
const {tasks}=loadBehaviorCorpus();
for(const task of tasks)test(`behavior ${task.id}: initial tree fails, reference passes all checks with exact allowed scope`,()=>{
  const f=fixture(task);
  try{
    assert.equal(verifyBehaviorWorkspace(task,f.workspace).passed,false);
    applyReference(task,f.workspace);
    const result=verifyBehaviorWorkspace(task,f.workspace);assert.equal(result.passed,true,JSON.stringify(result));
    assert.equal(result.receipt.passed,result.receipt.total);assert.deepEqual(result.scope.violations,[]);
  }finally{f.dispose();}
});
test('behavior verifier rejects forged logs, imports, hangs and test tampering',()=>{
  const task=tasks.find(t=>t.id==='invoice'),f=fixture(task);
  try{
    for(const source of [
      "export function toCents(){process.exit(0)}",
      "import fs from 'node:fs'; export function toCents(){return 29}",
      "await import('node:fs').catch(e=>e.constructor.constructor('return process')().exit(0)); export function toCents(){return 29}",
      "console.log('{\"passed\":true}'); export function toCents(){return 29}",
      'export function toCents(){while(true){}}'
    ]){
      applyReference(task,f.workspace);fs.writeFileSync(path.join(f.workspace,'src/money.mjs'),source);
      assert.equal(verifyBehaviorWorkspace(task,f.workspace,{timeout:4000}).passed,false);
    }
    applyReference(task,f.workspace);fs.appendFileSync(path.join(f.workspace,'test/invoice.test.mjs'),'\n// changed\n');
    const result=verifyBehaviorWorkspace(task,f.workspace);assert.equal(result.passed,false);assert.deepEqual(result.scope.violations,['test/invoice.test.mjs']);
  }finally{f.dispose();}
});
test('investigation requires both reproducible counterexamples and unchanged source',()=>{
  const task=tasks.find(t=>t.id==='investigation'),f=fixture(task);
  try{
    applyReference(task,f.workspace);const output=path.join(f.workspace,'findings.json');
    const findings=JSON.parse(fs.readFileSync(output));findings.findings[0].actual=0;fs.writeFileSync(output,JSON.stringify(findings));
    assert.equal(verifyBehaviorWorkspace(task,f.workspace).passed,false);
    applyReference(task,f.workspace);fs.appendFileSync(path.join(f.workspace,'src/billing.mjs'),'\n');
    assert.equal(verifyBehaviorWorkspace(task,f.workspace).passed,false);
  }finally{f.dispose();}
});
test('workspace rejects reuse and symlink escapes before candidate evaluation',()=>{
  const task=tasks[0],f=fixture(task);
  try{
    assert.throws(()=>createBehaviorWorkspace(task,f.workspace),/NOT_FRESH/);
    const link=path.join(f.workspace,'external');fs.symlinkSync(path.join(root,'config'),link,'junction');
    assert.throws(()=>scopeChanges(task,f.workspace),/WORKSPACE_LINK/);
    assert.equal(verifyBehaviorWorkspace(task,f.workspace).passed,false);
    fs.rmdirSync(link);
  }finally{f.dispose();}
});
test('fixture git is isolated, clean initially, and detects edits and whitespace errors',()=>{
  const task=tasks[0],f=fixture(task);
  const git=args=>spawnSync(process.platform==='win32'?'git.exe':'git',args,{cwd:f.workspace,encoding:'utf8',windowsHide:true});
  try{
    assert.equal(path.resolve(git(['rev-parse','--show-toplevel']).stdout.trim()),f.workspace);
    assert.equal(git(['status','--porcelain']).stdout,'');
    assert.equal(git(['log','-1','--format=%ae']).stdout.trim(),'behavior-fixture@example.invalid');
    fs.appendFileSync(path.join(f.workspace,'src/money.mjs'),'// trailing whitespace  \n');
    assert.match(git(['diff','--name-only']).stdout,/src\/money.mjs/);
    assert.notEqual(git(['diff','--check']).status,0);
    assert.deepEqual(scopeChanges(task,f.workspace).changes,['src/money.mjs']);
  }finally{f.dispose();}
});
test('v2 rejects the sparse-array bug in the preserved v1 reference without rewriting v1 scores',()=>{
  const task=tasks.find(t=>t.id==='invoice'),f=fixture(task);
  try{
    const old=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/behavior/history/v1/invoice.json'),'utf8'));
    applyReference(old,f.workspace);
    const result=verifyBehaviorWorkspace(task,f.workspace);
    assert.equal(result.passed,false);assert.deepEqual(result.receipt.failures,['reject sparse invoices']);
    assert.equal(result.receipt.passed,8);assert.equal(result.receipt.total,9);
    applyReference(task,f.workspace);assert.equal(verifyBehaviorWorkspace(task,f.workspace).passed,true);
  }finally{f.dispose();}
});
