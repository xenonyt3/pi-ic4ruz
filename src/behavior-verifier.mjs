import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {root} from './paths.mjs';
import {loadBehaviorCorpus,digest,scopeChanges} from './behavior-corpus.mjs';

async function verifyModules(task,sources) {
  const receipt={protocol:1,taskId:task.id,sourceHash:digest(sources),total:task.checks.length,passed:0,completed:false,failures:[]};
  try{
    const context=vm.createContext(Object.create(null),{codeGeneration:{strings:false,wasm:false}}),modules=new Map();
    const denyImport=()=>{throw vm.runInContext('new Error("IMPORT_DENIED")',context);};
    for(const [name,source]of Object.entries(sources))modules.set(name,new vm.SourceTextModule(source,{context,identifier:name,importModuleDynamically:denyImport}));
    const linker=(specifier,referencing)=>{
      if(!specifier.startsWith('./')&&!specifier.startsWith('../'))return denyImport();
      const name=path.posix.normalize(path.posix.join(path.posix.dirname(referencing.identifier),specifier));
      if(!modules.has(name))return denyImport();return modules.get(name);
    };
    for(const module of modules.values())if(module.status==='unlinked')await module.link(linker);
    for(const module of modules.values())if(module.status!=='evaluated')await module.evaluate({timeout:1000});
    const namespaces=Object.create(null);for(const [name,module]of modules)namespaces[name]=module.namespace;
    Object.defineProperty(context,'M',{value:namespaces});
    for(const [name,expression]of task.checks){
      try{if(vm.runInContext(expression,context,{timeout:1000})===true)receipt.passed++;else receipt.failures.push(name);}catch{receipt.failures.push(name);}
    }
    receipt.completed=true;
  }catch{receipt.error='CANDIDATE_MODULE_REJECTED';}
  return receipt;
}
function verifyFindings(task,workspace) {
  const receipt={protocol:1,taskId:task.id,total:3,passed:0,completed:true,failures:[]};
  let findings;
  try{findings=JSON.parse(fs.readFileSync(path.join(workspace,'findings.json'),'utf8')).findings;}catch{}
  const items=Array.isArray(findings)?findings:[];
  const valid=items.every(f=>typeof f.explanation==='string'&&f.explanation.trim().length>0);
  const billing=items.filter(f=>f.file==='src/billing.mjs'&&f.symbol==='shippingCents');
  const access=items.filter(f=>f.file==='src/access.mjs'&&f.symbol==='canView');
  const checks=[['complete finding schema',valid&&items.length===2&&billing.length===1&&access.length===1],
    ['billing counterexample',billing.some(f=>f.input===10000&&f.expected===0&&f.actual===500)],
    ['access counterexample',access.some(f=>f.input?.role==='viewer'&&f.input?.assigned===false&&f.expected===false&&f.actual===true)]];
  for(const [name,passed]of checks)if(passed)receipt.passed++;else receipt.failures.push(name);
  return receipt;
}
export function verifyBehaviorWorkspace(task,workspace,{timeout=15000}={}) {
  let scope;
  try{scope=scopeChanges(task,workspace);}catch{return {passed:false,scope:null,error:'WORKSPACE_REJECTED'};}
  if(task.id==='investigation'){
    const receipt=verifyFindings(task,workspace);
    return {passed:scope.violations.length===0&&receipt.passed===receipt.total,scope,receipt};
  }
  const sources={};
  for(const file of Object.keys(task.files).filter(file=>file.startsWith('src/')&&file.endsWith('.mjs')).sort()){
    if(!scope.files[file]||fs.statSync(path.join(workspace,file)).size>262144)return {passed:false,scope,error:'CANDIDATE_MISSING_OR_TOO_LARGE'};
    sources[file]=fs.readFileSync(path.join(workspace,file),'utf8');
  }
  // Reuse the pilot verifier's isolated subprocess/VM approach for a small,
  // allowlisted module graph. Never execute candidate test scripts as the oracle.
  const execution=spawnSync(process.execPath,['--import',pathToFileURL(path.join(root,'src/offline-guard.mjs')).href,'--experimental-vm-modules',fileURLToPath(import.meta.url),'--worker',task.id],{
    input:JSON.stringify(sources),cwd:workspace,encoding:'utf8',windowsHide:true,timeout,maxBuffer:65536,
    env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,TEMP:process.env.TEMP,TMP:process.env.TMP,
      PI_CODING_AGENT_DIR:process.env.PI_CODING_AGENT_DIR??path.join(root,'tests/.tmp/verifier-agent'),
      ...(process.env.PROTOTYPE_GUARD_DIR?{PROTOTYPE_GUARD_DIR:process.env.PROTOTYPE_GUARD_DIR}:{})}
  });
  let receipt;try{receipt=JSON.parse(execution.stdout.trim());}catch{}
  const passed=execution.status===0&&scope.violations.length===0&&receipt?.protocol===1&&receipt.taskId===task.id&&receipt.sourceHash===digest(sources)&&receipt.completed===true&&receipt.total===task.checks.length&&receipt.passed===receipt.total&&receipt.failures.length===0;
  return {passed,scope,receipt:receipt??null,error:execution.error?.code??null};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  const task=loadBehaviorCorpus().tasks.find(task=>task.id===process.argv[3]);
  if(process.argv[2]!=='--worker'||!task)throw Error('BEHAVIOR_VERIFIER_ARGUMENT');
  const receipt=await verifyModules(task,JSON.parse(fs.readFileSync(0,'utf8')));
  process.stdout.write(JSON.stringify(receipt));process.exitCode=receipt.completed&&receipt.passed===receipt.total?0:1;
}
