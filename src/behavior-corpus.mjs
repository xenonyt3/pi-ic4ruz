import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
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
  return {manifest,tasks,hash:digest({manifest,tasks})};
}
export function snapshotWorkspace(workspace) {
  const base=canonicalPath(workspace),files={};
  const walk=dir=>{
    for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
      const file=path.join(dir,entry.name),relative=path.relative(workspace,file).replaceAll('\\','/');
      if(entry.isSymbolicLink()||!isWithin(base,canonicalPath(file)))throw new Error('BEHAVIOR_WORKSPACE_LINK');
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
  const actual=snapshotWorkspace(workspace);
  if(Object.keys(actual).length!==Object.keys(task.fileHashes).length||Object.entries(task.fileHashes).some(([file,hash])=>actual[file]!==hash))throw new Error('BEHAVIOR_STARTING_TREE_MISMATCH');
  return actual;
}
export function scopeChanges(task,workspace) {
  const after=snapshotWorkspace(workspace);
  const changes=[...new Set([...Object.keys(task.fileHashes),...Object.keys(after)])].filter(file=>task.fileHashes[file]!==after[file]).sort();
  return {changes,violations:changes.filter(file=>!task.allowedChanges.includes(file)),hash:digest(after),files:after};
}
