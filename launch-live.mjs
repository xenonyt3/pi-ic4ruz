import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { assertIsolation, buildChildEnv } from './launch.mjs';
import { parseLiveArgs, loadLiveConfig } from './src/live-config.mjs';
import { root } from './src/paths.mjs';
import { installLiveNetworkGuard } from './src/live-network-guard.mjs';

export async function main(args=process.argv.slice(2)) {
  const options=parseLiveArgs(args);
  if(options.help){console.log('Usage: node launch-live.mjs --live --config <agent/live-private/config.json> [--check | --continue | --session <owned.jsonl>]');return;}
  const resolved=loadLiveConfig(path.resolve(options.config));
  assertIsolation(undefined,resolved.workspace);
  const clean=buildChildEnv();
  delete clean[resolved.config.credentialEnv];
  for(const name of Object.keys(process.env))if(!(name in clean))delete process.env[name];
  Object.assign(process.env,clean);
  process.env.PI_CODING_AGENT_DIR=path.join(root,'agent/live-private/control');
  process.env.PI_CODING_AGENT_SESSION_DIR=path.join(root,'agent/live-private',resolved.budget.allowanceId,'sessions');
  const resumeLauncher=path.join(root,'agent/live-private',resolved.budget.allowanceId,'resume.mjs');
  fs.mkdirSync(path.dirname(resumeLauncher),{recursive:true});
  fs.writeFileSync(resumeLauncher,`import {main} from ${JSON.stringify(pathToFileURL(path.join(root,'launch-live.mjs')).href)};\nawait main(['--live','--config',${JSON.stringify(path.resolve(options.config))},...process.argv.slice(2)]);\n`);
  process.env.PI_PROTOTYPE_LAUNCHER=resumeLauncher;
  const fetchImpl=installLiveNetworkGuard();
  const {createLiveRuntime}=await import('./src/live-interactive.mjs');
  const live=await createLiveRuntime({...resolved,options,fetchImpl});
  if(options.check){console.log(live.status());await live.close();return;}
  console.log(live.status());
  const {sdk}=await import('./src/upstream.mjs');
  const mode=new sdk.InteractiveMode(live.host);
  const dispose=live.host.dispose.bind(live.host);
  live.host.dispose=async()=>{try{await dispose();}finally{live.gate.close();}};
  process.once('exit',()=>live.gate.close());
  try{await mode.run();}catch(error){await live.close();throw error;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  main().catch(error=>{const code=String(error?.message??'').match(/\b(?:LIVE|RUNTIME|CANDIDATE|ISOLATION|PROJECT|CAMPAIGN|INVALID|FOREIGN)_[A-Z_]+\b/)?.[0];console.error(code??'LIVE_STARTUP_FAILED: check local configuration/runtime; no automatic fallback');process.exitCode=1;});
}
