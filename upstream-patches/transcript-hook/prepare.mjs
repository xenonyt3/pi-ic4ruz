import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {assertIsolation} from '../../launch.mjs';
import {root,resolvePrototypePaths} from '../../src/paths.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const stock=path.join(root,'runtime/node_modules/@earendil-works/pi-coding-agent');
const build=path.join(here,'build');
assertIsolation(resolvePrototypePaths(),path.join(root,'workspace'));
if(fs.existsSync(path.join(here,'source'))||fs.existsSync(build))throw Error('CANDIDATE_ALREADY_PREPARED');
const hash=data=>createHash('sha256').update(data).digest('hex');
const mappings=[['core/extensions/types','core/extensions/types'],['modes/interactive/components/user-message','modes/interactive/components/user-message'],['modes/interactive/components/assistant-message','modes/interactive/components/assistant-message'],['modes/interactive/interactive-mode','modes/interactive/interactive-mode']];
const provenance=[];
for(const [dist,source]of mappings){
  const mapFile=path.join(stock,`dist/${dist}.js.map`), map=JSON.parse(fs.readFileSync(mapFile,'utf8'));
  if(map.sourcesContent?.length!==1)throw Error(`SOURCE_MAP_CONTENT_MISSING: ${dist}`);
  const content=map.sourcesContent[0];
  for(const dir of ['source-original','source']){const output=path.join(here,dir,source+'.ts');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,content,{flag:'wx'});}
  provenance.push({sourceMap:mapFile,sourceMapHash:hash(fs.readFileSync(mapFile)),source:map.sources[0],contentHash:hash(content)});
}
fs.mkdirSync(build,{recursive:true});
fs.cpSync(stock,path.join(build,'package'),{recursive:true,filter:source=>!source.startsWith(path.join(stock,'dist/bundle'))});
const modules=path.join(root,'runtime/node_modules');
fs.cpSync(modules,path.join(build,'node_modules'),{recursive:true,filter:source=>source!==stock&&!source.startsWith(stock+path.sep)});
fs.copyFileSync(path.join(root,'runtime/package-lock.json'),path.join(build,'dependency-lock.json'));
fs.writeFileSync(path.join(here,'source-provenance.json'),JSON.stringify({upstream:'@earendil-works/pi-coding-agent@1.0.0',stock,provenance,dependencyLockHash:hash(fs.readFileSync(path.join(build,'dependency-lock.json'))),strategy:'Separate package tree and byte-copied pinned dependencies; no symlinks, no installed runtime edits, no inference.'},null,2));
console.log(JSON.stringify({build,sourceFiles:provenance.length,prepared:true}));
