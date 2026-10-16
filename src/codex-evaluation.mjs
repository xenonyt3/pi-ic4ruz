import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {StringDecoder} from 'node:string_decoder';
import {root,canonicalPath,isWithin} from './paths.mjs';
import {digest} from './behavior-corpus.mjs';
import {createCodexBudgetBroker} from './codex-budget-broker.mjs';
import {spawnOwnedProcess,terminateTreeAndConfirm} from './process-lifecycle.mjs';
import {acquireWriterLease,releaseWriterLease,markWriterCleanupUnconfirmed} from './workspace-ownership.ts';

export function verifyCodexExecutable(executable) {
  const pin=JSON.parse(fs.readFileSync(path.join(root,'config/codex-benchmark.json'),'utf8'));
  if(process.platform!==pin.platform||!executable||!path.isAbsolute(executable)||!fs.existsSync(executable)||!fs.statSync(executable).isFile()||digest(fs.readFileSync(executable))!==pin.sha256)throw Error('CODEX_EXECUTABLE_PIN_MISMATCH');
  const result=spawnSync(executable,['--version'],{encoding:'utf8',windowsHide:true,timeout:10000});
  if(result.status!==0||result.stdout.trim()!==pin.version)throw Error('CODEX_VERSION_MISMATCH');
  return pin;
}

export function codexConfiguration({model,contextWindow,thinkingLevel},baseUrl) {
  return `model = ${JSON.stringify(model)}
model_provider = "benchmark"
model_reasoning_effort = ${JSON.stringify(thinkingLevel)}
model_context_window = ${contextWindow}
model_auto_compact_token_limit = ${Math.floor(contextWindow*0.75)}
approval_policy = "never"
sandbox_mode = "workspace-write"
web_search = "disabled"
allow_login_shell = false
project_doc_max_bytes = 0
check_for_update_on_startup = false
[windows]
sandbox = "unelevated"
[sandbox_workspace_write]
network_access = false
[analytics]
enabled = false
[history]
persistence = "none"
[agents]
enabled = false
max_concurrent_threads_per_session = 1
max_depth = 0
[skills]
include_instructions = false
[skills.bundled]
enabled = false
[features]
multi_agent = false
apps = false
plugins = false
remote_plugin = false
hooks = false
memories = false
skill_search = false
skill_mcp_dependency_install = false
api_key_model_discovery = false
enable_request_compression = false
unbounded_connection_retries = false
daemon_auto_start = false
shell_snapshot = false
browser_use = false
computer_use = false
image_generation = false
in_app_updates = false
[shell_environment_policy]
inherit = "all"
include_only = ["PATH", "PATHEXT", "SystemRoot", "WINDIR", "ComSpec", "TEMP", "TMP"]
[model_providers.benchmark]
name = "9router bounded benchmark"
base_url = ${JSON.stringify(baseUrl)}
wire_api = "responses"
env_key = "CODEX_BENCHMARK_TOKEN"
requires_openai_auth = false
supports_websockets = false
request_max_retries = 0
stream_max_retries = 0
stream_idle_timeout_ms = 120000
[model_providers.benchmark.capabilities]
remote_compaction = "unsupported"
`;
}

