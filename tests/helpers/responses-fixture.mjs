export function responsesFixture({model='cx/gpt-6-astra',text='Fixture complete.',tool,usage={input_tokens:100,output_tokens:20,total_tokens:120,input_tokens_details:{cached_tokens:40}}}={}) {
  const item=tool?{id:'fc_fixture',type:tool.custom?'custom_tool_call':'function_call',call_id:'call_fixture',name:tool.name,...(tool.namespace?{namespace:tool.namespace}:{}),...(tool.custom?{input:tool.input}:{arguments:JSON.stringify(tool.arguments)}),status:'completed'}:
    {id:'msg_fixture',type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text,annotations:[]}]};
  const response={id:'resp_fixture',object:'response',model,status:'completed',output:[item],usage};
  const events=[{type:'response.created',response:{...response,status:'in_progress',output:[],usage:null}},
    {type:'response.output_item.added',output_index:0,item:{...item,status:'in_progress',...(tool?{arguments:''}:{content:[]})}}];
  if(tool&&!tool.custom)events.push({type:'response.function_call_arguments.delta',item_id:item.id,output_index:0,delta:item.arguments},{type:'response.function_call_arguments.done',item_id:item.id,output_index:0,arguments:item.arguments});
  else if(tool)events.push({type:'response.custom_tool_call_input.delta',item_id:item.id,output_index:0,delta:item.input},{type:'response.custom_tool_call_input.done',item_id:item.id,output_index:0,input:item.input});
  else events.push({type:'response.content_part.added',item_id:item.id,output_index:0,content_index:0,part:{type:'output_text',text:'',annotations:[]}},
    {type:'response.output_text.delta',item_id:item.id,output_index:0,content_index:0,delta:text},
    {type:'response.output_text.done',item_id:item.id,output_index:0,content_index:0,text},
    {type:'response.content_part.done',item_id:item.id,output_index:0,content_index:0,part:item.content[0]});
  events.push({type:'response.output_item.done',output_index:0,item},{type:'response.completed',response});
  return new Response(events.map((event,index)=>`event: ${event.type}\ndata: ${JSON.stringify({...event,sequence_number:index})}\n\n`).join(''),{headers:{'Content-Type':'text/event-stream'}});
}
