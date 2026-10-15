import fs from 'node:fs';
import path from 'node:path';
import {sdk,runtimeLabel} from '../src/upstream.mjs';
import {root,resolvePrototypePaths} from '../src/paths.mjs';
import {assistantMessage} from '../tests/helpers/session.mjs';
const manager=sdk.SessionManager.create(path.join(root,'workspace'),resolvePrototypePaths().sessions);
manager.appendModelChange('9router','cx/gpt-6-sol');
manager.appendMessage({role:'user',content:'Inspect **literal** CAF\u00c9 layout.',timestamp:Date.now()});
manager.appendMessage(assistantMessage([
  {type:'thinking',thinking:'**Preserve order**\nExpanded CAF\u00c9 reasoning.',thinkingSignature:'offline-layout-signature'},
  {type:'text',text:'Before alpha.'},
  {type:'toolCall',id:'layout-a',name:'read',arguments:{path:'alpha.txt'}},
  {type:'toolCall',id:'layout-b',name:'read',arguments:{path:'beta.txt'}},
  {type:'text',text:'Between groups.'},
  {type:'toolCall',id:'layout-c',name:'read',arguments:{path:'missing.txt'}},
  {type:'text',text:'After tools.'},
],{provider:'9router',model:'cx/gpt-6-sol'}));
for(const [id,text,isError] of [['layout-a','Alpha result: CAF\u00c9.',false],['layout-b','Beta result: preserved.',false],['layout-c','Synthetic missing-file error.',true]])manager.appendMessage({role:'toolResult',toolName:'read',toolCallId:id,content:[{type:'text',text}],isError,timestamp:Date.now()});
manager.appendMessage(assistantMessage([{type:'text',text:'Finished offline.'}],{provider:'9router',model:'cx/gpt-6-sol'}));
const record={runtime:runtimeLabel,sessionFile:manager.getSessionFile(),fixture:true,modelRequests:0};
fs.writeFileSync(path.join(root,'artifacts/ui-replay/native-layout-session.json'),JSON.stringify(record,null,2));
console.log(JSON.stringify(record));
