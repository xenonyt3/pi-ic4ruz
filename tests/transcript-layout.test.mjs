import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {sdk,ai,runtimeLabel} from '../src/upstream.mjs';
import {root,resolvePrototypePaths} from '../src/paths.mjs';
import {tui} from '../src/ui-runtime.mjs';
import {createReasonTheme,wrapToolPresentation} from '../src/reason-ui.mjs';
import {sourceOracle,baseTheme,renderContext} from './helpers/ui.mjs';
import {createLayoutHost,layoutCases,expectedRows,stripZones} from './helpers/transcript-layout-host.mjs';
import {assistantMessage} from './helpers/session.mjs';
const {TranscriptContainer}=await import(pathToFileURL(path.join(resolvePrototypePaths().pkg,'dist/modes/interactive/components/transcript-container.js')));
const plain=lines=>stripZones(lines).map(line=>tui.stripTerminalSequences(line).trimEnd());
const next=()=>new Promise(resolve=>setImmediate(resolve));

test('I22 actual host matches Reason showEntry composition across themes, expansion and resize',async()=>{
  const noColor=process.env.NO_COLOR;delete process.env.NO_COLOR;
  const host=await createLayoutHost(),cases=[];
  try{
    for(const appearance of ['dark','light']){
      const oracle=sourceOracle();if(appearance==='light')oracle.theme.setTerminalColors({background:{r:245,g:245,b:245}});
      host.ui.setTheme(createReasonTheme(baseTheme(appearance)));
      for(const expanded of [false,true])for(const width of [8,32,80,120])for(const [name,content] of layoutCases){
        host.mode.hideThinkingBlock=!expanded;
        const actual=host.render(content,width).lines,expected=expectedRows(content,width,expanded,oracle);
        assert.deepEqual(plain(actual),plain(expected),`${appearance}/${expanded}/${width}/${name}`);
        assert.ok(actual.every(line=>tui.visibleWidth(line)<=width));
        cases.push({name,appearance,expanded,width,matched:true});
      }
    }
    fs.writeFileSync(path.join(root,'upstream-patches/transcript-hook/layout-parity.json'),JSON.stringify({runtime:runtimeLabel,kind:'actual-SDK-host-vs-source-FeA-showEntry-B0A',comparison:'terminal-visible rows ignoring trailing surface padding; individual palette/renderers verified separately',passed:true,cases},null,2));
  }finally{await host.dispose();if(noColor!==undefined)process.env.NO_COLOR=noColor;}
});

test('I22 absent/undefined layout preserves stock children and OSC zones, including partial-message errors',async()=>{
  const host=await createLayoutHost();
  try{
    assert.throws(()=>host.ui.setTranscriptLayout('invalid'),/INVALID_TRANSCRIPT_LAYOUT/);
    for(const stopReason of ['stop','length','error','aborted']){
      const content=[{type:'text',text:'Partial text.'},{type:'thinking',thinking:'Inspect it.'}];
      host.render(content,80,stopReason);
      const original=host.mode.chatContainer.children.slice();
      host.ui.setTranscriptLayout(undefined);
      const stock=host.mode.chatContainer.children.flatMap(child=>child.render(80));
      assert.deepEqual(host.mode.chatContainer.render(80),stock);
      host.ui.setTranscriptLayout('content');
      const current=host.mode.chatContainer.render(80);
      assert.equal(current.join('').match(/\x1b\]133;A\x07/g)?.length,2);
      assert.equal(current.join('').match(/\x1b\]133;B\x07/g)?.length,2);
      for(const message of ['Response was truncated','Error: Unknown error','Operation aborted'])if(stock.join('').includes(message))assert.ok(current.join('').includes(message));
      assert.deepEqual(host.mode.chatContainer.children,original);
    }
  }finally{await host.dispose();}
});

