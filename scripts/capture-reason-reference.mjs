import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseExpressionAt} from 'file:///D:/reason-investigation-20261014/tools/node_modules/acorn/dist/acorn.mjs';
import {root} from '../src/paths.mjs';

const sourcePath='D:/reason-investigation-20261014/reason-readable.js';
const binaryPath='D:/reason-investigation-20261014/reason-linux-0.2.269';
const hash=value=>createHash('sha256').update(value).digest('hex');
const binaryHash=hash(fs.readFileSync(binaryPath));
if(binaryHash!=='87d20c2d10c8ebaa308949b5f65a12dd5fe28a0827fca25a6794a472f185bed7')throw Error('REFERENCE_BINARY_CHANGED');
const source=fs.readFileSync(sourcePath,'utf8');
const snippets={};
for(const name of ['o7','Q0A','deI','ueI','I0A','ND','B0A','p7','A0A','uGA','Mh','lGA','iGA','asA','YeI']){
  const match=new RegExp(`(?:function|class) ${name}\\b`).exec(source);
  if(!match)throw Error(`REFERENCE_SYMBOL_MISSING: ${name}`);
  const node=parseExpressionAt(source,match.index,{ecmaVersion:'latest'});
  const code=source.slice(node.start,node.end);
  snippets[name]={code,sha256:hash(code),line:source.slice(0,node.start).split('\n').length};
}
const out=path.join(root,'artifacts/ui-reference/20261015/source-oracle.json');
const hostSnippets={};
for(const [name,end] of [['spinToRest','offeredSuggestion'],['startWorking','refreshStatus']]){
  const start=source.indexOf(`  ${name}(`),stop=source.indexOf(`\n  ${end}(`,start);
  if(start<0||stop<0)throw Error(`REFERENCE_HOST_METHOD_MISSING: ${name}`);
  const code=source.slice(start,stop);hostSnippets[name]={code,sha256:hash(code),line:source.slice(0,start).split('\n').length};
}
const constants={};
for(const name of ['MeI','FeI','keI','ReI','tsA','ZeI','esA','LeI','cAQ','_AQ','vAQ']){
  const match=new RegExp(`\\b${name} = ([\\d.]+)[,;]`).exec(source);
  if(!match)throw Error(`REFERENCE_CONSTANT_MISSING: ${name}`);
  constants[name]=Number(match[1]);
}
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify({kind:'extracted-source-oracle-not-live-capture',version:'0.2.269',sourcePath,sourceHash:hash(source),binaryPath,binaryHash,hostDependencies:'Pinned Pi TUI 1.0.0 width/wrapping/Markdown helpers; deterministic fixtures; no Reason entrypoint or service loaded',snippets,hostSnippets,constants},null,2));
console.log(JSON.stringify({out,sourceHash:hash(source),symbols:Object.keys(snippets)}));
