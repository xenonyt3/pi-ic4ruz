import fs from 'node:fs';
import path from 'node:path';
import {root} from '../src/paths.mjs';
import {sdk,runtimeLabel} from '../src/upstream.mjs';
import {tui} from '../src/ui-runtime.mjs';
import {sourceOracle} from '../tests/helpers/ui.mjs';
import {assistantMessage} from '../tests/helpers/session.mjs';
import {withoutZones} from '../tests/helpers/assistant-ui.mjs';
import {createReasonTheme,renderAssistantText,renderThinking} from '../src/reason-ui.mjs';
import {baseTheme} from '../tests/helpers/ui.mjs';
sdk.initTheme('dark');
const cases=[];
for(const width of [80,120])for(const expanded of [false,true])for(const text of ['Check the contract.','First thought.\n\n**Latest decision**\nMore detail.','## Inspect Unicode\n\nCAF\u00c9 and \u65e5\u672c\u8a9e']){
  const oracle=sourceOracle();
  const expected=new oracle.Row({kind:'reasoning',key:'fixture',text},oracle.theme,{reasoning:expanded,toolOutput:false},false).render(width);
  const actual=withoutZones(new sdk.AssistantMessageComponent(assistantMessage([{type:'thinking',thinking:text}]),!expanded,undefined,'Thinking').render(width));
  cases.push({width,expanded,text,expected:expected.map(tui.stripTerminalSequences),actual:actual.map(tui.stripTerminalSequences),matched:JSON.stringify(actual)===JSON.stringify(expected)});
}
const report={runtime:runtimeLabel,kind:'thinking-hook-disabled-gap-reproduction',reference:'Reason CLI 0.2.269 B0A/deI source oracle; host showEntry always gives reasoning an unattached row',cases,matched:cases.filter(item=>item.matched).length};
const oracle=sourceOracle(),theme=createReasonTheme(baseTheme());
const content=[{type:'text',text:'First answer.'},{type:'thinking',thinking:'Check next step.'}];
const actual=withoutZones(new sdk.AssistantMessageComponent(assistantMessage(content),true,undefined,'Thinking',1,[],()=>((text,width)=>renderAssistantText(text,width,theme,{noColor:false})),undefined,()=>((text,width,_theme,options)=>renderThinking(text,width,theme,{...options,noColor:false}))).render(80));
const expected=content.flatMap(block=>new oracle.Row({kind:block.type==='text'?'assistant':'reasoning',key:block.type,text:block.text??block.thinking},oracle.theme,{reasoning:false,toolOutput:false},false).render(80));
report.textThenThinking={kind:'candidate-spacing-comparison',actual:actual.map(tui.stripTerminalSequences),expected:expected.map(tui.stripTerminalSequences),matched:JSON.stringify(actual)===JSON.stringify(expected)};
fs.writeFileSync(path.join(root,'upstream-patches/transcript-hook/reasoning-gap.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({cases:cases.length,matched:report.matched}));
