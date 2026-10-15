import fs from 'node:fs';
import path from 'node:path';
import {root} from '../src/paths.mjs';
import {sdk,runtimeLabel} from '../src/upstream.mjs';
import {tui} from '../src/ui-runtime.mjs';
import {createReasonTheme,editorSurface,ReasonEditor,renderUserMessage,renderAssistantText,renderThinking,renderToolHeader,renderFooter,wrapToolPresentation} from '../src/reason-ui.mjs';
import {baseTheme,host,renderContext} from '../tests/helpers/ui.mjs';
import {assistantMessage} from '../tests/helpers/session.mjs';
import {ReasonStartup,renderWorking} from '../src/ui-startup.mjs';

sdk.initTheme('dark');
const keys=new tui.KeybindingsManager({...tui.TUI_KEYBINDINGS,'app.interrupt':{defaultKeys:'escape'},'app.exit':{defaultKeys:'ctrl+d'},'app.tools.expand':{defaultKeys:'ctrl+o'}});
tui.setKeybindings(keys);
const directory=path.join(root,'artifacts/ui-replay');fs.mkdirSync(directory,{recursive:true});
const scenes=['idle','startup-turn','startup-light','working-thinking','working-light','multiline','streaming','tool-running','tool-error','diff','child-completed','cancel','compaction-unknown','status-warning','surface-dark','surface-light','assistant-markdown','assistant-code','assistant-cancel','assistant-thinking','thinking-expanded','thinking-expanded-light','thinking-after-text','thinking-collapsed-light'];
const frames=[];
for(const [columns,rows]of [[80,24],[120,40]])for(const scene of scenes){
  const light=scene.endsWith('-light');
  const theme=createReasonTheme(baseTheme(light?'light':'dark'));
  const editorTheme={borderColor:s=>theme.fg('muted',s),selectList:{selectedPrefix:s=>theme.fg('accent',s),selectedText:s=>s,description:s=>s,scrollInfo:s=>s,noMatch:s=>s}};
  const surface=scene.startsWith('surface-')?editorSurface({background:light?{r:245,g:245,b:245}:{r:16,g:16,b:16},foreground:light?{r:20,g:20,b:20}:{r:240,g:240,b:240}},{noColor:false}):null;
  const editor=new ReasonEditor(host,editorTheme,keys,{markerColor:text=>theme.fg('accent',text),getSurface:()=>surface});editor.focused=true;
  if(surface)editor.setText('Inspect src/normalize.mjs\nPreserve Unicode: CAF\u00c9.');
  if(scene==='multiline')editor.setText('Inspect src/normalize.mjs\nPreserve punctuation and Unicode: CAF\u00c9.');
  let body=[];
  const entry={name:'read',args:{path:'D:\\workspace\\src\\normalize.mjs'},status:'done'};
  const startup=scene==='idle'||scene.startsWith('startup-');
  if(!startup&&scene!=='multiline'){
    const message=new sdk.UserMessageComponent('Fix **literal** normalization and verify `src/normalize.mjs`.',undefined,1,[],()=>((text,width)=>renderUserMessage(text,width,theme,surface)));
    body.push(...message.render(columns).map(line=>line.replace(/\x1b\]133;[ABC]\x07/g,'')),'');
  }
  if(scene==='tool-running')entry.status='running';
  if(scene==='tool-error'){
    entry.name='bash';entry.args={command:'npm test'};entry.status='failed';
  }
  if(!startup&&!['multiline','compaction-unknown','working-thinking','working-light'].includes(scene))body.push(renderToolHeader(entry,theme,columns));
  if(scene==='tool-error'){
    const def=wrapToolPresentation({name:'bash'}),result={content:[{type:'text',text:'FAIL normalizeLabel rejects non-strings\nExpected TypeError; received value.\nFailure at D:/workspace/a-very-long-path/to/the/normalization/contract/test-file.mjs: release the writer lease before retrying.\nExit code: 1'}]};
    body.push(...def.renderResult(result,{expanded:false,isPartial:false},theme,renderContext({}, {isError:true})).render(columns));
  }
  if(scene==='diff'){
    const definition=wrapToolPresentation(sdk.createEditToolDefinition(root));
    const args={path:'src/normalize.mjs',edits:[{oldText:'  return value.toLowerCase().trim();',newText:'  if (typeof value !== "string") throw new TypeError();\n  return value.trim().replace(/\\s+/gu, " ").toLowerCase();'}]};
    const ctx=renderContext(args,{argsComplete:false});
    const call=definition.renderCall(args,theme,ctx);
    const result=definition.renderResult({content:[{type:'text',text:'Successfully replaced 1 block.'}],details:{diff:' 1 export function normalizeLabel(value) {\n-2   return value.toLowerCase().trim();\n+2   if (typeof value !== "string") throw new TypeError();\n+3   return value.trim().replace(/\\s+/gu, " ").toLowerCase();\n 4 }',firstChangedLine:2}},{expanded:false,isPartial:false},theme,ctx);
    body.push('',...call.render(columns),...result.render(columns));
  }
  if(scene==='child-completed')body.push(' Child diagnosis received. Parent edited the target.',' Verification: 12 assertions passed.');
  if(scene==='cancel')body.push(theme.fg('warning',' Cancelled. Child stopped; cleanup confirmed.'));
  if(scene==='compaction-unknown')body.push(' Context compacted. Waiting for the next usage receipt.');
  if(scene==='streaming'||scene.startsWith('assistant-')||scene.startsWith('thinking-')){
    const text=scene==='assistant-code'?'    const value = 42;\n    return value;':scene==='assistant-markdown'?'## Input contract\n\n> Preserve Unicode and reject non-strings.\n\n**Verified** with `normalizeLabel`.':scene==='streaming'?'## Checking\n\nPreserving **Unicode':'The input contract is preserved.';
    const thinking={type:'thinking',thinking:'Inspect the original contract.\n\n**Preserve Unicode and reject null**\n\n- Keep the public API unchanged.\n- Verify CAF\u00c9 with the offline fixture.'};
    const content=scene==='thinking-after-text'?[{type:'text',text:'First answer.'},thinking,{type:'text',text:'Final verification.'}]:[...(scene==='assistant-thinking'||scene.startsWith('thinking-')?[thinking]:[]),{type:'text',text}];
    const message=assistantMessage(content,scene==='assistant-cancel'?{stopReason:'aborted',errorMessage:'Cancelled by user.'}:{});
    const assistant=new sdk.AssistantMessageComponent(message,!scene.startsWith('thinking-expanded'),undefined,'Thinking',1,[],()=>((value,width)=>renderAssistantText(value,width,theme,{noColor:false})),undefined,()=>((value,width,_theme,context)=>renderThinking(value,width,theme,{...context,noColor:false})));
    if(scene==='streaming')assistant.updateContent(message,true);
    body.push(...assistant.render(columns).map(line=>line.replace(/\x1b\]133;[ABC]\x07/g,'')));
  }
  const phase=scene==='streaming'?'writing':scene==='tool-running'?'running read':scene.startsWith('working-')?'thinking':scene==='cancel'?'cancelled':'idle';
  const statuses=scene==='status-warning'?['Brain: unavailable. Local fixture could not reconnect to the configured vault; prior context is unavailable. Retry after reconnecting.']:['Brain: off'];
  const footer=renderFooter({provider:'fixture',model:'offline-model',phase,contextPercent:scene==='compaction-unknown'?null:12,children:scene==='child-completed'?[{status:'completed',cleanupConfirmed:true}]:[],statuses,cwd:'D:\\pi-reason-prototype\\workspace'},theme,columns);
  const working=renderWorking({label:phase==='thinking'?'Thinking':phase==='writing'?'Writing':phase==='running read'?'Running read':'',detail:'2s \u00b7 escape to cancel',now:700,appearance:light?'light':'dark',noColor:false},columns);
  const bottom=[...working,...editor.render(columns),...footer];
  const splash=new ReasonStartup({host:{...host,terminal:{columns,rows}},details:()=>[theme.fg('muted',`Pi ${runtimeLabel}`)+' \u00b7 '+theme.fg('accent','fixture/offline-model'),theme.fg('muted','D:\\pi-reason-prototype\\workspace')]});
  if(scene==='startup-turn')splash.turn=0.08;
  const header=splash.render(columns);splash.dispose();
  const room=rows-bottom.length;
  const top=[...header,...body].slice(-room);
  while(top.length<room)top.push('');
  const lines=[...top,...bottom].map(line=>tui.truncateToWidth(line,columns));
  if(lines.length!==rows||lines.some(line=>tui.visibleWidth(line)>columns))throw Error('FRAME_OVERFLOW');
  frames.push({id:`${scene}-${columns}`,scene,columns,rows,background:light?'#f5f5f5':'#101010',foreground:light?'#141414':'#dedede',colorsSource:surface?'synthetic-terminal-color-reply':'unavailable-border-fallback',lines});
}
fs.writeFileSync(path.join(directory,'frames.json'),JSON.stringify({kind:'offline-prototype-renderer-fixtures-not-Reason-capture',font:'Consolas',frames},null,2));
const escape=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const palette=n=>n<16?['#000','#a00','#0a0','#aa0','#00a','#a0a','#0aa','#aaa','#555','#f55','#5f5','#ff5','#55f','#f5f','#5ff','#fff'][n]:n>=232?`rgb(${[8+(n-232)*10,8+(n-232)*10,8+(n-232)*10].join(',')})`:`rgb(${[Math.floor((n-16)/36),Math.floor((n-16)%36/6),(n-16)%6].map(v=>v?55+v*40:0).join(',')})`;
function html(line,defaultColor){
  line=line.replaceAll(tui.CURSOR_MARKER,'');let last=0,result='',color='',background='',bold=false,italic=false,dim=false;
  const add=text=>{result+=`<span style="color:${color||defaultColor};background:${background||'transparent'};font-weight:${bold?700:400};font-style:${italic?'italic':'normal'};opacity:${dim?0.7:1}">${escape(text)}</span>`;};
  for(const match of line.matchAll(/\x1b\[([\d;]*)m/g)){
    add(line.slice(last,match.index));last=match.index+match[0].length;
    const codes=match[1].split(';').map(Number);
    for(let i=0;i<codes.length;i++){
      const c=codes[i];if(c===0){color='';background='';bold=false;italic=false;dim=false;}
      else if(c===1)bold=true;else if(c===2)dim=true;else if(c===22){bold=false;dim=false;}else if(c===3)italic=true;else if(c===23)italic=false;
      else if(c===39)color='';else if(c===49)background='';
      else if((c===38||c===48)&&codes[i+1]===5){const value=palette(codes[i+2]);if(c===38)color=value;else background=value;i+=2;}
      else if((c===38||c===48)&&codes[i+1]===2){const value=`rgb(${codes.slice(i+2,i+5).join(',')})`;if(c===38)color=value;else background=value;i+=4;}
    }
  }add(line.slice(last));return result;
}
const cards=frames.map(frame=>`<section id="${frame.id}"><h2>${frame.scene} / ${frame.columns}x${frame.rows}</h2><pre style="width:${frame.columns}ch;background:${frame.background}">${frame.lines.map(line=>html(line,frame.foreground)).join('\n')}</pre></section>`).join('\n');
fs.writeFileSync(path.join(directory,'index.html'),`<!doctype html><html><meta charset="utf-8"><title>Offline terminal fixtures</title><style>body{margin:24px;background:#e8e5df;color:#242424;font-family:Georgia,serif}h1{font-size:24px}h2{font-size:16px;margin:0 0 10px}section{width:max-content;margin:24px 0}pre{font:14px/18px Consolas,monospace;background:#101010;color:#dedede;padding:12px;margin:0;overflow:hidden}pre span{display:inline-block;height:18px;line-height:18px;vertical-align:top}p{max-width:72ch}</style><h1>Pi terminal adapter: offline replay</h1><p>Deterministic fixtures using production renderer functions. These are not screenshots of a live Reason session. Fixture font: Consolas. No model requests.</p>${cards}</html>`);
console.log(JSON.stringify({directory,frames:frames.length,network:'none'}));
const reviewIds=['idle-80','startup-turn-120','working-light-80','tool-running-120'];
for(const id of reviewIds){
  const document=fs.readFileSync(path.join(directory,'index.html'),'utf8');
  const section=document.match(new RegExp(`<section id="${id}">[\\s\\S]*?</section>`))[0];
  fs.writeFileSync(path.join(directory,`${id}-review.html`),document.slice(0,document.indexOf('<h1>'))+section+'</html>');
}
