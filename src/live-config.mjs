import fs from 'node:fs';
import path from 'node:path';
import { root, canonicalPath, isWithin, protectedRoots } from './paths.mjs';
import { validateBudget, validateInteractiveAccounting } from './evaluation-budget.mjs';

const label = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._/+-]{0,159}$/.test(value);
export function validateLiveConfig(config, {env=process.env,cwd=process.cwd()}={}) {
  if(!config||config.schemaVersion!==1||config.mode!=='interactive-live')throw new Error('LIVE_CONFIG_REQUIRED');
  if(!label(config.provider)||!label(config.model)||!Array.isArray(config.models)||!config.models.includes(config.model))throw new Error('LIVE_EXPLICIT_MODEL_REQUIRED');
  if(config.api!=='openai-completions')throw new Error('LIVE_API_UNSUPPORTED: openai-completions required');
  let url;try{url=new URL(config.baseUrl);}catch{throw new Error('LIVE_ENDPOINT_INVALID');}
  if(url.username||url.password||url.search||url.hash||!['http:','https:'].includes(url.protocol)||
    (url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw new Error('LIVE_ENDPOINT_INVALID');
  if(!Array.isArray(config.responseModels)||!config.responseModels.length||!config.responseModels.every(label))throw new Error('LIVE_RESPONSE_MODELS_REQUIRED');
  if(!['off','minimal','low','medium','high'].includes(config.thinkingLevel))throw new Error('LIVE_THINKING_LEVEL_REQUIRED');
  if(!Number.isSafeInteger(config.contextWindow)||config.contextWindow<4096)throw new Error('LIVE_CONTEXT_WINDOW_REQUIRED');
  if(!/^[A-Z][A-Z0-9_]*$/.test(config.credentialEnv??''))throw new Error('LIVE_CREDENTIAL_ENV_REQUIRED');
  const key=env[config.credentialEnv];
  if(typeof key!=='string'||!key.trim()||/[\r\n]/.test(key)||key==='offline-fixture-not-a-credential')throw new Error('LIVE_CREDENTIAL_UNAVAILABLE');
  const accountingOnly=config.accounting!==undefined;
  if(accountingOnly&&config.budget!==undefined)throw new Error('LIVE_ACCOUNTING_BUDGET_CONFLICT');
  const a=config.accounting;
  if(accountingOnly&&(!a||a.mode!=='provider'||!/^[-a-zA-Z0-9_]{1,80}$/.test(a.id??'')||
    Object.keys(a).some(key=>!['mode','id','perRequestMaxOutputTokens'].includes(key))))throw new Error('LIVE_ACCOUNTING_CONFIG_INVALID');
  const b=accountingOnly?{allowanceId:a.id,accountingOnly:true,maxRequests:null,maxInputTokens:null,maxOutputTokens:null,maxDurationMs:null,perRequestMaxOutputTokens:a.perRequestMaxOutputTokens??4000}:config.budget;
  if(!accountingOnly&&(!b||!/^[-a-zA-Z0-9_]{1,80}$/.test(b.allowanceId??'')||b.authorized!==true))throw new Error('LIVE_NEW_ALLOWANCE_REQUIRED');
  if(!Number.isSafeInteger(b.perRequestMaxOutputTokens)||b.perRequestMaxOutputTokens<1||b.perRequestMaxOutputTokens>=config.contextWindow)throw new Error('LIVE_OUTPUT_CAP_REQUIRED');
  if(b.maxCost!==undefined)throw new Error('LIVE_COST_CAP_UNSUPPORTED: use explicit token caps');
  const budgetKeys=new Set(['allowanceId','authorized','maxRequests','maxInputTokens','maxOutputTokens','maxDurationMs','perRequestMaxOutputTokens']);
  if(!accountingOnly&&Object.keys(b).some(k=>!budgetKeys.has(k)))throw new Error('LIVE_BUDGET_UNKNOWN_FIELD');
  if(b.maxDurationMs>2147483647)throw new Error('LIVE_DURATION_TOO_LONG');
  const workspace=canonicalPath(cwd),control=canonicalPath(path.join(root,'agent'));
  if(isWithin(workspace,control)||isWithin(control,workspace)||protectedRoots.some(p=>isWithin(canonicalPath(p),workspace)))throw new Error('LIVE_WORKSPACE_ISOLATION_REQUIRED: use workspace/ or a separate task directory');
  const budget=(accountingOnly?validateInteractiveAccounting:validateBudget)({...b,maxAttempts:1,provider:config.provider,model:config.model,thinkingLevel:config.thinkingLevel,
    responseModels:config.responseModels,brainEnabled:false,workspace,contextWindow:config.contextWindow});
  return {config,budget,key,workspace,endpoint:url.href.replace(/\/$/,'')+'/chat/completions'};
}

export function loadLiveConfig(file,options) {
  const directory=canonicalPath(path.join(root,'agent/live-private'));
  if(!isWithin(directory,canonicalPath(file)))throw new Error('LIVE_CONFIG_LOCATION: store config under agent/live-private/');
  let config;try{config=JSON.parse(fs.readFileSync(file,'utf8'));}catch{throw new Error('LIVE_CONFIG_INVALID: expected local JSON');}
  // Credentials are read only from the named environment variable, never config text.
  const allowed=new Set(['schemaVersion','mode','provider','api','baseUrl','models','model','responseModels','thinkingLevel','contextWindow','credentialEnv','budget','accounting']);
  if(Object.keys(config).some(k=>!allowed.has(k)))throw new Error('LIVE_CONFIG_UNKNOWN_FIELD');
  return validateLiveConfig(config,options);
}

export function parseLiveArgs(args) {
  const result={};
  for(let i=0;i<args.length;i++){
    const flag=args[i];
    if(['--live','--check','--continue','--help'].includes(flag)){if(result[flag.slice(2)])throw new Error('LIVE_DUPLICATE_ARGUMENT');result[flag.slice(2)]=true;continue;}
    if(!['--config','--session'].includes(flag)||!args[i+1]||args[i+1].startsWith('--'))throw new Error('LIVE_ARGUMENT_REJECTED');
    if(result[flag.slice(2)])throw new Error('LIVE_DUPLICATE_ARGUMENT');result[flag.slice(2)]=args[++i];
  }
  if(result.help)return result;
  if(!result.live||!result.config)throw new Error('LIVE_OPT_IN_REQUIRED: --live --config PATH');
  if(result.continue&&result.session)throw new Error('LIVE_RESUME_ARGUMENT_CONFLICT');
  return result;
}
