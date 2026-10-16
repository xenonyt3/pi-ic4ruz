import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {root,canonicalPath,isWithin,resolvePrototypePaths} from '../src/paths.mjs';
import {assertIsolation,buildChildEnv} from '../launch.mjs';
import {buildBehaviorPlan,validateBehaviorBudget} from '../src/behavior-plan.mjs';
import {prepareBehaviorCorpus,runBehaviorCampaign} from '../src/behavior-evaluation.mjs';
import {assertOfflineAcceptance} from '../src/evaluation-acceptance.mjs';
import {auditBaseline} from './audit-baseline.mjs';

function argumentsOf(args) {
  const result={};
  for(let i=0;i<args.length;i++){
    const flag=args[i];
    if(!['--prepare','--dry-run','--live','--config','--budget','--comparison','--codex'].includes(flag)||result[flag]!==undefined)throw Error('BEHAVIOR_ARGUMENT_REJECTED');
    if(['--config','--budget','--comparison','--codex'].includes(flag)){
      if(!args[i+1]||args[i+1].startsWith('--'))throw Error('BEHAVIOR_ARGUMENT_VALUE_REQUIRED');const value=args[++i];result[flag]=flag==='--comparison'?value:path.resolve(value);
    }else result[flag]=true;
  }
  if(['--prepare','--dry-run','--live'].filter(key=>result[key]).length>1)throw Error('BEHAVIOR_MODE_CONFLICT');
  if(!result['--live']&&(result['--config']||result['--budget']))throw Error('BEHAVIOR_LIVE_OPT_IN_REQUIRED');
  if(result['--codex']&&result['--comparison']!=='codex')throw Error('BEHAVIOR_COMPARISON_REQUIRED');
  return result;
}
function readPrivate(file) {
  if(!file||!isWithin(canonicalPath(path.join(root,'agent/live-private')),canonicalPath(file)))throw Error('BEHAVIOR_PRIVATE_CONFIG_REQUIRED');
  try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{throw Error('BEHAVIOR_PRIVATE_JSON_INVALID');}
}
function verifyRuntimePrerequisites() {
  if(!auditBaseline().passed)throw Error('BEHAVIOR_BASELINE_DRIFT');
  assertIsolation(resolvePrototypePaths(root,'stock'),path.join(root,'workspace'));
  assertIsolation(resolvePrototypePaths(),path.join(root,'workspace'));
}
export async function main(args=process.argv.slice(2)) {
  const options=argumentsOf(args),comparison=options['--comparison']??'stock-core',plan=buildBehaviorPlan({comparison});
  if(!options['--live']){
    await import('../src/offline-guard.mjs');
    if(options['--prepare']){
      verifyRuntimePrerequisites();
      if(comparison==='codex')(await import('../src/codex-evaluation.mjs')).verifyCodexExecutable(options['--codex']);
      const result=prepareBehaviorCorpus({comparison});
      const file=path.join(root,`artifacts/checkpoint/${comparison==='codex'?'codex-pi':'behavior'}-preparation.json`);
      fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(result,null,2)+'\n');
      if(!result.passed)throw Error('BEHAVIOR_PREPARATION_FAILED');
      console.log(JSON.stringify({prepared:true,modelRequests:0,checks:result.checks,protocolHash:plan.protocolHash,proposedBudget:plan.limits}));
    }else console.log(JSON.stringify(plan,null,2));
    return;
  }
  if(process.execArgv.some(arg=>arg.startsWith('--input-type')))throw Error('LIVE_FILE_ENTRYPOINT_REQUIRED');
  const approval=readPrivate(options['--budget']);validateBehaviorBudget(approval,plan);
  const report=JSON.parse(fs.readFileSync(path.join(root,'artifacts/verification/all-latest.json'),'utf8'));
  assertOfflineAcceptance(report);
  for(const name of ['behavior-verifier','behavior-evaluation'])if(!report.coverage.includes(name))throw Error('BEHAVIOR_ACCEPTANCE_REQUIRED');
  if(comparison==='codex'){
    if(!report.coverage.includes('codex-evaluation'))throw Error('CODEX_ACCEPTANCE_REQUIRED');
    const native=JSON.parse(fs.readFileSync(path.join(root,'artifacts/checkpoint/codex-native-fixture.json'),'utf8'));
    if(!native.passed||native.protocolHash!==plan.protocolHash)throw Error('CODEX_NATIVE_FIXTURE_REQUIRED');
    (await import('../src/codex-evaluation.mjs')).verifyCodexExecutable(options['--codex']);
  }
  verifyRuntimePrerequisites();
  const config=readPrivate(options['--config']),key=process.env[config.credentialEnv];
  if(typeof key!=='string'||!key)throw Error('LIVE_CREDENTIAL_UNAVAILABLE');
  const clean=buildChildEnv();delete clean[config.credentialEnv];
  for(const name of Object.keys(process.env))if(!(name in clean))delete process.env[name];Object.assign(process.env,clean);
  process.env.PI_CODING_AGENT_DIR=path.join(root,'agent/live-private/behavior-control');
  process.env.PI_CODING_AGENT_SESSION_DIR=path.join(process.env.PI_CODING_AGENT_DIR,'sessions');
  process.env.npm_config_cache=path.join(process.env.PI_CODING_AGENT_DIR,'npm-cache');
  const {installLiveNetworkGuard}=await import('../src/live-network-guard.mjs');
  const fetchImpl=installLiveNetworkGuard(),controller=new AbortController();
  const abort=()=>controller.abort();process.once('SIGINT',abort);process.once('SIGTERM',abort);
  try{
    const result=await runBehaviorCampaign({config,approval,comparison,codexExecutable:options['--codex'],env:{[config.credentialEnv]:key},fetchImpl,signal:controller.signal,onProgress:event=>console.log(JSON.stringify(event))});
    console.log(JSON.stringify({status:result.state.status,stopReason:result.state.stopReason??null,usage:result.state.usage,allTasksCorrect:result.state.allTasksCorrect,humanReviewComplete:false,reasonParity:'unknown'}));
    if(result.state.status!=='finished'||!result.state.allTasksCorrect)process.exitCode=1;
  }finally{process.removeListener('SIGINT',abort);process.removeListener('SIGTERM',abort);}
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  main().catch(error=>{console.error(String(error?.message??'').match(/\b(?:BEHAVIOR|CODEX|LIVE|OFFLINE|RUNTIME|CANDIDATE|ISOLATION)_[A-Z_]+\b/)?.[0]??'BEHAVIOR_FAILED');process.exitCode=1;});
}
