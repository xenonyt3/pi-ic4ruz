import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateBudget } from './evaluation-budget.mjs';

const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const validCount=value=>Number.isSafeInteger(value)&&value>=0;
export class LiveBudgetTransport {
  constructor({budget,endpoint,ledgerPath,fetchImpl=globalThis.fetch,clock=Date.now,interactive=false,onChange=()=>{},api='openai-completions'}) {
    if(!['openai-completions','openai-responses'].includes(api))throw new Error('LIVE_API_UNSUPPORTED');
    this.api=api;
    this.budget=validateBudget(budget);this.endpoint=new URL(endpoint).href;this.file=ledgerPath;this.fetchImpl=fetchImpl;this.clock=clock;
    this.interactive=interactive;this.onChange=onChange;
    if(!interactive){
      if(budget.provider!=='9router'||budget.model!=='cx/gpt-6-astra'||budget.brainEnabled!==false)throw new Error('LIVE_SCOPE_MISMATCH');
      if(budget.perRequestMaxOutputTokens!==1000||budget.maxRequests>12||budget.maxInputTokens>120000||budget.maxOutputTokens>12000||budget.maxDurationMs>900000)throw new Error('LIVE_AUTHORIZATION_LIMIT');
    }
    if(!Number.isSafeInteger(budget.perRequestMaxOutputTokens)||budget.perRequestMaxOutputTokens<1)throw new Error('INVALID_OUTPUT_CAP');
    if(budget.maxCost!==undefined)throw new Error('LIVE_COST_CAP_UNSUPPORTED: use explicit token caps');
    const fingerprint=hash({budget,endpoint:this.endpoint,...(api==='openai-responses'?{api}:{})});
    this.abortController=new AbortController();this.timer=undefined;
    fs.mkdirSync(path.dirname(ledgerPath),{recursive:true});
    this.lock=ledgerPath+'.lock';
    try{fs.mkdirSync(this.lock);}catch{throw new Error('LIVE_LEDGER_LOCKED: another launcher or interrupted owner requires review');}
    try{
      fs.writeFileSync(path.join(this.lock,'owner.json'),JSON.stringify({pid:process.pid}));
      this.state=fs.existsSync(ledgerPath)?JSON.parse(fs.readFileSync(ledgerPath,'utf8')):{schemaVersion:1,fingerprint,model:budget.model,provider:budget.provider,startedAt:null,status:'ready',requests:[],attempts:[],inputTokens:0,outputTokens:0};
      if(this.state.fingerprint!==fingerprint)throw new Error('CAMPAIGN_CONFIGURATION_CHANGED');
      if(!interactive&&this.state.requests.length)throw new Error('CAMPAIGN_ALREADY_USED: no automatic rerun or budget reset');
      // A crash may have sent a request without recording its usage. Never refund it.
      for(const record of this.state.requests.filter(r=>r.status==='pending')){delete record.rawUsage;this.finish(record);}
      if(interactive&&this.state.status==='finished')this.state.status='ready';
      this.persist();this.armTimer();
    }catch(error){fs.rmSync(this.lock,{recursive:true,force:true});throw error;}
  }
  persist(){const tmp=this.file+'.tmp';const fd=fs.openSync(tmp,'w',0o600);try{fs.writeFileSync(fd,JSON.stringify(this.state,null,2));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(tmp,this.file);this.onChange(this.state);}
  armTimer(){
    if(this.timer||this.state.startedAt===null||!this.allowsModelTurns())return;
    const remaining=this.remainingMs();
    if(!remaining){this.stop('duration');return;}
    this.timer=setTimeout(()=>this.stop('duration'),Math.min(remaining,2147483647));this.timer.unref();
  }
  allowsModelTurns(){return !['stopped','finished'].includes(this.state.status);}
  assertOpen(){if(!this.allowsModelTurns()||this.abortController.signal.aborted)throw new Error(`LIVE_BUDGET_STOP: ${this.state.stopReason??this.state.status}`);}
  beginAttempt(condition){this.assertOpen();if(this.state.attempts.length>=this.budget.maxAttempts)throw new Error('ATTEMPT_LIMIT');this.state.attempts.push({condition,at:new Date(this.clock()).toISOString()});this.persist();}
  stop(reason){this.state.status='stopped';this.state.stopReason??=reason;this.persist();this.abortController.abort(new Error(`LIVE_BUDGET_STOP: ${reason}`));}
  remainingMs(){return this.state.startedAt===null?this.budget.maxDurationMs:Math.max(0,this.budget.maxDurationMs-(this.clock()-this.state.startedAt));}
  reserve(payload,kind,condition){
    this.assertOpen();if(this.remainingMs()===0){this.stop('duration');throw new Error('LIVE_BUDGET_DURATION');}
    const pending=this.state.requests.filter(r=>r.status==='pending');
    const input=Buffer.byteLength(JSON.stringify(payload),'utf8')+8192;
    const output=this.budget.perRequestMaxOutputTokens;
    if(this.state.requests.length>=this.budget.maxRequests||this.state.inputTokens+pending.reduce((n,r)=>n+r.reservedInput,0)+input>this.budget.maxInputTokens||this.state.outputTokens+pending.reduce((n,r)=>n+r.reservedOutput,0)+output>this.budget.maxOutputTokens){this.stop('capacity');throw new Error('LIVE_BUDGET_EXHAUSTED');}
    if(this.state.startedAt===null){this.state.startedAt=this.clock();this.armTimer();}
    const record={id:this.state.requests.length+1,kind,condition,status:'pending',startedAt:this.clock(),reservedInput:input,reservedOutput:output,payloadHash:hash(payload),promptHash:hash(payload.messages??{instructions:payload.instructions,input:payload.input}),schemaHash:hash(payload.tools??payload.input?.filter(item=>item.type==='additional_tools')??[]),reasoning:payload.reasoning_effort??payload.reasoning?.effort??null};
    this.state.status='running';this.state.requests.push(record);this.persist();return record;
  }
  finish(record){
    if(record.status!=='pending')return;
    const usage=record.rawUsage;
    if(!usage||!validCount(usage.prompt_tokens)||!validCount(usage.completion_tokens)){
      record.status='usage_unknown';this.state.inputTokens+=record.reservedInput;this.state.outputTokens+=record.reservedOutput;this.state.status='stopped';this.state.stopReason??='missing_or_invalid_usage';
    }else{
      record.status='accounted';record.inputTokens=usage.prompt_tokens;record.outputTokens=usage.completion_tokens;
      record.cacheReadTokens=usage.prompt_tokens_details?.cached_tokens??null;
      this.state.inputTokens+=usage.prompt_tokens;this.state.outputTokens+=usage.completion_tokens;
      if(usage.prompt_tokens>record.reservedInput||usage.completion_tokens>record.reservedOutput||this.state.inputTokens>this.budget.maxInputTokens||this.state.outputTokens>this.budget.maxOutputTokens){this.state.status='stopped';this.state.stopReason??='reported_usage_overshoot';}
      if(this.interactive&&!record.responseModel){this.state.status='stopped';this.state.stopReason??='response_model_missing';}
    }
    record.durationMs=this.clock()-record.startedAt;delete record.rawUsage;this.persist();
    if(this.state.status==='stopped')this.abortController.abort(new Error(`LIVE_BUDGET_STOP: ${this.state.stopReason}`));
  }
  createCall({kind='parent',condition='smoke',signal}={}){
    const records=[];
    return {records,finish:()=>records.forEach(record=>this.finish(record)),fetch:async(input,init={})=>{
      const url=typeof input==='string'||input instanceof URL?String(input):input.url;
      if(new URL(url).href!==this.endpoint||init.method?.toUpperCase()!=='POST')throw new Error('LIVE_ENDPOINT_DENIED');
      if(typeof init.body!=='string')throw new Error('LIVE_PAYLOAD_UNSUPPORTED');
      const payload=JSON.parse(init.body),responses=this.api==='openai-responses';
      const caps=(responses?[payload.max_output_tokens]:[payload.max_tokens,payload.max_completion_tokens]).filter(value=>value!==undefined);
      const reasoning=this.budget.thinkingLevel==='off'?undefined:this.budget.thinkingLevel;
      if(payload.model!==this.budget.model||payload.stream!==true||(!responses&&payload.stream_options?.include_usage!==true)||!caps.length||caps.some(value=>!Number.isSafeInteger(value)||value<1||value>this.budget.perRequestMaxOutputTokens)||(responses?payload.reasoning?.effort:payload.reasoning_effort)!==reasoning||
        (responses&&(payload.previous_response_id||payload.conversation||payload.background===true||payload.store!==false)))throw new Error('LIVE_PAYLOAD_LIMIT_DENIED');
      if(signal?.aborted||init.signal?.aborted)throw new Error('LIVE_REQUEST_CANCELLED');
      const record=this.reserve(payload,kind,condition);records.push(record);
      const combined=AbortSignal.any([this.abortController.signal,AbortSignal.timeout(Math.min(120000,this.remainingMs())),...(signal?[signal]:[]),...(init.signal?[init.signal]:[])]);
      try{
        const response=await this.fetchImpl(url,{...init,redirect:'error',signal:combined});record.httpStatus=response.status;this.persist();
        if(!response.ok||!response.body)return response;
        let buffer='';const decoder=new TextDecoder();
        const parse=line=>{if(!line.startsWith('data:'))return;const raw=line.slice(5).trim();if(!raw||raw==='[DONE]')return;try{const event=JSON.parse(raw),chunk=responses?(event.response??{}):event;if(typeof chunk.model==='string'){
          if(this.interactive&&!this.budget.responseModels.includes(chunk.model)){this.stop('response_model_mismatch');throw new Error('LIVE_RESPONSE_MODEL_MISMATCH');}
          record.responseModel=chunk.model.slice(0,160);
        }const terminal=responses&&['response.completed','response.incomplete','response.failed'].includes(event.type);
        if(terminal)record.terminalEvent=event.type;
        const usage=chunk.usage??chunk.choices?.find(choice=>choice.usage)?.usage;if(usage&&(!responses||terminal))record.rawUsage={prompt_tokens:responses?usage.input_tokens:usage.prompt_tokens,completion_tokens:responses?usage.output_tokens:usage.completion_tokens,prompt_tokens_details:{cached_tokens:responses?usage.input_tokens_details?.cached_tokens:usage.prompt_tokens_details?.cached_tokens}};}catch(error){if(this.state.stopReason==='response_model_mismatch')throw error;record.malformedSse=true;}};
        const body=response.body.pipeThrough(new TransformStream({transform(chunk,controller){buffer+=decoder.decode(chunk,{stream:true});let newline;while((newline=buffer.indexOf('\n'))>=0){parse(buffer.slice(0,newline).replace(/\r$/,''));buffer=buffer.slice(newline+1);}if(buffer.length>1048576)throw new Error('SSE_FRAME_LIMIT');controller.enqueue(chunk);},flush(){buffer+=decoder.decode();if(buffer)parse(buffer);}}));
        return new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers});
      }catch(error){record.transportError=combined.aborted?'aborted_or_timeout':'transport_failed';throw error;}
    }};
  }
  close(){if(this.closed)return;this.closed=true;clearTimeout(this.timer);this.abortController.abort(new Error('LIVE_SHUTDOWN'));for(const record of this.state.requests)this.finish(record);if(this.state.status!=='stopped')this.state.status='finished';this.persist();fs.rmSync(this.lock,{recursive:true});}
}
