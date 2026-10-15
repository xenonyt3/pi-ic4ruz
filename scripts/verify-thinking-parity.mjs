import fs from 'node:fs';
import path from 'node:path';
import {root} from '../src/paths.mjs';
import {sdk,runtimeLabel} from '../src/upstream.mjs';
import {renderThinking,createReasonTheme} from '../src/reason-ui.mjs';
import {sourceOracle,baseTheme} from '../tests/helpers/ui.mjs';
import {assistantMessage} from '../tests/helpers/session.mjs';
import {withoutZones} from '../tests/helpers/assistant-ui.mjs';
import {thinkingSamples} from '../tests/helpers/reasoning-ui.mjs';
sdk.initTheme('dark');
const cases=[];
for(const appearance of ['dark','light'])for(const width of [80,120])for(const expanded of [false,true])for(const streaming of [false,true])for(const [name,text] of Object.entries(thinkingSamples)){
  const oracle=sourceOracle();
  if(appearance==='light')oracle.theme.setTerminalColors({background:{r:245,g:245,b:245},foreground:{r:20,g:20,b:20}});
  const theme=createReasonTheme(baseTheme(appearance));
  const expected=new oracle.Row({kind:'reasoning',key:'fixture',text},oracle.theme,{reasoning:expanded,toolOutput:false},false).render(width);
  const message=assistantMessage([{type:'thinking',thinking:text,thinkingSignature:'opaque-fixture'}]),before=JSON.stringify(message);
  const component=new sdk.AssistantMessageComponent(message,!expanded,undefined,'Thinking',1,[],undefined,undefined,()=>((value,w,_theme,context)=>renderThinking(value,w,theme,{...context,noColor:false})));
  component.updateContent(message,streaming);
  cases.push({appearance,width,expanded,streaming,name,matched:JSON.stringify(withoutZones(component.render(width)))===JSON.stringify(expected),transcriptUnchanged:JSON.stringify(message)===before});
}
const file=path.join(root,'upstream-patches/transcript-hook/thinking-parity.json');
const report={runtime:runtimeLabel,kind:'deterministic-reasoning-replay-not-live-Reason-capture',reference:'Reason CLI 0.2.269 B0A/deI; same Pi Markdown helpers',passed:cases.every(item=>item.matched&&item.transcriptUnchanged),cases,limits:['Contiguous Pi thinking blocks are grouped; Reason entry keys are not reconstructed.','Tool ordering, physical streaming timing and full transcript parity remain unasserted.']};
fs.writeFileSync(file,JSON.stringify(report,null,2));console.log(JSON.stringify({file,cases:cases.length,passed:report.passed}));if(!report.passed)process.exitCode=1;
