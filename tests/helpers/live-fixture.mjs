import path from 'node:path';
import {root} from '../../src/paths.mjs';

export const pilotBudget={campaign:'offline-fixture',provider:'9router',model:'cx/gpt-6-astra',thinkingLevel:'low',brainEnabled:false,
  maxRequests:12,maxInputTokens:120000,maxOutputTokens:12000,maxDurationMs:900000,maxAttempts:3,perRequestMaxOutputTokens:1000};
export const providerSource=path.join(root,'tests/fixtures/live-provider.json');
export const liveConfig={schemaVersion:1,mode:'interactive-live',provider:'9router',api:'openai-completions',baseUrl:'http://localhost:20128/v1',
  models:['fixture-model'],model:'fixture-model',responseModels:['fixture-model'],thinkingLevel:'off',contextWindow:32768,credentialEnv:'PI_LIVE_TEST_KEY',
  budget:{allowanceId:'offline-fixture',authorized:true,maxRequests:20,maxInputTokens:2000000,maxOutputTokens:20000,maxDurationMs:600000,perRequestMaxOutputTokens:1000}};
export function sse({text='fixture reply',tool,usage={prompt_tokens:20,completion_tokens:10},model='fixture-model'}={}) {
  const delta=tool?{tool_calls:[{index:0,id:'call-'+Math.random(),type:'function',function:{name:tool.name,arguments:JSON.stringify(tool.args)}}]}:{content:text};
  return new Response(`data: ${JSON.stringify({model,choices:[{index:0,delta,finish_reason:tool?'tool_calls':'stop'}],usage})}\n\ndata: [DONE]\n\n`,{headers:{'content-type':'text/event-stream'}});
}
