import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {root,canonicalPath,isWithin} from './paths.mjs';

export const corpusRoot=path.join(root,'tests/fixtures/behavior');
export const digest=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
export function loadBehaviorCorpus() {
  const manifest=JSON.parse(fs.readFileSync(path.join(corpusRoot,'manifest.json'),'utf8'));
  if(manifest.schemaVersion!==1)throw new Error('BEHAVIOR_MANIFEST_VERSION');
  const tasks=manifest.tasks.map(id=>{
    if(!/^[a-z-]+$/.test(id))throw new Error('BEHAVIOR_TASK_ID');
    const task=JSON.parse(fs.readFileSync(path.join(corpusRoot,id+'.json'),'utf8'));
    if(task.id!==id||task.schemaVersion!==1)throw new Error('BEHAVIOR_TASK_INVALID');
    for(const [name,content]of Object.entries(task.files)){
      if(!/^[a-zA-Z0-9_./-]+$/.test(name)||name.split('/').includes('..')||path.isAbsolute(name)||digest(content)!==task.fileHashes[name])throw new Error('BEHAVIOR_FIXTURE_DRIFT');
    }
    return task;
  });
  const gitConfigHash=digest(fs.readFileSync(path.join(corpusRoot,'empty-gitconfig')));
  return {manifest,tasks,hash:digest({manifest,tasks,gitConfigHash})};
}
export function snapshotWorkspace(workspace) {
  const base=canonicalPath(workspace),files={};
  const walk=dir=>{
    for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
      const file=path.join(dir,entry.name),relative=path.relative(workspace,file).replaceAll('\\','/');
      if(entry.isSymbolicLink()||!isWithin(base,canonicalPath(file)))throw new Error('BEHAVIOR_WORKSPACE_LINK');
      if(dir===workspace&&entry.name==='.git'&&entry.isDirectory())continue;
      if(entry.isDirectory())walk(file);
      else if(entry.isFile())files[relative]=digest(fs.readFileSync(file));
      else throw new Error('BEHAVIOR_WORKSPACE_SPECIAL_FILE');
    }
  };
  walk(workspace);return files;
}
export function createBehaviorWorkspace(task,workspace) {
  const allowed=[path.join(root,'tests/.tmp'),path.join(root,'artifacts/evaluations')];
  if(!allowed.some(dir=>isWithin(canonicalPath(dir),canonicalPath(workspace)))||fs.existsSync(workspace))throw new Error('BEHAVIOR_WORKSPACE_NOT_FRESH');
  fs.mkdirSync(workspace,{recursive:true});
  for(const [name,content]of Object.entries(task.files)){
    const file=path.join(workspace,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content);
  }
  // Keep ordinary git status/diff inside the fixture instead of its parent checkout.
  const env={};
  for(const name of ['SystemRoot','WINDIR','TEMP','TMP','PATH','PATHEXT','ComSpec'])if(process.env[name])env[name]=process.env[name];
  Object.assign(env,{GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:path.join(corpusRoot,'empty-gitconfig'),
    GIT_AUTHOR_NAME:'Behavior Fixture',GIT_AUTHOR_EMAIL:'behavior-fixture@example.invalid',
    GIT_COMMITTER_NAME:'Behavior Fixture',GIT_COMMITTER_EMAIL:'behavior-fixture@example.invalid',
    GIT_AUTHOR_DATE:'2000-01-01T00:00:00Z',GIT_COMMITTER_DATE:'2000-01-01T00:00:00Z'});
  const common=['-c','core.autocrlf=false','-c','commit.gpgsign=false','-c','gc.auto=0','-c','maintenance.auto=false',
    '-c','init.defaultBranch=fixture','-c',`core.hooksPath=${path.join(workspace,'.git/no-hooks')}`];
  for(const args of [['init','--quiet','--template='],['add','--','.'],['commit','--quiet','-m','Behavior fixture baseline']]){
    const result=spawnSync(process.platform==='win32'?'git.exe':'git',[...common,...args],{cwd:workspace,env,encoding:'utf8',windowsHide:true,timeout:15000});
    if(result.status!==0)throw new Error('BEHAVIOR_GIT_INITIALIZATION_FAILED');
  }
  const actual=snapshotWorkspace(workspace);
  if(Object.keys(actual).length!==Object.keys(task.fileHashes).length||Object.entries(task.fileHashes).some(([file,hash])=>actual[file]!==hash))throw new Error('BEHAVIOR_STARTING_TREE_MISMATCH');
  return actual;
}
export function scopeChanges(task,workspace) {
  const after=snapshotWorkspace(workspace);
  const changes=[...new Set([...Object.keys(task.fileHashes),...Object.keys(after)])].filter(file=>task.fileHashes[file]!==after[file]).sort();
  return {changes,violations:changes.filter(file=>!task.allowedChanges.includes(file)),hash:digest(after),files:after};
}
