import { AsyncLocalStorage } from 'node:async_hooks';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import http2 from 'node:http2';
import dgram from 'node:dgram';
import dns from 'node:dns';
import { syncBuiltinESMExports } from 'node:module';

// Only the budget transport receives this capability. Child workers retain the
// stricter offline guard. This is a trusted-process boundary, not an OS sandbox.
export function installLiveNetworkGuard() {
  const permit=new AsyncLocalStorage(),fetchImpl=globalThis.fetch.bind(globalThis);
  const denied=()=>{throw new Error('LIVE_UNBROKERED_NETWORK_DENIED');};
  const wrap=(object,key)=>{const original=object[key];object[key]=function(...args){if(!permit.getStore())return denied();return original.apply(this,args);};};
  globalThis.fetch=async()=>denied();globalThis.WebSocket=class{constructor(){denied();}};
  wrap(net.Socket.prototype,'connect');
  for(const [object,keys]of [[net,['connect','createConnection']],[tls,['connect']],[http,['request','get']],[https,['request','get']],[http2,['connect']],[dgram,['createSocket']]])for(const key of keys)wrap(object,key);
  for(const object of [dns,dns.promises])for(const key of Object.keys(object))if(/^(lookup|resolve|reverse)/.test(key)&&typeof object[key]==='function')wrap(object,key);
  syncBuiltinESMExports();
  const guardedFetch=(url,init)=>permit.run(true,()=>fetchImpl(url,init));
  // Native Codex needs one inbound loopback broker. This capability cannot bind
  // a public interface or enable outbound traffic for model tool processes.
  guardedFetch.listenLoopback=server=>permit.run(true,()=>server.listen(0,'127.0.0.1'));
  return guardedFetch;
}
