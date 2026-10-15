import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import ts from '../tools/typecheck/node_modules/typescript/lib/typescript.js';
import {root,resolvePrototypePaths} from '../src/paths.mjs';

const paths=resolvePrototypePaths(root,'transcript-hook-v1');
const patch=path.join(root,'upstream-patches/transcript-hook');
const normalize=file=>path.resolve(file).replaceAll('\\','/').toLowerCase();
const sources=new Map(),hashes={};
const hash=value=>createHash('sha256').update(value).digest('hex');
function walk(directory){
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    const file=path.join(directory,entry.name);
    if(entry.isDirectory())walk(file);
    else if(file.endsWith('.ts')){
      const relative=path.relative(path.join(patch,'source'),file);
      const virtual=path.join(paths.pkg,'dist',relative),text=fs.readFileSync(file,'utf8');
      sources.set(normalize(virtual),{virtual,text});hashes[path.relative(root,file)]=hash(text);
    }
  }
}
walk(path.join(patch,'source'));
const options={noEmit:true,strict:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,
  moduleResolution:ts.ModuleResolutionKind.NodeNext,allowImportingTsExtensions:true,
  esModuleInterop:true,skipLibCheck:true,resolveJsonModule:true,
  types:['node'],typeRoots:[path.join(root,'runtime/node_modules/@types')]};
const host=ts.createCompilerHost(options);
const fileExists=host.fileExists.bind(host),readFile=host.readFile.bind(host),getSourceFile=host.getSourceFile.bind(host);
host.fileExists=file=>sources.has(normalize(file))||fileExists(file);
host.readFile=file=>sources.get(normalize(file))?.text??readFile(file);
host.getSourceFile=(file,languageVersion,onError,shouldCreateNewSourceFile)=>{
  const source=sources.get(normalize(file));
  return source?ts.createSourceFile(file,source.text,languageVersion,true):getSourceFile(file,languageVersion,onError,shouldCreateNewSourceFile);
};
const program=ts.createProgram([...sources.values()].map(source=>source.virtual),options,host);
const diagnostics=ts.getPreEmitDiagnostics(program);
const formatted=ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:file=>file,getCurrentDirectory:()=>root,getNewLine:()=> '\n'});
const report={compiler:`TypeScript ${ts.version}`,scope:'All patched TypeScript implementation files against the selected candidate declarations; external declaration checks skipped; not a whole upstream monorepo typecheck',passed:diagnostics.length===0,sourceHashes:hashes,compilerHash:hash(fs.readFileSync(path.join(root,'tools/typecheck/node_modules/typescript/lib/typescript.js'))),lockHash:hash(fs.readFileSync(path.join(root,'tools/typecheck/package-lock.json'))),diagnostics:diagnostics.map(item=>({code:item.code,file:item.file?.fileName,line:item.file&&item.start!==undefined?item.file.getLineAndCharacterOfPosition(item.start).line+1:undefined,message:ts.flattenDiagnosticMessageText(item.messageText,'\n')}))};
report.candidateIdentityHash=hash(fs.readFileSync(path.join(root,'config/runtime-candidate.json')));
report.options={strict:true,noEmit:true,skipLibCheck:true,module:'NodeNext',target:'ES2022',allowImportingTsExtensions:true};
fs.writeFileSync(path.join(patch,'typecheck.json'),JSON.stringify(report,null,2));
if(formatted)console.error(formatted);
console.log(JSON.stringify({passed:report.passed,files:sources.size,diagnostics:diagnostics.length}));
if(!report.passed)process.exitCode=1;
