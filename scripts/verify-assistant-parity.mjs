import fs from 'node:fs';
import path from 'node:path';
import {root} from '../src/paths.mjs';
import {sdk,runtimeLabel} from '../src/upstream.mjs';
import {renderAssistantText,createReasonTheme} from '../src/reason-ui.mjs';
import {sourceOracle,baseTheme} from '../tests/helpers/ui.mjs';
import {assistantMessage} from '../tests/helpers/session.mjs';
import {assistantSamples,withoutZones} from '../tests/helpers/assistant-ui.mjs';

sdk.initTheme('dark');
const cases=[];
for(const appearance of ['dark','light'])for(const width of [80,120])for(const streaming of [false,true])for(const [name,text] of Object.entries(assistantSamples)){
  const oracle=sourceOracle();
  if(appearance==='light')oracle.theme.setTerminalColors({background:{r:245,g:245,b:245},foreground:{r:20,g:20,b:20}});
  const expected=new oracle.Row({kind:'assistant',key:'fixture',text},oracle.theme,{toolOutput:false,reasoning:false},false).render(width);
  const theme=createReasonTheme(baseTheme(appearance));
  const message=assistantMessage([{type:'text',text}]),before=JSON.stringify(message);
  const component=new sdk.AssistantMessageComponent(message,false,undefined,'Thinking',1,[],()=>((value,w)=>renderAssistantText(value,w,theme,{noColor:false})));
  component.updateContent(message,streaming);
  const actual=withoutZones(component.render(width));
  cases.push({appearance,width,streaming,name,matched:JSON.stringify(actual)===JSON.stringify(expected),transcriptUnchanged:JSON.stringify(message)===before});
}
const report={runtime:runtimeLabel,kind:'deterministic-assistant-text-replay-not-live-Reason-capture',reference:'Reason CLI 0.2.269 B0A unattached assistant rows; Pi Markdown helpers',passed:cases.every(item=>item.matched&&item.transcriptUnchanged),cases,limits:['Empty and whitespace-only messages remain suppressed by upstream Pi.','Reason reasoning/tool/message composition and live streaming timing are not asserted.','Default outputPad=1 matches Reason; custom Pi padding is preserved.']};
const file=path.join(root,'upstream-patches/transcript-hook/assistant-parity.json');
fs.writeFileSync(file,JSON.stringify(report,null,2));
console.log(JSON.stringify({file,passed:report.passed,cases:cases.length}));if(!report.passed)process.exitCode=1;
