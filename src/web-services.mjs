import fs from 'node:fs';
import path from 'node:path';
import {root} from './paths.mjs';
import {createWebNetwork} from './web-network.mjs';
import {parseHtmlResults,isAnomalyResponse} from '../vendor/oh-my-pi/duckduckgo.mjs';
import {createExaSearch} from './web-exa.mjs';

export function loadWebConfig() {
  const config=JSON.parse(fs.readFileSync(path.join(root,'config/web-tools.json'),'utf8'));
  if(typeof config.enabled!=='boolean'||!['exa','duckduckgo','google'].includes(config.searchProvider)||typeof config.browserHeadless!=='boolean'||typeof config.browserExecutable!=='string')throw new Error('WEB_CONFIG_INVALID');
  for(const [key,min,max] of [['timeoutMs',1000,120000],['maxResponseBytes',1024,8388608],['maxOutputChars',1000,64000]])
    if(!Number.isSafeInteger(config[key])||config[key]<min||config[key]>max)throw new Error('WEB_CONFIG_INVALID');
  if(!Array.isArray(config.localOrigins)||config.localOrigins.some(value=>{
    try {const u=new URL(value);return !['http:','https:'].includes(u.protocol)||!['localhost','127.0.0.1','[::1]'].includes(u.hostname)||u.origin!==value||u.port==='20128';}catch{return true;}
  }))throw new Error('WEB_CONFIG_INVALID');
  return config;
}

export function createWebServices({config=loadWebConfig(),fetchImpl,lookup,workspace,directory,blockedOrigins=[],secrets=[],browserFactory}={}) {
  const network=createWebNetwork({config,fetchImpl,lookup,blockedOrigins});
  const searchExa=createExaSearch(network);
  const active=new Set();let browser,browserPromise;let closed=false;
  const getBrowser=()=>browserPromise??=(async()=>browser=browserFactory?browserFactory():new (await import('./web-browser.mjs')).WebBrowser({config,network,workspace,directory}))();
  const sanitize=value=>{
    let text=String(value);
    for(const secret of secrets)if(typeof secret==='string'&&secret.length)text=text.split(secret).join('[REDACTED]');
    return text;
  };
  const bounded=value=>{
    const text=sanitize(typeof value==='string'?value:JSON.stringify(value));
    return text.length>config.maxOutputChars?text.slice(0,config.maxOutputChars)+'\n[WEB_OUTPUT_TRUNCATED]':text;
  };
  async function run(kind,args,signal) {
    if(closed||!config.enabled)throw new Error('WEB_TOOLS_DISABLED');
    const controller=new AbortController();active.add(controller);
    const combined=AbortSignal.any([controller.signal,AbortSignal.timeout(config.timeoutMs),...(signal?[signal]:[])]);
    try {
      combined.throwIfAborted();
      if(kind==='web_search') {
        if(typeof args.query!=='string'||!args.query.trim()||args.query.length>2000)throw new Error('WEB_QUERY_INVALID');
        if(config.searchProvider==='exa'){
          const result=await searchExa(args,combined);
          return {text:bounded(result),details:{provider:result.provider,transport:result.transport,count:result.sources.length}};
        }
        const provider=config.searchProvider;let response,parseResults=parseHtmlResults,transport='http';
        if(provider==='duckduckgo') {
          const form=new URLSearchParams({q:args.query,b:'',kl:'us-en'});
          if(args.recency)form.set('df',{day:'d',week:'w',month:'m',year:'y'}[args.recency]);
          response=await network.read('https://html.duckduckgo.com/html/',{signal:combined,method:'POST',body:form.toString(),headers:{'Content-Type':'application/x-www-form-urlencoded'}});
          if(isAnomalyResponse(response.text))throw new Error('WEB_SEARCH_CHALLENGE');
        }else {
          parseResults=(await import('../vendor/oh-my-pi/google.mjs')).parseHtmlResults;
          const query=new URLSearchParams({q:args.query,num:String(args.limit??5),hl:'en',gl:'us',udm:'14',pws:'0'});
          if(args.recency)query.set('tbs',{day:'qdr:d',week:'qdr:w',month:'qdr:m',year:'qdr:y'}[args.recency]);
          const url='https://www.google.com/search?'+query;
          response=await network.read(url,{signal:combined});
          if(/unusual traffic|g-recaptcha|\/sorry\//i.test(response.text))throw new Error('WEB_SEARCH_CHALLENGE');
          if(response.text.includes('/httpservice/retry/enablejs')&&!/<h3\b/i.test(response.text)) {
            response=await (await getBrowser()).run({action:'search_html',url},combined);transport='browser';
          }
          if(/unusual traffic|g-recaptcha|\/sorry\//i.test(response.text)||response.url.includes('/sorry/'))throw new Error('WEB_SEARCH_CHALLENGE');
        }
        const sources=parseResults(response.text).filter(item=>{
          try{const u=new URL(item.url);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}
        }).slice(0,args.limit??5);
        if(!sources.length&&!/no-results|No results found/i.test(response.text))throw new Error('WEB_SEARCH_FORMAT_UNRECOGNIZED');
        return {text:bounded({provider,transport,sources}),details:{provider,transport,count:sources.length}};
      }
      if(kind==='web_extract') {
        const response=await network.read(args.url,{signal:combined});
        let result;
        if(response.type.includes('html')) {
          const {extractReadableFromHtml}=await import('../vendor/oh-my-pi/readable.mjs');
          result=await extractReadableFromHtml(response.text,response.url,args.format??'markdown',{selector:args.selector,outline:args.outline,filter:args.filter});
          if(!result)throw new Error('WEB_EXTRACT_EMPTY: selector missing or no readable content; try browser for rendered pages');
        }else result={url:response.url,text:response.text};
        combined.throwIfAborted();
        return {text:bounded(result),details:{url:sanitize(response.url),untrusted:true}};
      }
      if(kind==='browser') {
        const result=await (await getBrowser()).run(args,combined);
        return {text:bounded(result),details:{action:args.action,cleanupConfirmed:result.cleanupConfirmed}};
      }
      throw new Error('WEB_TOOL_UNKNOWN');
    } finally {active.delete(controller);}
  }
  async function abort(){for(const controller of active)controller.abort();await browser?.close();}
  return {run,abort,async close(){closed=true;await abort();},sanitize,config};
}
