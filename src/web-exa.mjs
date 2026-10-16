import {randomUUID} from 'node:crypto';
import {decodeJsonRpcResponse} from '../vendor/oh-my-pi/json-rpc.mjs';
import {normalizeExaMcpPayload,parseExaMcpTextPayload,isSearchResponse,buildExaMcpArgs} from '../vendor/oh-my-pi/exa.mjs';

export function selectExaResponse(text,type,id,partial=false) {
  let values;
  if(type==='text/event-stream') {
    const frames=text.replace(/\r\n|\r/g,'\n').split('\n\n');
    // Incomplete frames are never treated as terminal responses.
    if(partial)frames.pop();
    values=frames.map(frame=>frame.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n')).filter(Boolean);
  } else values=[text];
  for(const value of values) {
    let parsed;
    try{parsed=JSON.parse(value);}catch{if(partial&&type!=='text/event-stream')return null;throw new Error('WEB_SEARCH_RPC_INVALID');}
    let message;try{message=decodeJsonRpcResponse(parsed);}catch{throw new Error('WEB_SEARCH_RPC_INVALID');}
    if(message?.id===id)return message;
  }
  if(partial)return null;
  throw new Error('WEB_SEARCH_RPC_RESPONSE_MISSING');
}

export function createExaSearch(network) {
  let queue=Promise.resolve(),next=0;
  return async(args,signal)=>{
    const slot=queue.then(async()=>{
      signal.throwIfAborted();
      const delay=Math.max(0,next-Date.now());
      if(delay)await new Promise((resolve,reject)=>{
        const onAbort=()=>{clearTimeout(timer);reject(new Error('WEB_CANCELLED'));};
        const timer=setTimeout(()=>{signal.removeEventListener('abort',onAbort);resolve();},delay);
        signal.addEventListener('abort',onAbort,{once:true});
      });
      signal.throwIfAborted();next=Date.now()+1000;
    });
    queue=slot.catch(()=>{});await slot;
    const id=randomUUID();
    const days={day:1,week:7,month:30,year:365}[args.recency];
    const params=buildExaMcpArgs({query:args.query,num_results:args.limit??5,...(days?{start_published_date:new Date(Date.now()-days*86400000).toISOString().slice(0,10)}:{})});
    const response=await network.read('https://mcp.exa.ai/mcp?tools=web_search_exa',{
      method:'POST',signal,headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream','x-exa-source':'oh-my-pi'},
      body:JSON.stringify({jsonrpc:'2.0',id,method:'tools/call',params:{name:'web_search_exa',arguments:params}}),
      stopWhen:(text,type)=>!!selectExaResponse(text,type,id,true)
    });
    const rpc=selectExaResponse(response.text,response.type,id);
    if(rpc.error||rpc.result?.isError)throw new Error('WEB_SEARCH_PROVIDER_ERROR');
    let payload=normalizeExaMcpPayload(rpc.result);
    if(!isSearchResponse(payload))payload=parseExaMcpTextPayload(payload);
    if(!payload||!Array.isArray(payload.results))throw new Error('WEB_SEARCH_FORMAT_UNRECOGNIZED');
    const sources=payload.results.filter(item=>{
      try{const u=new URL(item.url);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}
    }).slice(0,args.limit??5).map(item=>({title:item.title??item.url,url:item.url,snippet:(item.text??item.highlights?.join(' ')??'').slice(0,500),publishedDate:item.publishedDate??undefined}));
    return {provider:'exa',transport:'public-mcp',sources};
  };
}
