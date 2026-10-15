import fs from 'node:fs';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import http2 from 'node:http2';
import dgram from 'node:dgram';
import dns from 'node:dns';
import { syncBuiltinESMExports } from 'node:module';
import path from 'node:path';
import { root, canonicalPath, isWithin } from './paths.mjs';
import { isMainThread, threadId } from 'node:worker_threads';
import { randomUUID } from 'node:crypto';

// Fixture imports must not fall back to a real user's default agent/auth directory.
if (!process.env.PI_CODING_AGENT_DIR || !isWithin(canonicalPath(root),canonicalPath(process.env.PI_CODING_AGENT_DIR))) {
  process.env.PI_CODING_AGENT_DIR = path.join(root,'tests/.tmp',`offline-agent-${process.pid}`);
  process.env.PI_CODING_AGENT_SESSION_DIR = path.join(process.env.PI_CODING_AGENT_DIR,'sessions');
}
fs.mkdirSync(process.env.PI_CODING_AGENT_DIR,{recursive:true});
const fdSource=path.join(root,'agent/bin/fd.exe');
const fdTarget=path.join(process.env.PI_CODING_AGENT_DIR,'bin/fd.exe');
if(fs.existsSync(fdSource)&&!fs.existsSync(fdTarget)){
  fs.mkdirSync(path.dirname(fdTarget),{recursive:true});fs.copyFileSync(fdSource,fdTarget);
}
process.env.PI_OFFLINE='1';

const counters = { blockedNetworkAttempts: 0, scope: 'Node fetch/WebSocket/net/tls/http/https/http2/dgram/dns; not an OS sandbox' };
let persistReceipt = () => {};
Object.defineProperty(globalThis, '__prototypeOfflineCounters', { value: counters });
function blocked() {
  counters.blockedNetworkAttempts++;
  persistReceipt();
  throw new Error('OFFLINE_NETWORK_BLOCKED: prototype live budget gate is closed');
}
globalThis.fetch = async () => blocked();
globalThis.WebSocket = class { constructor() { blocked(); } };
net.Socket.prototype.connect = blocked;
net.connect = net.createConnection = blocked;
tls.connect = blocked;
http.request = http.get = https.request = https.get = blocked;
http2.connect = blocked;
dgram.createSocket = blocked;
for (const key of Object.keys(dns)) {
  if (/^(lookup|resolve|reverse)/.test(key) && typeof dns[key] === 'function') dns[key] = blocked;
}
for (const key of Object.keys(dns.promises)) {
  if (/^(lookup|resolve|reverse)/.test(key) && typeof dns.promises[key] === 'function') dns.promises[key] = async () => blocked();
}
syncBuiltinESMExports();
if (process.env.PROTOTYPE_OFFLINE_RECEIPT) {
  const receipt = process.env.PROTOTYPE_OFFLINE_RECEIPT;
  if(isMainThread)process.on('exit', () => fs.writeFileSync(receipt, JSON.stringify({ ...counters, pid: process.pid })));
}
if(process.env.PROTOTYPE_GUARD_DIR){
  const dir=canonicalPath(process.env.PROTOTYPE_GUARD_DIR);
  if(!isWithin(canonicalPath(path.join(root,'artifacts/verification')),dir))throw new Error('INVALID_GUARD_RECEIPT_DIR');
  fs.mkdirSync(dir,{recursive:true});
  // Windows may reuse a PID before the suite ends; receipts must retain each run.
  const file=path.join(dir,`${process.pid}-${threadId}-${randomUUID()}.json`);
  persistReceipt=()=>{
    fs.writeFileSync(file+'.tmp',JSON.stringify({...counters,pid:process.pid,threadId,entrypoint:process.argv[1]??null}));
    fs.renameSync(file+'.tmp',file);
  };
  persistReceipt();
  process.on('exit',persistReceipt);
}
