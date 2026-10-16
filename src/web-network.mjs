import { isIP } from 'node:net';
import { lookup as nativeLookup } from 'node:dns/promises';

export function publicAddress(address) {
  const host = address.replace(/^\[|\]$/g, '').toLowerCase();
  if (isIP(host) === 6) return /^[23]/.test(host) && !host.startsWith('2001:db8:');
  if (isIP(host) !== 4) return false;
  const [a,b] = host.split('.').map(Number);
  return a > 0 && a < 224 && a !== 10 && a !== 127 && !(a === 169 && b === 254) &&
    !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && [0,2,168].includes(b)) &&
    !(a === 100 && b >= 64 && b <= 127) && !(a === 198 && [18,19,51].includes(b)) && !(a === 203 && b === 0);
}

export function createWebNetwork({config, fetchImpl=globalThis.fetch, lookup=nativeLookup, blockedOrigins=[]}) {
  const localOrigins = new Set(config.localOrigins);
  const blocked = new Set(blockedOrigins.map(value => new URL(value).origin));
  async function validate(raw,signal=AbortSignal.timeout(config.timeoutMs)) {
    signal.throwIfAborted();
    if (typeof raw !== 'string' || raw.length > 4096) throw new Error('WEB_URL_INVALID');
    let url; try { url = new URL(raw); } catch { throw new Error('WEB_URL_INVALID'); }
    if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error('WEB_URL_SCHEME_OR_CREDENTIAL_DENIED');
    if (blocked.has(url.origin) || ['20128'].includes(url.port)) throw new Error('WEB_MODEL_ENDPOINT_DENIED');
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (localOrigins.has(url.origin)) {
      if (!['localhost','127.0.0.1','::1'].includes(host)) throw new Error('WEB_LOCAL_ORIGIN_INVALID');
      return url;
    }
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || !host.includes('.') && !isIP(host)) throw new Error('WEB_PRIVATE_ADDRESS_DENIED');
    let onAbort;
    const aborted=new Promise((_,reject)=>{onAbort=()=>reject(new Error('WEB_CANCELLED'));signal.addEventListener('abort',onAbort,{once:true});});
    let records;
    try{records=isIP(host)?[{address:host}]:await Promise.race([lookup(host,{all:true}),aborted]);}
    finally{signal.removeEventListener('abort',onAbort);}
    signal.throwIfAborted();
    if (!records.length || records.some(record=>!publicAddress(record.address))) throw new Error('WEB_PRIVATE_ADDRESS_DENIED');
    return url;
  }
  async function read(raw, {signal, method='GET', body, headers={},stopWhen}={}) {
    const combined=AbortSignal.any([AbortSignal.timeout(config.timeoutMs),...(signal?[signal]:[])]);
    let url=await validate(raw,combined);
    for (let redirects=0; redirects<=5; redirects++) {
      combined.throwIfAborted();
      let response;
      try{response=await fetchImpl(url.href,{method,body,headers:{'User-Agent':'Mozilla/5.0 Pi-OMP-Web/1.0','Accept':'text/html,text/plain,application/json;q=0.8',...headers},redirect:'manual',signal:combined});}
      catch(error){
        const code=String(error?.cause?.code??error?.code??'');
        if(/CERT|TLS|SELF_SIGNED/.test(code))throw new Error('WEB_TLS_CERTIFICATE_REJECTED');
        if(combined.aborted)throw new Error('WEB_CANCELLED_OR_TIMEOUT');
        throw new Error('WEB_NETWORK_FAILED');
      }
      if ([301,302,303,307,308].includes(response.status)) {
        await response.body?.cancel();
        if (redirects===5 || !response.headers.get('location')) throw new Error('WEB_REDIRECT_LIMIT');
        url=await validate(new URL(response.headers.get('location'),url).href,combined);
        if (response.status===303 || [301,302].includes(response.status) && method==='POST') { method='GET'; body=undefined; }
        continue;
      }
      if (!response.ok) { await response.body?.cancel(); throw new Error(`WEB_HTTP_${response.status}`); }
      const type=response.headers.get('content-type')?.split(';')[0].trim()??'text/html';
      if (!type.startsWith('text/') && !['application/json','application/xhtml+xml','application/xml'].includes(type)) {
        await response.body?.cancel(); throw new Error('WEB_UNSUPPORTED_CONTENT_TYPE');
      }
      if (Number(response.headers.get('content-length'))>config.maxResponseBytes) { await response.body?.cancel(); throw new Error('WEB_RESPONSE_TOO_LARGE'); }
      const reader=response.body?.getReader(); if (!reader) return {url:url.href,type,text:''};
      const chunks=[];let size=0;
      try {
        while(true) {
          combined.throwIfAborted();
          const {done,value}=await reader.read();if(done)break;
          size+=value.byteLength;if(size>config.maxResponseBytes)throw new Error('WEB_RESPONSE_TOO_LARGE');
          chunks.push(Buffer.from(value));
          if(stopWhen?.(Buffer.concat(chunks).toString('utf8'),type))break;
        }
      } finally { await reader.cancel().catch(()=>{}); reader.releaseLock(); }
      return {url:url.href,type,text:Buffer.concat(chunks).toString('utf8')};
    }
  }
  return {validate,read};
}
