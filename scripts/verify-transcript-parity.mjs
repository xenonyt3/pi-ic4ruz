import fs from 'node:fs';
import path from 'node:path';
import {root} from '../src/paths.mjs';
import {sdk,runtimeLabel} from '../src/upstream.mjs';
import {tui} from '../src/ui-runtime.mjs';
import {sourceOracle,baseTheme} from '../tests/helpers/ui.mjs';
import {renderUserMessage,createReasonTheme,editorSurface} from '../src/reason-ui.mjs';

if(runtimeLabel!=='1.0.0+reason-ui.3')throw Error('PATCHED_RUNTIME_REQUIRED');
sdk.initTheme('dark');
const cases=[];
for(const width of [80,120])for(const measured of [false,true])for(const text of ['Inspect src/normalize.mjs.','Preserve **literal** and `code`.','first\nCAF\u00c9',Array(40).fill('long/path').join(' ')]){
  const oracle=sourceOracle(),colors={background:{r:16,g:16,b:16},foreground:{r:240,g:240,b:240}};
  if(measured)oracle.theme.setTerminalColors(colors);
  const expected=new oracle.Row({kind:'user',key:'x',text},oracle.theme,{toolOutput:false,reasoning:false},true).render(width);
  const theme=createReasonTheme(baseTheme());
  const actual=new sdk.UserMessageComponent(text,undefined,1,[],()=>((value,w)=>renderUserMessage(value,w,theme,measured?editorSurface(colors,{noColor:false}):null))).render(width).map(line=>line.replace(/\x1b\]133;[ABC]\x07/g,''));
  cases.push({width,measured,text,matched:JSON.stringify(actual)===JSON.stringify(expected),plain:actual.map(tui.stripTerminalSequences)});
}
const report={runtime:runtimeLabel,reference:'Reason CLI 0.2.269 source oracle, attached user-row framing',kind:'deterministic-component-replay-not-live-Reason-capture',passed:cases.every(item=>item.matched),cases};
const output=path.join(root,'upstream-patches/transcript-hook/parity.json');fs.writeFileSync(output,JSON.stringify(report,null,2));
console.log(JSON.stringify({output,passed:report.passed,cases:cases.length}));if(!report.passed)process.exitCode=1;
