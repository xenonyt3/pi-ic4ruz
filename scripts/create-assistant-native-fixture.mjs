import fs from 'node:fs';
import path from 'node:path';
import {sdk} from '../src/upstream.mjs';
import {root,resolvePrototypePaths} from '../src/paths.mjs';
import {assistantMessage} from '../tests/helpers/session.mjs';

const manager=sdk.SessionManager.create(path.join(root,'workspace'),resolvePrototypePaths().sessions);
manager.appendModelChange('9router','cx/gpt-6-sol');
manager.appendMessage({role:'user',content:'Preserve **literal** input and inspect the result.',timestamp:Date.now()});
const text='## Offline display fixture\n\n> Preserve Unicode: CAF\u00c9.\n\n    const value = 42;\n    return value;\n\nNo model request was made.';
manager.appendMessage(assistantMessage([{type:'text',text}],{provider:'9router',model:'cx/gpt-6-sol'}));
const file=path.join(root,'artifacts/ui-replay/native-assistant-session.json');
fs.writeFileSync(file,JSON.stringify({sessionFile:manager.getSessionFile(),fixture:true,modelRequests:0},null,2));
console.log(JSON.stringify({file,sessionFile:manager.getSessionFile()}));
