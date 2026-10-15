import fs from 'node:fs';
import path from 'node:path';
import { root } from '../src/paths.mjs';
import { validateBudget } from '../src/evaluation-budget.mjs';

const args=process.argv.slice(2);
if(args.some(arg=>!['--dry-run','--live','--budget','--conditions'].includes(arg)&&!['--budget','--conditions'].includes(args[args.indexOf(arg)-1])))throw new Error('UNKNOWN_EVALUATION_ARGUMENT');
const conditions=args.includes('--conditions')?(args[args.indexOf('--conditions')+1]??'').split(','):['A','B','C'];
if(conditions.some(condition=>!['A','B','C'].includes(condition))||new Set(conditions).size!==conditions.length)throw new Error('INVALID_CONDITIONS');
if(args.includes('--live')){
  const budgetPath=args[args.indexOf('--budget')+1];
  if(!args.includes('--budget')||!budgetPath)throw new Error('BUDGET_REQUIRED: no inference started');
  validateBudget(JSON.parse(fs.readFileSync(budgetPath,'utf8')));
  const {runLiveEvaluation}=await import('../src/live-evaluation.mjs');
  const result=await runLiveEvaluation({budget:JSON.parse(fs.readFileSync(budgetPath,'utf8')),conditions});
  console.log(JSON.stringify({report:path.join(result.directory,'report.json'),passed:result.report.passed,usage:result.report.usage,stopReason:result.report.stopReason},null,2));
  if(!result.report.passed)process.exitCode=1;
}
if(!args.includes('--live')){
const plan={mode:'dry-run',executed:false,liveInference:false,conditions:['A: upstream core','B: codemode and deferred tools','C: B plus delegation'],
  proposedAttemptsPerTask:3,proposedTaskKinds:['repository investigation','multi-file bugfix','web/Worker fixture','native Windows fixture'],
  requestKindsCounted:['parent','child','compaction','retry','follow-up'],
  pending:['explicit total budget','verified pricing or token-only caps','same model/effort/provider configuration','approved disposable corpus and verifier','O14 UI review','live accounting transport verification'],
  metrics:['correctness','scope drift','input/output/cache tokens with provenance','parent and child duration','human review/recovery time','cost only with verified prices']};
fs.mkdirSync(path.join(root,'artifacts/evaluations'),{recursive:true});
fs.writeFileSync(path.join(root,'artifacts/evaluations/dry-run.json'),JSON.stringify(plan,null,2));
console.log(JSON.stringify(plan,null,2));
}
