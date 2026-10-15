import test from 'node:test';import assert from 'node:assert/strict';
import { EvaluationBudget,validateBudget } from '../src/evaluation-budget.mjs';
test('T5 reservations bound parent/child/summary/retry together, missing usage stops',()=>{
  assert.throws(()=>validateBudget(),/REQUIRED/);
  const config={maxRequests:3,maxInputTokens:1000,maxOutputTokens:100,maxDurationMs:1000,maxAttempts:3};
  const budget=new EvaluationBudget(config);
  const parent=budget.reserve({inputTokens:300,outputTokens:30,kind:'parent'});
  const child=budget.reserve({inputTokens:300,outputTokens:30,kind:'child'});
  const summary=budget.reserve({inputTokens:300,outputTokens:30,kind:'compaction'});
  assert.throws(()=>budget.reserve({inputTokens:1,outputTokens:1,kind:'retry'}),/EXHAUSTED/);
  assert.equal(budget.settle(parent,{input:200,output:20}).status,'accounted');
  assert.equal(budget.settle(child,undefined).status,'usage_unknown');
  assert.throws(()=>budget.reserve({inputTokens:1,outputTokens:1}),/STOP/);
  budget.settle(summary,{input:0,output:0});
});
test('T5 overshoot, duration and unverified prices fail closed',()=>{
  const config={maxRequests:2,maxInputTokens:100,maxOutputTokens:100,maxDurationMs:20,maxAttempts:1};
  assert.throws(()=>validateBudget({...config,maxCost:1}),/PRICING/);
  let clock=0;const budget=new EvaluationBudget(config,()=>clock);const id=budget.reserve({inputTokens:10,outputTokens:10});
  assert.equal(budget.settle(id,{input:11,output:10}).status,'overshoot_stop');
  assert.throws(()=>budget.reserve({inputTokens:1,outputTokens:1}),/STOP/);
  const second=new EvaluationBudget(config,()=>clock);clock=21;assert.throws(()=>second.reserve({inputTokens:1,outputTokens:1}),/STOP/);
});
