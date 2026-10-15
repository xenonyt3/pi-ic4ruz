import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { root, canonicalPath, isWithin, resolvePrototypePaths } from '../src/paths.mjs';
import { buildChildEnv, assertIsolation } from '../launch.mjs';
import { auditBaseline, sha256 } from './audit-baseline.mjs';

const suites = {
  core:['isolation','offline-guard','codemode','discovery-policy','tool-pipeline','harness','evaluation-budget'],
  windows:['file-tools','windows-tools','batching','batching-runtime'],
  context:['context-store','store-runtime','compaction','context-recovery','brain-telemetry','brain-reconnect','provider-transport'],
  delegation:['delegation','delegation-process','delegation-recovery'],
  provider:['provider-transport'],
  live:['live-budget-transport','live-evaluation','brokered-child','pilot-verifier'],
  ui:['reason-ui','transcript-hook','assistant-hook','thinking-hook','startup-working'],
};
suites.all=[...new Set(Object.values(suites).flat())];
function verifyRuntimes(){
  const active=resolvePrototypePaths();
  assertIsolation(active,path.join(root,'workspace'));
  if(active.selection!=='stock')assertIsolation(resolvePrototypePaths(root,'stock'),path.join(root,'workspace'));
  else if(fs.existsSync(path.join(root,'config/runtime-candidate.json')))assertIsolation(resolvePrototypePaths(root,'transcript-hook-v1'),path.join(root,'workspace'));
}
function sourceSnapshot(files){
  const hashes={};
  const add=file=>{hashes[path.relative(root,file)]=sha256(fs.readFileSync(file));};
  const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(entry.isFile())add(file);}};
  for(const dir of ['src','extensions','prompts','config','scripts','tests/helpers'])walk(path.join(root,dir));
  for(const file of ['tools/typecheck/package.json','tools/typecheck/package-lock.json','tools/typecheck/node_modules/typescript/lib/typescript.js'])add(path.join(root,file));
  const oracle=path.join(root,'artifacts/ui-reference/20261015/source-oracle.json');
  if(fs.existsSync(oracle))add(oracle);
  for(const file of [...files,...['launch.mjs','agent/settings.json','agent/models.json','runtime/package.json','runtime/package-lock.json','runtime/exports.mjs','tests/fixtures/manifest.json'].map(file=>path.join(root,file))])add(file);
  return hashes;
}
function vaultSnapshot(){
  const files={};const vault='D:/.vault-brain/vault';
  const walk=dir=>{for(const name of fs.readdirSync(dir)){if(['.open-second-brain','.obsidian'].includes(name))continue;const file=path.join(dir,name);const stat=fs.lstatSync(file);if(stat.isSymbolicLink())continue;if(stat.isDirectory())walk(file);else if(file.endsWith('.md'))files[file]=sha256(fs.readFileSync(file));}};
  walk(vault);return files;
}
const args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--suite'||!Object.hasOwn(suites,args[1])){
  console.error('Unknown or unavailable suite. Use --suite core|windows|context|delegation|provider|all');process.exitCode=1;
}else{
  if(!auditBaseline().passed)throw new Error('BASELINE_CHANGED_BEFORE_TEST');
  verifyRuntimes();
  const vaultBefore=vaultSnapshot();
  const dir=path.join(root,'artifacts/verification/runs',new Date().toISOString().replaceAll(':','-'));
  const temporary=path.join(dir,'tmp');const receipts=path.join(dir,'network');fs.mkdirSync(temporary,{recursive:true});fs.mkdirSync(receipts);
  const env=buildChildEnv();env.TEMP=temporary;env.TMP=temporary;env.PROTOTYPE_GUARD_DIR=receipts;
  env.PI_CODING_AGENT_DIR=path.join(temporary,'agent');env.PI_CODING_AGENT_SESSION_DIR=path.join(temporary,'sessions');
  const files=suites[args[1]].map(name=>path.join(root,'tests',`${name}.test.mjs`));
  const sourceHashes=sourceSnapshot(files);
  const child=spawn(process.execPath,['--import',pathToFileURL(path.join(root,'src/offline-guard.mjs')).href,'--test','--test-concurrency=1',...files],{cwd:path.join(root,'workspace'),env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{output+=data;process.stdout.write(data);});
  const [code,signal]=await once(child,'close');
  fs.writeFileSync(path.join(dir,'output.txt'),output);
  const after=auditBaseline();const vaultAfter=vaultSnapshot();
  const vaultUnchanged=JSON.stringify(vaultBefore)===JSON.stringify(vaultAfter);
  const sourceUnchanged=JSON.stringify(sourceHashes)===JSON.stringify(sourceSnapshot(files));
  let runtimeUnchanged=true,runtimeError=null;
  try{verifyRuntimes();}catch(error){runtimeUnchanged=false;runtimeError=String(error.message);}
  const network=[],receiptErrors=[];
  const receiptNames=fs.readdirSync(receipts);
  for(const file of receiptNames.filter(file=>file.endsWith('.json'))){
    try{network.push(JSON.parse(fs.readFileSync(path.join(receipts,file),'utf8')));}
    catch{receiptErrors.push(file);}
  }
  const missingTestReceipts=files.filter(file=>!network.some(record=>record.entrypoint&&path.resolve(record.entrypoint)===path.resolve(file)));
  const unexpectedNetworkAttempts=network.reduce((sum,r)=>sum+Math.max(0,r.blockedNetworkAttempts-(r.expectedBlockedAttempts??0)),0);
  const counts={};for(const key of ['tests','pass','fail','cancelled','skipped'])counts[key]=Number(output.match(new RegExp(`(?:^|\\n)[^\\n]*?${key} (\\d+)`))?.[1]??0);
  const report={suite:args[1],stage:'T1-T5-offline',createdAt:new Date().toISOString(),code,signal,
    passed:code===0&&after.passed&&vaultUnchanged&&sourceUnchanged&&runtimeUnchanged&&unexpectedNetworkAttempts===0&&counts.tests>0&&counts.tests===counts.pass&&counts.cancelled===0&&counts.skipped===0&&receiptErrors.length===0&&missingTestReceipts.length===0,
    counts,baseline:after,vaultUnchanged,sourceUnchanged,runtimeUnchanged,runtimeError,sourceHashes,unexpectedNetworkAttempts,networkReceiptCount:network.length,receiptErrors,missingTestReceipts,interruptedReceiptUpdates:receiptNames.filter(file=>file.endsWith('.tmp')).length,
    coverage:suites[args[1]],externalInference:'disabled',liveCompatibility:'unknown',uiParity:'unknown',
    runtimeIdentityHash:sha256(fs.readFileSync(path.join(root,'config/runtime-identity.json'))),
    candidateIdentityHash:fs.existsSync(path.join(root,'config/runtime-candidate.json'))?sha256(fs.readFileSync(path.join(root,'config/runtime-candidate.json'))):null,
    fixtureManifestHash:sha256(fs.readFileSync(path.join(root,'tests/fixtures/manifest.json'))),
    configurationHashes:Object.fromEntries(['config/harness.json','config/child-profiles.json','agent/settings.json','agent/models.json','prompts/harness.md'].map(file=>[file,sha256(fs.readFileSync(path.join(root,file)))])),
    testHashes:Object.fromEntries(files.map(file=>[path.basename(file),sha256(fs.readFileSync(file))]))};
  fs.writeFileSync(path.join(dir,'output.txt'),output);fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));
  fs.writeFileSync(path.join(root,'artifacts/verification',`${args[1]}-latest.json`),JSON.stringify({...report,reportPath:path.join(dir,'report.json')},null,2));
  fs.writeFileSync(path.join(root,'artifacts/verification/latest.json'),JSON.stringify({...report,reportPath:path.join(dir,'report.json')},null,2));
  if(report.passed){if(!isWithin(canonicalPath(dir),canonicalPath(temporary)))throw new Error('UNSAFE_FIXTURE_CLEANUP');fs.rmSync(temporary,{recursive:true,force:true});}
  else process.exitCode=1;
  console.log(JSON.stringify({report:path.join(dir,'report.json'),passed:report.passed,unexpectedNetworkAttempts,vaultUnchanged}));
}
