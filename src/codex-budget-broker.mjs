import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {once} from 'node:events';
import {LiveBudgetTransport} from './live-budget-transport.mjs';

// This adapter accepts native Responses requests; quota and HTTP accounting stay
// in LiveBudgetTransport. The real provider credential never enters Codex.
export async function createCodexBudgetBroker({budget,baseUrl,key,ledgerPath,fetchImpl=globalThis.fetch,listenLoopback=server=>server.listen(0,'127.0.0.1')}) {
  const endpoint=baseUrl.replace(/\/$/,'')+'/responses',token=randomBytes(32).toString('hex');
  const gate=new LiveBudgetTransport({budget,endpoint,ledgerPath,interactive:true,api:'openai-responses',fetchImpl:(url,init)=>
    fetchImpl(url,{...init,headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`}})});
  const pending=new Set();
  const serve=async(req,res)=>{
    let call;
    const controller=new AbortController();
    res.on('close',()=>{if(!res.writableFinished)controller.abort();});
    try{
      if(req.headers.authorization!==`Bearer ${token}`)throw Error('CODEX_BROKER_AUTH');
      if(req.method!=='POST'||req.url!=='/v1/responses'||req.headers['content-encoding'])throw Error('CODEX_BROKER_ROUTE');
      let size=0;const chunks=[];
      for await(const chunk of req){size+=chunk.length;if(size>1048576)throw Error('CODEX_PAYLOAD_SIZE');chunks.push(chunk);}
      const payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      // Codex does not expose a CLI output-token cap. Impose the approved cap at
      // the boundary, without rewriting the model, reasoning, prompts or tools.
      payload.max_output_tokens??=budget.perRequestMaxOutputTokens;
      call=gate.createCall({condition:budget.allowanceId,kind:'parent_or_summary',signal:controller.signal});
      const response=await call.fetch(endpoint,{method:'POST',body:JSON.stringify(payload)});
      if(!response.ok||!response.body)throw Error('CODEX_PROVIDER_ERROR');
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache'});
      for await(const chunk of response.body){if(res.destroyed)throw Error('CODEX_CLIENT_CLOSED');res.write(chunk);}
      call.finish();
      if(gate.state.status==='stopped')throw Error('CODEX_ACCOUNTING_STOP');
      res.end();
    }catch(error){
      call?.finish();
      const reason=String(error?.message??'').match(/\b(?:CODEX|LIVE)_[A-Z_]+\b/)?.[0]??'CODEX_BROKER_REJECTED';
      if(!gate.abortController.signal.aborted)gate.stop(reason);
      if(!res.headersSent)res.writeHead(502,{'Content-Type':'application/json'});
      if(!res.destroyed)res.end(JSON.stringify({error:{message:'CODEX_BROKER_STOP: inspect local ledger',type:'budget_gate'}}));
    }
  };
  const server=http.createServer((req,res)=>{const work=serve(req,res);pending.add(work);work.finally(()=>pending.delete(work));});
  server.on('upgrade',(_req,socket)=>{gate.stop('codex_websocket_denied');socket.destroy();});
  server.requestTimeout=125000;server.headersTimeout=10000;
  try{listenLoopback(server);await once(server,'listening');}catch(error){gate.close();throw error;}
  return {gate,token,baseUrl:`http://127.0.0.1:${server.address().port}/v1`,async close(){
    gate.abortController.abort(new Error('LIVE_SHUTDOWN'));
    server.close();server.closeAllConnections();
    await Promise.allSettled([...pending]);gate.close();
  }};
}
