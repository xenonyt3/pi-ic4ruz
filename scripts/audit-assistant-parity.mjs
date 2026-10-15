import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {root,resolvePrototypePaths} from '../src/paths.mjs';
import {sdk} from '../src/upstream.mjs';
import {tui} from '../src/ui-runtime.mjs';
import {createReasonTheme} from '../src/reason-ui.mjs';
import {sourceOracle,baseTheme} from '../tests/helpers/ui.mjs';
import {assistantMessage} from '../tests/helpers/session.mjs';

const themeModule=await import(pathToFileURL(path.join(resolvePrototypePaths().pkg,'dist/modes/interactive/theme/theme.js')));
sdk.initTheme('dark');themeModule.setThemeInstance(createReasonTheme(baseTheme()));
const samples={plain:'Inspect the input contract.',markdown:'# Result\n\n**Bold** and `inline code`.\n\n- first\n- second',quote:'> Preserve the contract.',code:'```js\nconst value = 42;\n```',indented:'    const value = 42;\n    return value;',whitespace:'\n\n trailing spaces  \n\n',unicode:'CAF\u00c9 and \u65e5\u672c\u8a9e',long:Array(70).fill('path/value').join(' '),stream:'## Checking\n\nThe value is **part',empty:''};
const zones=lines=>lines.map(line=>line.replace(/\x1b\]133;[ABC]\x07/g,''));
const cases=[];
for(const width of [80,120])for(const [name,text] of Object.entries(samples)){
  const oracle=sourceOracle();
  const expected=new oracle.Row({kind:'assistant',key:'fixture',text},oracle.theme,{toolOutput:false,reasoning:false},false).render(width);
  const component=new sdk.AssistantMessageComponent(assistantMessage([{type:'text',text}]));
  if(name==='stream')component.updateContent(assistantMessage([{type:'text',text}]),true);
  const actual=zones(component.render(width));
  cases.push({name,width,exact:JSON.stringify(actual)===JSON.stringify(expected),layout:JSON.stringify(actual.map(tui.stripTerminalSequences))===JSON.stringify(expected.map(tui.stripTerminalSequences)),actual,expected});
}
const report={kind:'assistant-hook-disabled-baseline-comparison-not-live-Reason-capture',reference:'Reason CLI 0.2.269 B0A, unattached assistant row',hook:'disabled; deliberately exercises stock rendering',terminalEnvironment:{NO_COLOR:process.env.NO_COLOR??null,FORCE_COLOR:process.env.FORCE_COLOR??null},cases,matched:cases.filter(item=>item.exact).length,layoutMatched:cases.filter(item=>item.layout).length};
fs.writeFileSync(path.join(root,'upstream-patches/transcript-hook/assistant-audit.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({matched:report.matched,layoutMatched:report.layoutMatched,total:cases.length,cases:cases.map(({name,width,exact,layout})=>({name,width,exact,layout}))}));
