import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {root,canonicalPath,isWithin} from '../src/paths.mjs';

const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i++){
  if(['--fd','--runtime-from'].includes(args[i])&&args[i+1])options[args[i].slice(2)]=path.resolve(args[++i]);
  else if(args[i]==='--offline')options.offline=true;
  else throw Error(`UNKNOWN_BOOTSTRAP_OPTION: ${args[i]}`);
}
if(process.platform!=='win32'||Number(process.versions.node.split('.')[0])<24)throw Error('This checkpoint targets native Windows and Node 24+. Other platforms are not verified.');
if(isWithin(canonicalPath(path.join(os.homedir(),'.pi')),canonicalPath(root)))throw Error('Do not bootstrap inside the user Pi profile.');
const patch=path.join(root,'upstream-patches/transcript-hook'),build=path.join(patch,'build');
if(fs.existsSync(build))throw Error('Candidate build already exists. Use a fresh checkout; bootstrap does not overwrite an existing runtime.');
const hash=data=>createHash('sha256').update(data).digest('hex');
function run(command,args,cwd=root){
  const result=spawnSync(command,args,{cwd,stdio:'inherit',windowsHide:true});
  if(result.error)throw result.error;if(result.status!==0)throw Error(`SETUP_COMMAND_FAILED: ${command}`);
}
const npmCli=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
if(!fs.existsSync(npmCli))throw Error('Install the standard Node.js distribution with npm.');
function install(directory){run(process.execPath,[npmCli,'ci','--ignore-scripts','--no-audit','--no-fund',...(options.offline?['--offline']:[])],directory);}
const runtime=path.join(root,'runtime'),modules=path.join(runtime,'node_modules');
if(options['runtime-from']){
  const from=options['runtime-from'];
  if(fs.existsSync(modules))throw Error('Runtime destination is not empty.');
  if(hash(fs.readFileSync(path.join(from,'package-lock.json')))!==hash(fs.readFileSync(path.join(runtime,'package-lock.json'))))throw Error('CACHED_RUNTIME_LOCK_MISMATCH');
  fs.cpSync(path.join(from,'node_modules'),modules,{recursive:true});
}else install(runtime);
install(path.join(root,'tools/typecheck'));
const stock=path.join(modules,'@earendil-works/pi-coding-agent');
if(JSON.parse(fs.readFileSync(path.join(stock,'package.json'))).version!=='1.0.0')throw Error('UPSTREAM_VERSION_MISMATCH');
const provenance=JSON.parse(fs.readFileSync(path.join(patch,'source-provenance.json')));
for(const record of provenance.provenance){
  const normalized=record.sourceMap.replaceAll('\\','/'),relative=normalized.slice(normalized.lastIndexOf('/dist/')+6);
  const current=path.join(stock,'dist',relative);
  if(hash(fs.readFileSync(current))!==record.sourceMapHash)throw Error(`UPSTREAM_SOURCE_MAP_MISMATCH: ${relative}`);
  const original=path.join(patch,'source-original',relative.replace(/\.js\.map$/,'.ts'));
  if(hash(fs.readFileSync(original))!==record.contentHash)throw Error(`ORIGINAL_SOURCE_MISMATCH: ${relative}`);
  record.sourceMap=current;
}
provenance.stock=stock;
fs.writeFileSync(path.join(patch,'source-provenance.json'),JSON.stringify(provenance,null,2));
fs.mkdirSync(build,{recursive:true});
fs.cpSync(stock,path.join(build,'package'),{recursive:true,filter:file=>!file.startsWith(path.join(stock,'dist/bundle'))});
fs.cpSync(modules,path.join(build,'node_modules'),{recursive:true,filter:file=>file!==stock&&!file.startsWith(stock+path.sep)});
fs.copyFileSync(path.join(runtime,'package-lock.json'),path.join(build,'dependency-lock.json'));
if(options.fd){
  const expected=JSON.parse(fs.readFileSync(path.join(root,'config/tool-binaries.json'))).fd.sha256;
  if(hash(fs.readFileSync(options.fd))!==expected)throw Error('FD_BINARY_HASH_MISMATCH: expected the recorded fd 10.5.0 Windows executable.');
  fs.mkdirSync(path.join(root,'agent/bin'),{recursive:true});fs.copyFileSync(options.fd,path.join(root,'agent/bin/fd.exe'));
}
const files={};
function add(file){files[path.relative(root,file).replaceAll('\\','/')]=hash(fs.readFileSync(file));}
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);if(entry.isSymbolicLink())throw Error('BOOTSTRAP_SYMLINK_DENIED');if(entry.isDirectory())walk(file);else add(file);
}}
walk(modules);
for(const file of ['runtime/package.json','runtime/package-lock.json','runtime/exports.mjs'])add(path.join(root,file));
if(options.fd)add(path.join(root,'agent/bin/fd.exe'));
fs.writeFileSync(path.join(root,'config/runtime-identity.json'),JSON.stringify({version:'1.0.0',source:'Fresh-device bootstrap from committed npm lock; not the original workstation baseline.',files},null,2));
run(process.execPath,[path.join(patch,'build.mjs')]);
fs.mkdirSync(path.join(root,'agent/sessions'),{recursive:true});fs.mkdirSync(path.join(root,'workspace'),{recursive:true});
run(process.execPath,[path.join(root,'launch.mjs'),'--version'],path.join(root,'workspace'));
fs.mkdirSync(path.join(root,'.device-bootstrap'),{recursive:true});
fs.writeFileSync(path.join(root,'.device-bootstrap/receipt.json'),JSON.stringify({createdAt:new Date().toISOString(),platform:process.platform,node:process.version,runtime:'1.0.0+reason-ui.3',fdInstalled:!!options.fd,offlineLauncherVersion:true,fullAcceptance:'not run; original-machine baseline and proprietary reference oracle are not distributed'},null,2));
console.log('Bootstrap complete. Launcher remains offline. Read HANDOFF.md before testing or enabling a provider.');
if(!options.fd)console.log('fd.exe was not installed; find/grep fixture coverage is not verified on this device.');
