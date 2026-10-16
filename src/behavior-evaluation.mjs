import fs from 'node:fs';
import path from 'node:path';
import {root,canonicalPath,isWithin} from './paths.mjs';
import {loadBehaviorCorpus,createBehaviorWorkspace,digest} from './behavior-corpus.mjs';
import {verifyBehaviorWorkspace} from './behavior-verifier.mjs';
import {buildBehaviorPlan,validateBehaviorBudget} from './behavior-plan.mjs';
import {validateLiveConfig} from './live-config.mjs';

function save(file,value) {
  const fd=fs.openSync(file+'.tmp','w',0o600);
  try{fs.writeFileSync(fd,JSON.stringify(value,null,2));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  fs.renameSync(file+'.tmp',file);
}
function errorCode(error){return String(error?.message??'').match(/\b[A-Z][A-Z_]{4,}\b/)?.[0]??'BEHAVIOR_RUN_FAILED';}
export function prepareBehaviorCorpus() {
  const corpus=loadBehaviorCorpus(),plan=buildBehaviorPlan();
  const base=path.join(root,'tests/.tmp');fs.mkdirSync(base,{recursive:true});
  const directory=fs.mkdtempSync(path.join(base,'behavior-prepare-'));
  const checks=[];
  try{
    for(const task of corpus.tasks){
      const workspace=path.join(directory,task.id);createBehaviorWorkspace(task,workspace);
      const initial=verifyBehaviorWorkspace(task,workspace);
      for(const [file,content]of Object.entries(task.referenceChanges))fs.writeFileSync(path.join(workspace,file),content);
      const reference=verifyBehaviorWorkspace(task,workspace);
      checks.push({taskId:task.id,startingTreeFails:!initial.passed,referencePasses:reference.passed,assertions:reference.receipt?.total??0,scopeProtected:reference.scope?.violations.length===0});
    }
    return {passed:checks.every(c=>c.startingTreeFails&&c.referencePasses&&c.scopeProtected),checks,plan,modelRequests:0,behaviorQuality:'not evaluated',reasonParity:'unknown'};
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
}

export async function runBehaviorCampaign({config,approval,env=process.env,fetchImpl=globalThis.fetch,onProgress=()=>{},signal}) {
  const plan=buildBehaviorPlan();validateBehaviorBudget(approval,plan);
  for(const [field,value]of Object.entries(plan.model))if(config[field]!==value)throw Error('BEHAVIOR_MODEL_CONFIGURATION_MISMATCH');
  const {tasks}=loadBehaviorCorpus();
  const base=path.join(root,'agent/live-private/behavior-campaigns');
  const directory=path.join(base,approval.campaignId);
  if(!isWithin(canonicalPath(path.join(root,'agent')),canonicalPath(directory)))throw Error('BEHAVIOR_CONTROL_ESCAPE');
  const workspaceBase=path.join(root,'artifacts/evaluations/behavior',approval.campaignId);
  const firstBudget={...plan.perRun,allowanceId:approval.campaignId+'--'+plan.jobs[0].id,authorized:true};
  // Validate before creating a campaign or resolving any provider request.
  validateLiveConfig({...config,budget:firstBudget},{env,cwd:path.join(workspaceBase,plan.jobs[0].id)});
  if(fs.existsSync(directory)||fs.existsSync(workspaceBase))throw Error('BEHAVIOR_CAMPAIGN_EXISTS: no rerun or allowance reset');
  fs.mkdirSync(base,{recursive:true});fs.mkdirSync(directory);
  const file=path.join(directory,'campaign.json');
  const state={schemaVersion:1,campaignId:approval.campaignId,protocolHash:plan.protocolHash,plan,approval,
    status:'running',startedAt:Date.now(),jobs:plan.jobs.map(job=>({...job,status:'pending'})),usage:{requests:0,inputTokens:0,outputTokens:0,cost:null},reasonParity:'unknown'};
  save(file,state);
  const {createLiveRuntime}=await import('./live-interactive.mjs');
  const {redactEvent}=await import('./telemetry.ts');
  let active;
  const deadline=state.startedAt+approval.maxDurationMs;
  const stopDuration=()=>{state.stopReason='campaign_duration';active?.gate.stop('campaign_duration');};
  const campaignTimer=setTimeout(stopDuration,Math.max(1,deadline-Date.now()));campaignTimer.unref();
  const cancel=()=>active?.gate.stop('campaign_cancelled');
  signal?.addEventListener('abort',cancel,{once:true});
  try{
    for(const job of state.jobs){
      if(state.stopReason)break;
      if(signal?.aborted){state.stopReason='campaign_cancelled';break;}
      const remaining=approval.maxDurationMs-(Date.now()-state.startedAt);
      if(remaining<=0){state.stopReason='campaign_duration';break;}
      const task=tasks.find(t=>t.id===job.taskId),workspace=path.join(workspaceBase,job.id),runDirectory=path.join(directory,job.id);
      createBehaviorWorkspace(task,workspace);
      const budget={...plan.perRun,maxDurationMs:Math.min(plan.perRun.maxDurationMs,remaining),allowanceId:approval.campaignId+'--'+job.id,authorized:true};
      const resolved=validateLiveConfig({...config,budget},{env,cwd:workspace});
      const events=[];let modelStopReason,finalText='',failure,timer;
      job.status='running';job.startedAt=Date.now();save(file,state);
      onProgress({job:job.id,phase:'start'});
      try{
        active=await createLiveRuntime({...resolved,directory:runDirectory,fetchImpl:(url,init)=>{
          if(Date.now()>=deadline){stopDuration();throw Error('BEHAVIOR_CAMPAIGN_DURATION');}
          return fetchImpl(url,init);
        },options:{evaluationCondition:job.condition,headlessEvaluation:true}});
        const session=active.host.session;
        job.activeTools=session.getActiveToolNames();job.callableTools=session.getCallableToolNames();
        job.runtime=job.condition==='stock-core'?'stock/1.0.0':'selected-candidate';
        session.subscribe(event=>{
          if(['tool_execution_start','tool_execution_end','compaction_start','compaction_end','auto_retry_start','auto_retry_end'].includes(event.type)){
            const record=redactEvent({sequence:events.length+1,at:Date.now(),type:event.type,toolName:event.toolName,toolCallId:event.toolCallId,parentToolCallId:event.parentToolCallId,
              args:event.args,eventIsError:event.isError,
              isError:event.isError===true||event.result?.isError===true||(Number.isInteger(event.result?.structuredContent?.exit_code)&&event.result.structuredContent.exit_code!==0),result:event.result});
            events.push(record);fs.appendFileSync(path.join(runDirectory,'behavior-events.jsonl'),JSON.stringify(record)+'\n');
          }
        });
        await session.bindExtensions({mode:'rpc',onError:()=>{failure='BEHAVIOR_EXTENSION_ERROR';}});
        if(signal?.aborted){active.gate.stop('campaign_cancelled');throw Error('BEHAVIOR_CANCELLED_BEFORE_PROMPT');}
        if(Date.now()>=deadline){stopDuration();throw Error('BEHAVIOR_CAMPAIGN_DURATION');}
        timer=setTimeout(()=>active?.gate.stop('attempt_duration'),budget.maxDurationMs);timer.unref();
        await session.prompt(task.prompt);
        const message=session.messages.filter(m=>m.role==='assistant').at(-1);
        modelStopReason=message?.stopReason??'missing';
        finalText=message?.content.filter(part=>part.type==='text').map(part=>part.text).join('\n')??'';
      }catch(error){failure=errorCode(error);}
      finally{
        clearTimeout(timer);
        try{await active?.close();}catch{failure='BEHAVIOR_CLEANUP_FAILED';}
      }
      const children=active?.getHarness().getSupervisor()?.list()??[];
      const policy=active?.getHarness().policy;
      const cleanupConfirmed=!!active&&children.every(c=>c.cleanupConfirmed===true)&&policy.pendingWriterCalls().length===0&&!policy.getExistingLease();
      const accounting=active?.gate.state;
      const verification=verifyBehaviorWorkspace(task,workspace);
      const usage={requests:accounting?.requests.length??0,inputTokens:accounting?.inputTokens??0,outputTokens:accounting?.outputTokens??0};
      for(const key of Object.keys(usage))state.usage[key]+=usage[key];
      Object.assign(job,{status:'complete',durationMs:Date.now()-job.startedAt,modelStopReason,finalText,usage,
        verification,cleanupConfirmed,error:failure??null,budgetStop:accounting?.stopReason??null,
        parentOrSummaryRequests:accounting?.requests.filter(r=>r.kind!=='child').length??0,childRequests:accounting?.requests.filter(r=>r.kind==='child').length??0,
        childCount:children.length,childStatuses:children.map(c=>({id:c.id,profile:c.profile,status:c.status,cleanupConfirmed:c.cleanupConfirmed})),
        toolCalls:events.filter(e=>e.type==='tool_execution_start').map(e=>({sequence:e.sequence,name:e.toolName,parentToolCallId:e.parentToolCallId??null})),
        toolErrors:events.filter(e=>e.type==='tool_execution_end'&&e.isError===true).length,
        compactions:events.filter(e=>e.type==='compaction_start').length,
        humanReview:{strategy:null,recovery:null,testReportHonesty:null,evidenceRequired:true},
        passed:verification.passed&&modelStopReason==='stop'&&cleanupConfirmed&&!failure&&!accounting?.stopReason});
      // Raw responses, final text and child traces stay in the ignored campaign tree.
      save(path.join(runDirectory,'result.json'),job);save(file,state);
      onProgress({job:job.id,phase:'complete',correct:verification.passed,cleanupConfirmed,usage});
      if(buildBehaviorPlan().protocolHash!==plan.protocolHash){state.stopReason='BEHAVIOR_PROTOCOL_DRIFT';break;}
      if(failure||!cleanupConfirmed||accounting?.stopReason||modelStopReason!=='stop'){
        state.stopReason=accounting?.stopReason??failure??(!cleanupConfirmed?'cleanup_unconfirmed':'model_error');break;
      }
      active=undefined;
    }
  }catch(error){state.stopReason=errorCode(error);}
  finally{
    clearTimeout(campaignTimer);
    signal?.removeEventListener('abort',cancel);
    state.status=state.stopReason?'stopped':'finished';state.completedAt=Date.now();
    state.allTasksCorrect=state.jobs.every(job=>job.status==='complete'&&job.passed);
    state.humanReviewComplete=false;save(file,state);
  }
  return {directory,state};
}