test('I22 streamed interleaved calls/results match replay, preserve tool identity and resume without transcript edits',async()=>{
  const host=await createLayoutHost(),frames=[];let round=0;
  try{
    fs.writeFileSync(path.join(host.runtime.session.sessionManager.getCwd(),'alpha.txt'),'CAF\u00c9 result from alpha');
    fs.writeFileSync(path.join(host.runtime.session.sessionManager.getCwd(),'beta.txt'),'Result from beta');
    host.runtime.session.agent.streamFunction=()=>{
      const stream=new ai.AssistantMessageEventStream();
      void (async()=>{
        if(round++>0){const message=assistantMessage([{type:'text',text:'Finished.'}]);stream.push({type:'start',partial:message});stream.push({type:'done',reason:'stop',message});return;}
        const content=[];const partial=()=>assistantMessage(structuredClone(content));
        stream.push({type:'start',partial:partial()});
        const sequence=[{type:'thinking',thinking:'**Inspect**\nCAF\u00c9 detail',thinkingSignature:'opaque'},
          {type:'text',text:'Before alpha.'},{type:'toolCall',id:'alpha',name:'read',arguments:{path:'alpha.txt'}},
          {type:'text',text:'Between calls.'},{type:'toolCall',id:'beta',name:'read',arguments:{path:'beta.txt'}},
          {type:'text',text:'After beta.'}];
        for(const block of sequence){
          content.push(block);const index=content.length-1;
          stream.push({type:block.type==='toolCall'?'toolcall_delta':block.type==='thinking'?'thinking_delta':'text_delta',contentIndex:index,delta:block.text??block.thinking??'{}',partial:partial()});
          await next();await next();frames.push(plain(host.mode.chatContainer.render(80)).join('\n'));
        }
        stream.push({type:'done',reason:'toolUse',message:partial()});
      })().catch(error=>stream.push({type:'error',reason:'error',error:assistantMessage([],{stopReason:'error',errorMessage:String(error)})}));
      return stream;
    };
    await host.runtime.session.prompt('Synthetic layout stream');
    const before=JSON.stringify(host.runtime.session.messages),file=host.runtime.session.sessionManager.getSessionFile();
    const final=host.mode.chatContainer.render(80),text=plain(final).join('\n');
    assert.ok(text.indexOf('Before alpha.')<text.indexOf('read alpha.txt'));
    assert.ok(text.indexOf('read alpha.txt')<text.indexOf('Between calls.'));
    assert.ok(text.indexOf('Between calls.')<text.indexOf('read beta.txt'));
    assert.ok(text.indexOf('read beta.txt')<text.indexOf('After beta.'));
    assert.ok(frames.some(frame=>frame.includes('Between calls.')&&frame.indexOf('read alpha.txt')<frame.indexOf('Between calls.')));
    const tools=host.mode.chatContainer.children.filter(child=>typeof child.markExecutionStarted==='function');assert.equal(tools.length,2);
    host.ui.setToolsExpanded(true);const expanded=plain(host.mode.chatContainer.render(80)).join('\n');
    assert.match(expanded,/CAF\u00c9 result from alpha/);assert.match(expanded,/Result from beta/);
    host.ui.setToolsExpanded(false);for(const tool of tools)assert.ok(host.mode.chatContainer.children.includes(tool));
    assert.equal(JSON.stringify(host.runtime.session.messages),before);
    const resumed=await host.runtime.switchSession(file);assert.equal(resumed.cancelled,false);
    assert.equal(JSON.stringify(host.runtime.session.messages),before);
    assert.deepEqual(plain(host.mode.chatContainer.render(80)),plain(final));
    assert.equal(host.mode.pendingTools.size,0);
    const content=host.runtime.session.messages.find(message=>message.role==='assistant'&&message.content.some(block=>block.type==='toolCall')).content;
    assert.equal(content[0].thinkingSignature,'opaque');
  }finally{await host.dispose();}
});

test('I22 mouse translation preserves reasoning toggle after an attached tool run and text',async()=>{
  const host=await createLayoutHost();
  try{
    const content=[...layoutCases[0][1],{type:'text',text:'Explanation.'},{type:'thinking',thinking:'**Decision**\nExpanded CAF\u00c9 detail.'}];
    host.render(content,80);let lines=host.mode.chatContainer.render(80);
    const y=plain(lines).findIndex(line=>line.includes('Thinking: Decision'));assert.ok(y>=0);
    const result=host.mode.chatContainer.handleMouse({type:'click',button:'left',x:4,y,screenX:4,screenY:y,width:80,height:lines.length,shift:false,alt:false,ctrl:false});
    assert.equal(result?.handled,true);
    lines=host.mode.chatContainer.render(80);assert.match(plain(lines).join('\n'),/Expanded CAF\u00c9 detail/);
    host.mode.toggleThinkingBlockVisibility();host.mode.toggleThinkingBlockVisibility();
    assert.match(plain(host.mode.chatContainer.render(80)).join('\n'),/Thinking: Decision/);
  }finally{await host.dispose();}
});

