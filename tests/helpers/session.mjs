import fs from 'node:fs';
import path from 'node:path';
import { sdk, ai } from '../../src/upstream.mjs';
import { root, canonicalPath, isWithin } from '../../src/paths.mjs';

export const fixtureModel = { id: 'offline-model', name: 'Offline fixture', provider: 'fixture', api: 'openai-completions', baseUrl: 'http://127.0.0.1:9', reasoning: false, input: ['text'], contextWindow: 272000, maxTokens: 1024, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } };
export function assistantMessage(content = [{ type: 'text', text: 'fixture complete' }], overrides = {}) {
  return { role: 'assistant', content, api: fixtureModel.api, provider: fixtureModel.provider, model: fixtureModel.id,
    usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: {input:0,output:0,cacheRead:0,cacheWrite:0,total:0} },
    stopReason: content.some(item => item.type === 'toolCall') ? 'toolUse' : 'stop', timestamp: Date.now(), ...overrides };
}
export function messageStream(message) {
  const stream = new ai.AssistantMessageEventStream();
  stream.push({ type: 'start', partial: message });
  stream.push({ type: 'done', reason: message.stopReason, message });
  return stream;
}
export async function createFixtureSession(options = {}) {
  const tmpBase = path.join(root, 'tests/.tmp');
  fs.mkdirSync(tmpBase, {recursive:true});
  const temporary = fs.mkdtempSync(path.join(tmpBase, 'session-'));
  const cwd = options.cwd ?? temporary;
  const agentDir = path.join(temporary, 'agent');
  fs.mkdirSync(agentDir, {recursive:true});
  const modelRuntime = await sdk.ModelRuntime.create({ credentials: new ai.InMemoryCredentialStore(), modelsPath: null,
    modelsStorePath: path.join(agentDir,'model-store.json'), allowModelNetwork:false, refreshOnCreate:false });
  modelRuntime.getAuth = async () => ({auth:{apiKey:'offline-synthetic'}, env:{}});
  modelRuntime.hasConfiguredAuth = () => true;
  modelRuntime.streamSimple = () => { throw new Error('UNEXPECTED_FIXTURE_MODEL_REQUEST'); };
  const settingsManager = sdk.SettingsManager.inMemory({ packages:[], defaultTools:['read','bash','edit','write','codemode'], cacheWarming:'off', retry:{enabled:false}, compaction:{enabled:false}, ...options.settings });
  const resourceLoader = new sdk.DefaultResourceLoader({ cwd, agentDir, settingsManager,
    extensionFactories: options.extensions ?? [], noExtensions:true, noSkills:true, noPromptTemplates:true, noThemes:true, noContextFiles:true,
    systemPromptOverride:()=>'', appendSystemPromptOverride:()=>[] });
  await resourceLoader.reload();
  if (resourceLoader.getExtensions().errors.length) throw new Error(JSON.stringify(resourceLoader.getExtensions().errors));
  const sessionManager = options.sessionManager ?? sdk.SessionManager.inMemory(cwd);
  const { session } = await sdk.createAgentSession({cwd, agentDir, modelRuntime, model:options.model ?? fixtureModel, thinkingLevel:'off',
    settingsManager, resourceLoader, sessionManager, tools:options.tools, customTools:options.customTools});
  const events=[], errors=[], envelopes=[];
  session.subscribe(event => events.push(event));
  await session.bindExtensions({mode:options.mode??'rpc',uiContext:options.uiContext,onError:error=>errors.push(error)});
  return { session, sessionManager, modelRuntime, resourceLoader, settingsManager, cwd, temporary, events, errors, envelopes,
    dispose() { session.dispose(); if (!isWithin(canonicalPath(tmpBase), canonicalPath(temporary))) throw new Error('UNSAFE_FIXTURE_CLEANUP'); fs.rmSync(temporary,{recursive:true,force:true}); } };
}
export async function runTool(fixture, name, args) {
  let count=0;
  const id=`fixture-${Date.now()}-${Math.random()}`;
  const start=fixture.session.messages.length;
  fixture.session.agent.streamFunction = (_model, context) => {
    fixture.envelopes.push(structuredClone(context));
    return messageStream(count++ === 0 ? assistantMessage([{type:'toolCall',id,name,arguments:args}]) : assistantMessage());
  };
  await fixture.session.prompt('Deterministic offline tool fixture');
  const result=fixture.session.messages.slice(start).find(message=>message.role==='toolResult' && message.toolCallId===id);
  if (!result) throw new Error(`No fixture result: ${JSON.stringify(fixture.session.messages.slice(start))}`);
  return result;
}
export const resultText = result => result.content.filter(item=>item.type==='text').map(item=>item.text).join('\n');
