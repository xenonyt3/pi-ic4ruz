import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {root} from '../src/paths.mjs';
import * as sdk from '../runtime/node_modules/@earendil-works/pi-coding-agent/dist/index.js';
import {tui} from '../src/ui-runtime.mjs';
import {sourceOracle} from '../tests/helpers/ui.mjs';

sdk.initTheme('dark');
const oracle=sourceOracle();
const samples=['Inspect src/normalize.mjs before editing.','Preserve **literal** punctuation and `code` in the prompt.'];
const cases=[];
for(const width of [80,120])for(const text of samples){
  const reference=new oracle.Row({kind:'user',key:'fixture',text},oracle.theme,{toolOutput:false,reasoning:false},true).render(width);
  const upstream=new sdk.UserMessageComponent(text).render(width);
  cases.push({width,text,expected:reference.map(tui.stripTerminalSequences),actual:upstream.map(tui.stripTerminalSequences),same:JSON.stringify(reference.map(tui.stripTerminalSequences))===JSON.stringify(upstream.map(tui.stripTerminalSequences))});
}
const packageRoot=path.join(root,'runtime/node_modules/@earendil-works/pi-coding-agent');
const paths=['dist/core/extensions/types.d.ts','dist/modes/interactive/components/user-message.js','dist/modes/interactive/interactive-mode.js'];
const sources=paths.map(relative=>{const file=path.join(packageRoot,relative);return{file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')};});
const types=fs.readFileSync(sources[0].file,'utf8');
const report={kind:'stock-capability-gap-reproduction',runtime:'stock Pi 1.0.0',reference:'Reason CLI 0.2.269 source oracle',network:'none',sources,cases,
  requirementMet:cases.every(item=>item.same),publicApi:{markdownTransformer:types.includes('registerMarkdownTransformer('),customMessageRenderer:types.includes('registerMessageRenderer'),userMessageRenderer:types.includes('setUserMessageRenderer(')},
  interpretation:'The public user component renders Markdown with its own padding and OSC133 zones. The current extension API has no user-message component replacement; a Markdown string transformer cannot control the surrounding container/layout. This is an API capability gap, not a claim that upstream behavior is a bug.'};
const directory=path.join(root,'upstream-patches/transcript-hook');fs.mkdirSync(directory,{recursive:true});
const file=path.join(directory,'reproduction.json');fs.writeFileSync(file,JSON.stringify(report,null,2));
console.log(JSON.stringify({file,requirementMet:report.requirementMet,cases:cases.length,publicApi:report.publicApi}));