test('I22 abort/error tool rows stay errors despite stale live status and remain expandable',async()=>{
  const host=await createLayoutHost();
  try{
    for(const reason of ['aborted','error']){
      host.render(layoutCases[0][1],80,reason);
      const text=plain(host.mode.chatContainer.render(80)).join('\n');assert.match(text,/Operation aborted|Error/);
      host.ui.setToolsExpanded(true);assert.match(plain(host.mode.chatContainer.render(80)).join('\n'),/Operation aborted|Error/);host.ui.setToolsExpanded(false);
    }
    const theme=createReasonTheme(baseTheme()),definition=wrapToolPresentation({name:'read'},{states:new Map([['fixture','running']])});
    const line=definition.renderCall({path:'bad'},theme,renderContext({}, {isError:true})).render(80)[0];
    assert.ok(line.includes(theme.fg('error','\u25cf')));assert.ok(!line.includes(theme.fg('warning','\u25cf')));
  }finally{await host.dispose();}
});

test('I22 failed layout, reset and reload keep original components, and user text/tool results are never lost',async()=>{
  const host=await createLayoutHost();
  try{
    host.render(layoutCases[1][1],80);const children=host.mode.chatContainer.children.slice();
    const assistant=children.find(child=>child instanceof sdk.AssistantMessageComponent),original=assistant.getTranscriptParts;
    assistant.getTranscriptParts=()=>{throw Error('fixture layout failure');};
    const recovered=plain(host.mode.chatContainer.render(80)).join('\n');
    assert.match(recovered,/Before tool/);assert.match(recovered,/After tool/);assert.match(recovered,/read alpha/);
    assert.equal(host.mode.transcriptLayout,undefined);assistant.getTranscriptParts=original;
    await next();assert.ok(children.every(child=>host.mode.chatContainer.children.includes(child)));
    host.ui.setTranscriptLayout('content');host.mode.resetExtensionUI();assert.equal(host.mode.transcriptLayout,undefined);
    await host.mode.handleReloadCommand();assert.equal(host.mode.transcriptLayout,'content');
    host.binding.restore();assert.equal(host.mode.transcriptLayout,undefined);
  }finally{await host.dispose();}
});

test('I22 content rows attach across assistant messages but do not hide orphan or duplicate tool components',()=>{
  sdk.initTheme('dark');const container=new TranscriptContainer(()=>true,error=>{throw error;});
  const add=(id,label)=>{const message=new sdk.AssistantMessageComponent(assistantMessage([{type:'toolCall',id,name:'read',arguments:{}}]));container.addChild(message);container.addToolComponent({render:()=>['',label],invalidate(){}},id);return message;};
  const first=add('same','first tool');add('same','second tool');
  container.addToolComponent({render:()=>['','duplicate preserved'],invalidate(){}},'same');
  container.addToolComponent({render:()=>['','orphan preserved'],invalidate(){}},'missing');
  assert.deepEqual(container.render(80),['','first tool','second tool','duplicate preserved','orphan preserved']);
  container.removeChild(first);assert.ok(container.render(80).includes('first tool'));
  container.clear();assert.deepEqual(container.render(80),[]);
});

test('I22 NO_COLOR, image payloads and edit diffs keep upstream tool components and rendering',async()=>{
  const noColor=process.env.NO_COLOR;process.env.NO_COLOR='1';
  const host=await createLayoutHost();
  try{
    const content=[{type:'toolCall',id:'image',name:'read',arguments:{path:'pixel.png'}},
      {type:'toolCall',id:'edit',name:'edit',arguments:{path:'fixture.txt',edits:[{oldText:'before',newText:'after'}]}}];
    host.render(content,80);
    const tools=host.mode.chatContainer.children.filter(child=>typeof child.updateResult==='function');assert.equal(tools.length,2);
    const image={content:[{type:'image',mimeType:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB1sAAAAASUVORK5CYII='}],isError:false};
    const edit={content:[{type:'text',text:'Updated fixture.txt'}],details:{diff:'-1 before\n+1 after',firstChangedLine:1},isError:false};
    tools[0].updateResult(image);tools[1].updateResult(edit);const before=JSON.stringify([image,edit]);
    for(const width of [8,32,80,120]){
      const rendered=host.mode.chatContainer.render(width);assert.ok(rendered.every(line=>tui.visibleWidth(line)<=width));
      if(width>=80)assert.match(plain(rendered).join('\n'),/after|Updated fixture/);
    }
    host.ui.setToolsExpanded(true);host.mode.chatContainer.render(80);
    assert.ok(tools.every(tool=>host.mode.chatContainer.children.includes(tool)));
    assert.equal(JSON.stringify([image,edit]),before);
  }finally{await host.dispose();if(noColor===undefined)delete process.env.NO_COLOR;else process.env.NO_COLOR=noColor;}
});
