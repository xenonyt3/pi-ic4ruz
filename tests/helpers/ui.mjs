import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {root} from '../../src/paths.mjs';
import {sdk} from '../../src/upstream.mjs';
import {tui} from '../../src/ui-runtime.mjs';

export function baseTheme(appearance='dark') {
  const file=path.join(root,'runtime/node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/theme/dark.json');
  const keys=Object.keys(JSON.parse(fs.readFileSync(file,'utf8')).colors),fg={},bg={};
  for(const key of keys)(key.endsWith('Bg')?bg:fg)[key]=key.endsWith('Bg')?(appearance==='dark'?0:15):(appearance==='dark'?7:0);
  return new sdk.Theme(fg,bg,'256color',{name:'fixture',appearance});
}
export function sourceOracle({noColor=false,now=()=>0,mark=()=>[],name=()=>[]}={}) {
  const artifact=JSON.parse(fs.readFileSync(path.join(root,'artifacts/ui-reference/20261015/source-oracle.json'),'utf8'));
  const hash=value=>createHash('sha256').update(value).digest('hex');
  if(hash(fs.readFileSync(artifact.sourcePath))!==artifact.sourceHash)throw Error('REFERENCE_SOURCE_CHANGED');
  for(const snippet of [...Object.values(artifact.snippets),...Object.values(artifact.hostSnippets??{})])if(hash(snippet.code)!==snippet.sha256)throw Error('REFERENCE_SNIPPET_CHANGED');
  const context=vm.createContext({process:{env:{}},referenceConstants:artifact.constants,oracleEnv:noColor?{NO_COLOR:'1'}:{},oracleNow:now,vGA:mark,mGA:name,WN:tui.stripTerminalSequences,pI:tui.truncateToWidth,nA:tui.visibleWidth,oC:tui.wrapTextWithAnsi,QW:tui.Markdown,F7:tui.Editor,mD:tui.CURSOR_MARKER,iX:tui.rgbColor,XwA:tui.mixColors,WwA:tui.backgroundAnsi,fwA:()=>'256color'});
  const setup='const MW=(a,b)=>s=>`\u001b[${a}m${s}\u001b[${b}m`; const ItA=s=>s; const XtA=40,WtA=6,eGA=3,leI="\\ue000",OtA="\\ue001";';
  const code=Object.values(artifact.snippets).map(snippet=>snippet.code).join('\n');
  const startup='const {MeI,FeI,keI,ReI,tsA,ZeI,esA,LeI}=referenceConstants; const ssA="   ",AtA=[4,3],UeI=mGA(4),JeI=[[1,8],[2,16],[4,32],[64,128]],nsA=[0.25,0.75];';
  return vm.runInContext(`${setup}\n${startup}\n${code}\n({theme:o7(oracleEnv),Row:B0A,footer:p7,Editor:A0A,Working:uGA,Startup:lGA,Lockup:Mh,raster:asA,constants:referenceConstants})`,context,{timeout:1000});
}
export const host={terminal:{rows:40,columns:120},requestRender(){}};
export function renderContext(args={},overrides={}) {
  return {args,toolCallId:'fixture',state:{},cwd:root,invalidate(){},argsComplete:true,executionStarted:true,isPartial:false,expanded:false,isError:false,...overrides};
}