export async function runCodexCell({config,budget,key,workspace,directory,executable,fetchImpl,signal,onGate=()=>{},onEvent=()=>{}}) {
  verifyCodexExecutable(executable);
  for(const dir of [workspace,directory])if(!isWithin(canonicalPath(root),canonicalPath(dir)))throw Error('CODEX_DIRECTORY_ESCAPE');
  const home=path.join(directory,'codex-home'),temporary=path.join(directory,'tmp'),receipt=path.join(directory,'process-receipt.json');
  fs.mkdirSync(home,{recursive:true});fs.mkdirSync(temporary,{recursive:true});
  const broker=await createCodexBudgetBroker({budget,baseUrl:config.baseUrl,key,ledgerPath:path.join(directory,'ledger.json'),fetchImpl,listenLoopback:fetchImpl?.listenLoopback});
  const {gate}=broker;onGate(gate);
  const events=[],decoder=new StringDecoder('utf8');let lease,child,killing,cleanupConfirmed=false,failure,exitCode,buffer='',bytes=0;
  const abort=()=>{
    if(!gate.abortController.signal.aborted)gate.stop('campaign_cancelled');
    if(child?.pid&&child.exitCode===null&&child.signalCode===null)killing??=terminateTreeAndConfirm(child);
  };
  try{
    gate.assertOpen();
    if(signal?.aborted)throw Error('CODEX_CANCELLED_BEFORE_START');
    lease=await acquireWriterLease({workspace,owner:'codex-benchmark-'+budget.allowanceId});
    gate.assertOpen();if(signal?.aborted)throw Error('CODEX_CANCELLED_BEFORE_START');
    fs.writeFileSync(path.join(home,'config.toml'),codexConfiguration(config,broker.baseUrl));
    const env={};
    for(const name of ['PATH','PATHEXT','SystemRoot','WINDIR','ComSpec'])if(process.env[name])env[name]=process.env[name];
    Object.assign(env,{CODEX_HOME:home,CODEX_BENCHMARK_TOKEN:broker.token,TEMP:temporary,TMP:temporary});
    const shell=path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
    child=spawnOwnedProcess(shell,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts/codex-job.ps1'),'-Executable',executable,'-Receipt',receipt],{cwd:workspace,env,stdio:['pipe','pipe','pipe']});
    gate.abortController.signal.addEventListener('abort',abort,{once:true});signal?.addEventListener('abort',abort,{once:true});
    const collect=line=>{
      if(!line.trim())return;
      try{const event=JSON.parse(line);events.push(event);onEvent(event);}catch{failure='CODEX_INVALID_EVENT';abort();}
    };
    child.stdout.on('data',data=>{
      bytes+=data.length;if(bytes>8*1024*1024){failure='CODEX_EVENT_LIMIT';abort();return;}
      buffer+=decoder.write(data);let n;while((n=buffer.indexOf('\n'))>=0){collect(buffer.slice(0,n));buffer=buffer.slice(n+1);}
    });
    let stderrBytes=0;
    child.stderr.on('data',data=>{stderrBytes+=data.length;if(stderrBytes<1024*1024)fs.appendFileSync(path.join(directory,'stderr.log'),data);else{failure='CODEX_STDERR_LIMIT';abort();}});
    const closed=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
    child.stdin.on('error',()=>{});
    child.stdin.end(config.prompt);
    const timer=setTimeout(()=>gate.stop('attempt_duration'),budget.maxDurationMs);timer.unref();
    try{exitCode=await closed;}finally{clearTimeout(timer);}
    buffer+=decoder.end();if(buffer)collect(buffer);
    if(killing)cleanupConfirmed=(await killing).status==='confirmed';
    if(fs.existsSync(receipt))cleanupConfirmed||=JSON.parse(fs.readFileSync(receipt,'utf8')).cleanupConfirmed===true;
    if(!cleanupConfirmed)failure='CODEX_CLEANUP_UNCONFIRMED';
    if(exitCode!==0)failure??='CODEX_PROCESS_FAILED';
  }catch{failure??='CODEX_RUN_FAILED';abort();if(killing)cleanupConfirmed=(await killing).status==='confirmed';else if(!child?.pid)cleanupConfirmed=true;}
  finally{
    signal?.removeEventListener('abort',abort);gate.abortController.signal.removeEventListener('abort',abort);
    await broker.close();
    if(lease){if(cleanupConfirmed)await releaseWriterLease(lease,{cleanupConfirmed:true});else markWriterCleanupUnconfirmed(lease,child?.pid);}
  }
  fs.writeFileSync(path.join(directory,'codex-events.jsonl'),events.map(event=>JSON.stringify(event)).join('\n')+'\n');
  const completed=events.some(event=>event.type==='turn.completed');
  const failed=events.some(event=>['turn.failed','error'].includes(event.type));
  const items=events.filter(event=>event.type==='item.completed').map(event=>event.item);
  return {gate,cleanupConfirmed,failure,exitCode,events,modelStopReason:completed&&!failed?'stop':'error',
    finalText:items.filter(item=>item?.type==='agent_message').map(item=>item.text).join('\n'),
    toolCalls:items.filter(item=>['command_execution','file_change','mcp_tool_call'].includes(item?.type)).map((item,index)=>({sequence:index+1,name:item.type,parentToolCallId:null})),
    toolErrors:items.filter(item=>item?.type==='command_execution'&&item.exit_code!==0).length};
}
