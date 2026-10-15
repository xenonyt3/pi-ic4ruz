import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {root} from '../../src/paths.mjs';

const here=path.dirname(fileURLToPath(import.meta.url)),output=path.join(here,'build/package');
const stock=path.join(root,'runtime/node_modules/@earendil-works/pi-coding-agent');
const require=createRequire(path.join(stock,'package.json'));
const esbuild=require('esbuild');
const hash=data=>createHash('sha256').update(data).digest('hex');
const provenance=JSON.parse(fs.readFileSync(path.join(here,'source-provenance.json'),'utf8'));
for(const record of provenance.provenance)if(hash(fs.readFileSync(record.sourceMap))!==record.sourceMapHash)throw Error('UPSTREAM_SOURCE_DRIFT');
for(const relative of ['modes/interactive/components/user-message','modes/interactive/components/assistant-message','modes/interactive/interactive-mode']){
  const input=fs.readFileSync(path.join(here,'source',relative+'.ts'),'utf8');
  const compiled=esbuild.transformSync(input,{loader:'ts',format:'esm',target:'es2022',sourcemap:'external',sourcefile:`packages/coding-agent/src/${relative}.ts`});
  const code=compiled.code.replace(/(\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"]+)\.ts\2/g,'$1$2$3.js$2');
  fs.writeFileSync(path.join(output,'dist',relative+'.js'),code+`\n//# sourceMappingURL=${path.basename(relative)}.js.map\n`);
  fs.writeFileSync(path.join(output,'dist',relative+'.js.map'),compiled.map);
}
function declaration(relative,modify){
  const original=fs.readFileSync(path.join(stock,'dist',relative),'utf8');
  const updated=modify(original);if(updated===original)throw Error(`DECLARATION_PATCH_MISSING: ${relative}`);
  fs.writeFileSync(path.join(output,'dist',relative),updated.replace(/^\/\/# sourceMappingURL=.*$/m,''));
}
declaration('core/extensions/types.d.ts',text=>text.replace('export interface ExtensionUIContext {','export type UserMessageRenderer = (text: string, width: number, theme: Theme) => readonly string[] | undefined;\nexport type AssistantTextRenderer = (text: string, width: number, theme: Theme, isStreaming: boolean, outputPad: number) => readonly string[] | undefined;\nexport interface ThinkingRenderContext { expanded: boolean; isStreaming: boolean; outputPad: number; transform: (markdown: string, availableWidth: number) => string; }\nexport type ThinkingRenderer = (text: string, width: number, theme: Theme, context: ThinkingRenderContext) => readonly string[] | undefined;\n\nexport interface ExtensionUIContext {\n    setUserMessageRenderer?(renderer: UserMessageRenderer | undefined): void;\n    setAssistantTextRenderer?(renderer: AssistantTextRenderer | undefined): void;\n    setThinkingRenderer?(renderer: ThinkingRenderer | undefined): void;'));
declaration('modes/interactive/components/user-message.d.ts',text=>text.replace('import type { MarkdownTransformer }','import type { MarkdownTransformer, UserMessageRenderer }').replace('markdownTransformers?: readonly MarkdownTransformer[])','markdownTransformers?: readonly MarkdownTransformer[], getRenderer?: () => UserMessageRenderer | undefined, onRendererError?: (error: unknown) => void)'));
declaration('modes/interactive/components/assistant-message.d.ts',text=>text.replace('import type { MarkdownTransformer }','import type { MarkdownTransformer, AssistantTextRenderer, ThinkingRenderer }').replace('markdownTransformers?: readonly MarkdownTransformer[])','markdownTransformers?: readonly MarkdownTransformer[], getTextRenderer?: () => AssistantTextRenderer | undefined, onTextRendererError?: (error: unknown) => void, getThinkingRenderer?: () => ThinkingRenderer | undefined, onThinkingRendererError?: (error: unknown) => void)'));
declaration('modes/interactive/interactive-mode.d.ts',text=>text.replace('    private outputPad;','    private outputPad;\n    private userMessageRenderer;\n    private onUserMessageRendererError;\n    private assistantTextRenderer;\n    private onAssistantTextRendererError;\n    private thinkingRenderer;\n    private onThinkingRendererError;'));
const pkg=JSON.parse(fs.readFileSync(path.join(output,'package.json'),'utf8'));
pkg.version='1.0.0+reason-ui.3';pkg.bin.pi='dist/cli.js';pkg.exports['./rpc-entry'].import='./dist/rpc-entry.js';
pkg.prototypePatch={id:'transcript-hook-v1',upstream:'1.0.0',network:'none',installedRuntimeModified:false};
fs.writeFileSync(path.join(output,'package.json'),JSON.stringify(pkg,null,2));
fs.writeFileSync(path.join(output,'prototype-exports.mjs'),`export * as sdk from './dist/index.js';\nexport * as ai from '@earendil-works/pi-ai';\nexport { Type } from 'typebox';\nimport * as runtime from '@earendil-works/pi-codemode';\nimport * as source from '@earendil-works/pi-codemode/source';\nexport const codemode=Object.freeze({...runtime,...source});\n`);
const diff=spawnSync('git.exe',['diff','--no-index','--','source-original','source'],{cwd:here,encoding:'utf8',windowsHide:true,maxBuffer:2*1024*1024});
if(![0,1].includes(diff.status))throw Error('PATCH_DIFF_FAILED');
fs.writeFileSync(path.join(here,'transcript-hook.patch'),diff.stdout.replaceAll('a/source-original/','a/packages/coding-agent/src/').replaceAll('b/source/','b/packages/coding-agent/src/'));
const files={};
const add=file=>{files[path.relative(root,file).replaceAll('\\','/')]=hash(fs.readFileSync(file));};
function walk(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isSymbolicLink())throw Error('CANDIDATE_SYMLINK_DENIED');if(entry.isDirectory())walk(file);else if(entry.isFile())add(file);}}
for(const directory of ['build','source','source-original'])walk(path.join(here,directory));
for(const file of ['prepare.mjs','build.mjs','source-provenance.json','transcript-hook.patch'])add(path.join(here,file));
const manifest={id:'transcript-hook-v1',version:pkg.version,upstream:'1.0.0',buildTool:`esbuild ${esbuild.version} transform (not a full TypeScript typecheck)`,entrypoint:path.relative(root,path.join(output,'dist/cli.js')).replaceAll('\\','/'),sdk:path.relative(root,path.join(output,'dist/index.js')).replaceAll('\\','/'),files};
fs.writeFileSync(path.join(root,'config/runtime-candidate.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({version:pkg.version,files:Object.keys(files).length,entrypoint:manifest.entrypoint,installedRuntimeModified:false}));
