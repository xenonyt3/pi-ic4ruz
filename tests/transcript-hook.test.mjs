import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {root,resolvePrototypePaths} from '../src/paths.mjs';
import {assertIsolation} from '../launch.mjs';
import {buildChildEnv} from '../launch.mjs';
import {tui} from '../src/ui-runtime.mjs';
import {createReasonTheme,renderUserMessage,editorSurface} from '../src/reason-ui.mjs';
import {baseTheme,sourceOracle} from './helpers/ui.mjs';
import {run} from './helpers/process.mjs';
const {sdk:candidate}=await import('../upstream-patches/transcript-hook/build/package/prototype-exports.mjs');
const stock=await import('../runtime/node_modules/@earendil-works/pi-coding-agent/dist/index.js');
candidate.initTheme('dark');stock.initTheme('dark');

test('user hook absent or undefined preserves exact upstream rendering',()=>{
  for(const width of [80,120])for(const text of ['plain text','**literal** and `code`','first\nCAF\u00c9']){
    const expected=new stock.UserMessageComponent(text).render(width);
    assert.deepEqual(new candidate.UserMessageComponent(text).render(width),expected);
    assert.deepEqual(new candidate.UserMessageComponent(text,undefined,1,[],()=>()=>undefined).render(width),expected);
  }
});
test('patched user renderer matches Reason literal framing and measured surfaces at 80/120',()=>{
  const messages=['plain text','**literal** and `code`','first\nCAF\u00c9',Array(40).fill('a long path').join(' ')];
  for(const width of [80,120])for(const measured of [false,true])for(const text of messages){
    const oracle=sourceOracle(),colors={background:{r:16,g:16,b:16},foreground:{r:240,g:240,b:240}};
    if(measured)oracle.theme.setTerminalColors(colors);
    const expected=new oracle.Row({kind:'user',key:'x',text},oracle.theme,{toolOutput:false,reasoning:false},true).render(width);
    const theme=createReasonTheme(baseTheme());
    const renderer=(value,w)=>renderUserMessage(value,w,theme,measured?editorSurface(colors,{noColor:false}):null);
    const component=new candidate.UserMessageComponent(text,undefined,1,[],()=>renderer);
    const output=component.render(width);
    const withoutZones=output.map(line=>line.replace(/\x1b\]133;[ABC]\x07/g,''));
    assert.deepEqual(withoutZones,expected);
    assert.equal(output.join('').match(/\x1b\]133;A\x07/g)?.length,1);
    assert.ok(output[0].startsWith('\x1b]133;A\x07'));
    assert.ok(output.at(-1).endsWith('\x1b]133;B\x07\x1b]133;C\x07'));
    assert.ok(output.every(line=>tui.visibleWidth(line)<=width));
  }
});
test('invalid or throwing renderers fall back without losing messages or mutating cached output',()=>{
  const text='**Keep this message**',expected=new candidate.UserMessageComponent(text).render(80);
  for(const renderer of [()=>{throw Error('fixture');},()=>null,()=>[],()=>['bad\nline'],()=>['x'.repeat(81)],()=>[42]]){
    let errors=0;
    const component=new candidate.UserMessageComponent(text,undefined,1,[],()=>renderer,()=>{errors++;});
    assert.deepEqual(component.render(80),expected);assert.equal(errors,1);
  }
  const frozen=Object.freeze(['literal cached output']);
  const component=new candidate.UserMessageComponent(text,undefined,1,[],()=>()=>frozen);
  assert.deepEqual(component.render(80),component.render(80));
  assert.deepEqual(frozen,['literal cached output']);
});
test('presentation sanitizes terminal control sequences without rewriting the source string',()=>{
  const raw='Keep **literal** \x1b]0;untrusted-title\x07 text';
  const before=raw;
  const output=renderUserMessage(raw,80,createReasonTheme(baseTheme())).join('\n');
  assert.equal(raw,before);assert.doesNotMatch(output,/\x1b\]/);assert.match(output,/\*\*literal\*\*/);
});
test('runtime selector rejects arbitrary roots and candidate pin rejects modified execution bytes',()=>{
  const base=fs.mkdtempSync(path.join(root,'tests/.tmp/candidate-pin-'));
  const config=path.join(base,'config');fs.mkdirSync(config);
  fs.writeFileSync(path.join(config,'runtime-selection.json'),JSON.stringify({runtime:'../../pi-clean'}));
  assert.throws(()=>resolvePrototypePaths(base),/RUNTIME_SELECTION_REJECTED/);
  fs.writeFileSync(path.join(config,'runtime-selection.json'),JSON.stringify({runtime:'transcript-hook-v1'}));
  const paths=resolvePrototypePaths(base);
  assert.equal(paths.runtimeLabel,'1.0.0+reason-ui.3');
  assert.equal(resolvePrototypePaths(base,'stock').runtimeLabel,'1.0.0');
  const required=[paths.cli,paths.sdk,paths.runtimeExports,path.join(paths.pkg,'package.json'),path.join(paths.pkg,'dist/modes/interactive/components/user-message.js'),path.join(paths.pkg,'dist/modes/interactive/components/assistant-message.js'),path.join(paths.pkg,'dist/modes/interactive/interactive-mode.js')];
  const files={};
  for(const file of required){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,file.endsWith('package.json')?JSON.stringify({name:'@earendil-works/pi-coding-agent',version:paths.runtimeLabel}):'pinned fixture');files[path.relative(base,file).replaceAll('\\','/')]=createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
  fs.writeFileSync(path.join(config,'runtime-identity.json'),JSON.stringify({files:{}}));
  fs.writeFileSync(path.join(config,'runtime-candidate.json'),JSON.stringify({id:paths.selection,version:paths.runtimeLabel,upstream:'1.0.0',files}));
  fs.appendFileSync(paths.cli,' drift');
  assert.throws(()=>assertIsolation(paths,path.join(root,'workspace')),/RUNTIME_HASH_MISMATCH/);
});
test('Windows resume hint stays on the pinned prototype launcher with PowerShell-safe arguments',async()=>{
  const {formatResumeCommand}=await import('../upstream-patches/transcript-hook/build/package/dist/modes/interactive/interactive-mode.js');
  const directory=fs.mkdtempSync(path.join(root,'tests/.tmp/resume-command-'));
  const file=path.join(directory,"user's session.jsonl");fs.writeFileSync(file,'{}');
  const descriptor=Object.getOwnPropertyDescriptor(process.stdout,'isTTY');
  const previous=process.env.PI_PROTOTYPE_LAUNCHER;
  try{
    Object.defineProperty(process.stdout,'isTTY',{value:true,configurable:true});
    const env=buildChildEnv({PI_PROTOTYPE_LAUNCHER:'C:/foreign-launcher.mjs'},resolvePrototypePaths(root,'transcript-hook-v1'));
    process.env.PI_PROTOTYPE_LAUNCHER=env.PI_PROTOTYPE_LAUNCHER;
    const command=formatResumeCommand({isPersisted:()=>true,getSessionFile:()=>file});
    assert.ok(command.startsWith('& '));assert.ok(command.includes(path.join(root,'launch.mjs')));
    assert.match(command,/user''s session\.jsonl/);assert.doesNotMatch(command,/--session-dir|foreign-launcher/);
  }finally{
    if(descriptor)Object.defineProperty(process.stdout,'isTTY',descriptor);else delete process.stdout.isTTY;
    if(previous===undefined)delete process.env.PI_PROTOTYPE_LAUNCHER;else process.env.PI_PROTOTYPE_LAUNCHER=previous;
  }
});
test('real candidate interactive host installs, restores, resets and safely disables the user hook', {timeout:60000},async()=>{
  const result=await run(['--import',pathToFileURL(path.join(root,'src/offline-guard.mjs')).href,path.join(root,'tests/helpers/transcript-host.mjs')],{timeout:55000});
  assert.equal(result.code,0,result.stderr+'\n'+result.stdout);
  const line=result.stdout.split('\n').find(value=>value.startsWith('TRANSCRIPT_HOST_PASS:'));
  assert.ok(line,result.stdout);
  const receipt=JSON.parse(line.slice('TRANSCRIPT_HOST_PASS:'.length));
  assert.equal(receipt.transcriptUnchanged,true);assert.equal(receipt.fallback,true);assert.equal(receipt.reset,true);assert.equal(receipt.resumed,true);
  assert.equal(receipt.forked,true);assert.equal(receipt.reloaded,true);
  assert.equal(receipt.assistantHook,true);assert.equal(receipt.streamDeltas,2);assert.equal(receipt.assistantFallback,true);
  assert.equal(receipt.thinkingHook,true);assert.equal(receipt.thinkingDeltas,2);assert.equal(receipt.thinkingFallback,true);assert.equal(receipt.thinkingToggle,true);
});
