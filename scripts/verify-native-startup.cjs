// Run with the installed VS Code Electron runtime (ELECTRON_RUN_AS_NODE=1).
// node-pty is read from its asar; neither VS Code nor Pi profiles are changed.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const runtimeLabel=JSON.parse(fs.readFileSync(path.join(root,'config/runtime-candidate.json'))).version;
const {pathToFileURL}=require('node:url');
const pty=require(process.argv[2]);
const node=process.argv[3];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const strip=value=>value.replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g,'').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'');
const out=path.join(root,'artifacts/ui-replay');
const progress=path.join(out,'startup-native-progress.json');
async function run(args,exercise){
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;delete env.NO_COLOR;
  env.TERM='xterm-256color';env.COLORTERM='truecolor';
  const terminal=pty.spawn(node,args,{name:'xterm-256color',cols:120,rows:40,cwd:path.join(root,'workspace'),env,useConpty:true});
  const chunks=[];terminal.onData(data=>chunks.push(data));
  let exit;const closed=new Promise(resolve=>terminal.onExit(event=>{exit=event;resolve(event);}));
  const deadline=Date.now()+60000;
  const wait=async condition=>{while(!condition()){if(exit)throw Error(`EARLY_EXIT ${exit.exitCode}: ${strip(chunks.join('')).slice(-1500)}`);if(Date.now()>deadline)throw Error('NATIVE_TIMEOUT');await sleep(50);}};
  const timeout=setTimeout(()=>terminal.kill(),62000);
  try{const checks=await exercise({terminal,chunks,wait,pid:terminal.pid});const ended=await closed;assert.equal(ended.exitCode,0);return {checks,chunks,exitCode:ended.exitCode};}
  finally{clearTimeout(timeout);if(!exit)terminal.kill();}
}
(async()=>{
  fs.writeFileSync(progress,'{}');
  const sdk=await run(['--import',pathToFileURL(path.join(root,'src/offline-guard.mjs')).href,path.join(root,'tests/helpers/startup-host.mjs'),'--native'],async({terminal,chunks,wait,pid})=>{
    const stage=()=>{try{return JSON.parse(fs.readFileSync(progress)).stage;}catch{return null;}};
    await wait(()=>stage()==='idle');
    await wait(()=>stage()==='thinking');terminal.resize(80,24);
    await wait(()=>stage()==='writing');terminal.resize(120,40);
    await wait(()=>stage()==='awaiting-cancel');terminal.write('\x1b');
    return {resize:'120x40 -> 80x24 -> 120x40',escapeCancel:true,unicode:strip(chunks.join('')).includes('CAF\u00c9')};
  });
  const host=JSON.parse(fs.readFileSync(path.join(out,'startup-native-host.json')));assert.equal(host.passed,true);assert.equal(host.native,true);
  assert.ok(host.frames.some(frame=>frame.columns===80));assert.equal(host.timersAfterTurns,0);assert.ok(sdk.checks.unicode);
  const launcher=await run([path.join(root,'launch.mjs'),'--no-session','--tui-mode','fullscreen'],async({terminal,chunks,wait})=>{
    const text=()=>strip(chunks.join(''));
    await wait(()=>text().includes(`Pi ${runtimeLabel}`)&&text().includes('9router/cx/gpt-6-sol'));
    await sleep(2700);terminal.resize(80,24);await sleep(300);terminal.resize(32,16);await sleep(300);terminal.resize(120,40);await sleep(300);
    terminal.write('\x1b[200~Native CAF\u00c9\nsecond line\x1b[201~');
    await wait(()=>text().includes('Native CAF\u00c9')&&text().includes('second line'));
    terminal.write('\x03');await sleep(200);terminal.write('\x04');
    return {actualIdentity:true,resize:'120x40 -> 80x24 -> 32x16 -> 120x40',unicodePaste:true,clearAndExit:true};
  });
  const receipt={kind:'actual-Windows-ConPTY-synthetic-SDK-and-production-launcher-not-live-Reason',runtime:runtimeLabel,modelRequests:0,passed:true,sdk,host,launcher};
  fs.writeFileSync(path.join(out,'windows-pty-startup-working.json'),JSON.stringify(receipt,null,2));
  console.log(JSON.stringify({passed:true,sdk:sdk.checks,launcher:launcher.checks,timersAfterTurns:host.timersAfterTurns}));
})().then(()=>process.exit(0),error=>{console.error(error);process.exit(1);});
