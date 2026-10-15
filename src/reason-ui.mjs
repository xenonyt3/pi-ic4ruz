import { sdk, runtimeLabel } from './upstream.mjs';
import { tui } from './ui-runtime.mjs';
import {ReasonStartup,ReasonWorking,systemClock} from './ui-startup.mjs';

const { truncateToWidth, visibleWidth, stripTerminalSequences, Text } = tui;
const dot = '\u25cf';
const marker = '\u203a';
const separator = ' \u00b7 ';
const editorTop='\ue000', editorBottom='\ue001';
const backgrounds = new Set(['selectedBg','searchMatchBg','userMessageBg','customMessageBg','toolPendingBg','toolSuccessBg','toolErrorBg']);
export const cleanText = value => stripTerminalSequences(String(value ?? '')).replace(/[\x00-\x08\x0b-\x1f\x7f]/g,'').replaceAll('\t','  ');
const oneLine = value => cleanText(value).replace(/\s+/g,' ').trim();

export function createReasonTheme(base,appearance=base.appearance) {
  const light = appearance === 'light';
  const fg = {}, bg = {};
  for (const [key,color] of Object.entries(base.colors)) {
    if (backgrounds.has(key)) bg[key] = key === 'selectedBg' || key === 'searchMatchBg' ? tui.colorToHex(color) : '';
    else fg[key] = tui.colorToHex(color);
  }
  const accent=light?26:75, muted=light?243:245, green=light?28:78, red=light?160:203, yellow=light?130:179;
  Object.assign(fg,{accent,border:muted,borderAccent:accent,borderMuted:muted,muted,dim:muted,success:green,error:red,warning:yellow,
    text:'',toolTitle:'',toolOutput:'',userMessageText:'',thinkingText:muted,customMessageText:muted,customMessageLabel:accent,
    mdHeading:accent,mdLink:accent,mdLinkUrl:muted,mdCode:yellow,mdCodeBlock:'',mdCodeBlockBorder:muted,mdQuoteBorder:muted,mdHr:muted,mdListBullet:accent,
    toolDiffAdded:green,toolDiffRemoved:red,toolDiffContext:muted});
  for(const key of ['thinkingOff','thinkingMinimal','thinkingLow','thinkingMedium','thinkingHigh','thinkingXhigh','thinkingMax'])fg[key]=muted;
  // The bundled CLI checks instanceof; use its own Theme realm, not the SDK copy.
  return new base.constructor(fg,bg,'256color',{name:'pi-reason-terminal',appearance});
}

export function editorSurface(colors,{noColor=process.env.NO_COLOR!==undefined,mode='256color'}={}) {
  const valid=color=>color&&['r','g','b'].every(key=>Number.isFinite(color[key])&&color[key]>=0&&color[key]<=255);
  if(noColor||!valid(colors?.background))return null;
  const background=colors.background;
  const light=(background.r*299+background.g*587+background.b*114)/1000>140;
  const foreground=valid(colors.foreground)?colors.foreground:light?{r:0,g:0,b:0}:{r:255,g:255,b:255};
  const mixed=tui.mixColors(tui.rgbColor(background.r,background.g,background.b),tui.rgbColor(foreground.r,foreground.g,foreground.b),light?0.06:0.1,'srgb');
  const fill=tui.backgroundAnsi(mixed,mode);
  return {appearance:light?'light':'dark',fill,paint:line=>`${fill}${line.replaceAll('\x1b[0m',`\x1b[0m${fill}`)}\x1b[49m`};
}

export class ReasonEditor extends sdk.CustomEditor {
  constructor(host,theme,keybindings,{onFailure=()=>{},markerColor=text=>text,getSurface=()=>null}={}) {
    super(host,theme,keybindings,{paddingX:3});
    this.onFailure=onFailure;
    this.markerColor=markerColor;
    this.getSurface=getSurface;
  }
  setPaddingX() { super.setPaddingX(3); }
  renderTopBorder(_width,hidden) { return editorTop+(hidden>0?`\u2191 ${hidden} more`:''); }
  renderBottomBorder(_width,hidden) { return editorBottom+(hidden>0?`\u2193 ${hidden} more`:''); }
  render(width) {
    try {
      const lines=super.render(width);
      const bottom=lines.findIndex(line=>line.startsWith(editorBottom));
      const surface=this.getSurface();
      const paint=line=>surface?surface.paint(line+' '.repeat(Math.max(0,width-visibleWidth(line)))):line;
      // Keep the upstream cursor marker, autocomplete and multiline scrolling intact.
      if(width>=7 && lines[1]?.startsWith('   ')) lines[1]=` ${this.markerColor(marker)} ${lines[1].slice(3)}`;
      const rendered=lines.map((line,index)=>{
        if(index===0||index===bottom){
          const label=line.slice(1);
          return surface?paint(label?`  ${this.borderColor(label)}`:''):this.borderColor(label?truncateToWidth(`\u2500\u2500 ${label} ${'\u2500'.repeat(width)}`,width,''):'\u2500'.repeat(width));
        }
        return index<bottom?paint(line):line;
      });
      // Retry/compaction remain Pi-owned; the working row uses the public widget hook.
      const indicator=this.workingStatusIndicator;
      return indicator&&indicator.kind!=='working'?[` ${indicator.renderInBorder(Math.max(1,width-1))}`,...rendered]:rendered;
    } catch(error) { this.onFailure(error); return [truncateToWidth('Editor unavailable; restored stock editor',Math.max(1,width))]; }
  }
}

export function renderToolHeader({name,args={},status='running'},theme,width) {
  const tone=status==='failed'?'error':status==='done'?'success':status==='running'?'warning':'muted';
  const title=oneLine(name), summary=oneLine(args.path??args.command??args.code??args.tasks?.map(task=>task.title??task.prompt).join('; ')??'');
  if(width<=3)return truncateToWidth(` ${theme.fg(tone,dot)} ${title}`,Math.max(1,width));
  const label=truncateToWidth(title,width-3), available=width-3-visibleWidth(label);
  return ` ${theme.fg(tone,dot)} ${label}${summary&&available>0?theme.fg('muted',truncateToWidth(` ${summary}`,available)):''}`;
}

export function renderUserMessage(text,width,theme,surface=null) {
  const lines=tui.wrapTextWithAnsi(cleanText(text),Math.max(1,width-3));
  return lines.map((line,index)=>{
    const rendered=truncateToWidth(`${index===0?` ${theme.fg('accent',marker)} `:'   '}${line}`,Math.max(1,width));
    return surface?surface.paint(rendered+' '.repeat(Math.max(0,width-visibleWidth(rendered)))):rendered;
  });
}

export function assistantMarkdownTheme(theme,{noColor=process.env.NO_COLOR!==undefined}={}) {
  const style=(open,close)=>text=>noColor?text:`\x1b[${open}m${text}\x1b[${close}m`;
  const tone=key=>text=>noColor?text:theme.fg(key,text);
  const italic=style(3,23);
  return {heading:tone('mdHeading'),link:tone('mdLink'),linkUrl:tone('mdLinkUrl'),code:tone('mdCode'),
    codeBlock:text=>text,codeBlockBorder:tone('mdCodeBlockBorder'),quote:italic,quoteBorder:tone('mdQuoteBorder'),
    hr:tone('mdHr'),listBullet:tone('mdListBullet'),bold:style(1,22),italic,strikethrough:style(9,29),underline:style(4,24)};
}

export function renderAssistantText(text,width,theme,options={}) {
  // Use Pi's Markdown parser; preserve raw indentation and Reason's restrained code/quote styling.
  const safe=stripTerminalSequences(String(text)).replace(/[\x00-\x08\x0b-\x1f\x7f]/g,'');
  return new tui.Markdown(safe,options.padding??1,0,assistantMarkdownTheme(theme,options)).render(width);
}

export function thinkingSummary(text) {
  const lines=String(text).split('\n').map(line=>line.trim()).filter(Boolean);
  return (lines.filter(line=>/^\*\*[^*].*\*\*$/.test(line)).at(-1)??lines[0]??'')
    .replace(/^#+\s*/,'').replace(/\*\*|__|`/g,'').trim();
}

export function renderThinking(text,width,theme,{expanded=false,outputPad=1,transform=value=>value,noColor=process.env.NO_COLOR!==undefined}={}) {
  const padding=outputPad+2;
  const style=(open,close)=>value=>noColor?value:`\x1b[${open}m${value}\x1b[${close}m`;
  const italic=style(3,23),dim=style(2,22);
  if(!expanded){
    const label=italic(`Thinking: ${thinkingSummary(cleanText(text))}`);
    return [truncateToWidth(' '.repeat(padding)+(noColor?label:theme.fg('muted',label)),Math.max(1,width))];
  }
  const markdown=transform(String(text).trim(),Math.max(1,width-2*padding));
  const safe=stripTerminalSequences(markdown).replace(/[\x00-\x08\x0b-\x1f\x7f]/g,'');
  return new tui.Markdown(safe,padding,0,assistantMarkdownTheme(theme,{noColor}),{color:dim,italic:true}).render(width);
}

export function renderFooter({model,provider,phase='idle',contextPercent,children=[],statuses=[],cwd,keyHints},theme,width) {
  const context=Number.isFinite(contextPercent)?`${Math.round(contextPercent)}% context`:'context unknown';
  const active=children.filter(child=>['starting','running','cancelling'].includes(child.status)).length;
  const failed=children.filter(child=>['failed','interrupted'].includes(child.status)).length;
  const pending=children.filter(child=>child.cleanupConfirmed===false).length;
  const completed=children.filter(child=>child.status==='completed').length;
  const parts=[theme.fg('accent',oneLine(`${provider??'provider unknown'}/${model??'model unknown'}`)),oneLine(phase),context];
  const childLine=children.length?`${active?`${active} child active`:completed?`${completed} child completed`:'0 child active'}${failed?`, ${failed} failed`:''}${pending?`, ${pending} cleanup pending`:''}`:'';
  const expand=keyHints?.expand??sdk.keyText('app.tools.expand'),cancel=keyHints?.cancel??sdk.keyText('app.interrupt');
  const hints=['/resume sessions','/ commands',...(expand?[`${expand} tool output`]:[]),...(cancel?[`${cancel} cancel`]:[])].join(separator);
  const lines=[parts.join(separator),childLine,oneLine(cwd)].filter(Boolean).map(line=>truncateToWidth(` ${line}`,Math.max(1,width)));
  for(const status of statuses.filter(Boolean))for(const line of tui.wrapTextWithAnsi(oneLine(status),Math.max(1,width-1)))lines.push(truncateToWidth(` ${line}`,Math.max(1,width)));
  return [...lines,truncateToWidth(` ${hints}`,Math.max(1,width))];
}

export function wrapToolPresentation(definition,{states=new Map(),failed=()=>false,onFailure=()=>{},getKeyHints=()=>({})}={}) {
  const fallback=(kind,args,theme,context,resultOptions)=>{
    try {
      const original=definition[kind];
      if(original)return kind==='renderCall'?original(args,theme,context):original(args,resultOptions,theme,context);
    } catch {}
    return new Text(kind==='renderCall'?oneLine(definition.name):cleanText(args.content?.filter(block=>block.type==='text').map(block=>block.text).join('\n')??'Tool rendering unavailable'),0,0);
  };
  const safe=(render,recover)=>({invalidate(){},render(width){try{return render(width);}catch(error){onFailure(error);return recover().render(width);}}});
  return {...definition,renderShell:'self',
    renderCall(args,theme,context) {
      if(failed()||definition.name==='edit')return fallback('renderCall',args,theme,context);
      return safe(width=>[renderToolHeader({name:definition.name,args,status:context.isError?'failed':states.get(context.toolCallId)??(context.state?.reasonResultSeen?'done':'running')},theme,width)],()=>fallback('renderCall',args,theme,context));
    },
    renderResult(result,options,theme,context) {
      if(context.state)context.state.reasonResultSeen=!options.isPartial;
      // Images, expanded output and edits retain the upstream renderer and diff handling.
      if(failed()||options.expanded||result.content?.some(block=>block.type==='image')||definition.name==='edit')return fallback('renderResult',result,theme,context,options);
      return safe(width=>{
        const isError=context.isError||result.isError;
        if(!isError&&!options.isPartial)return [];
        const output=cleanText(result.content?.filter(block=>block.type==='text').map(block=>block.text).join('\n')??'');
        const lines=output.trimEnd().split('\n'), limit=isError?4:3;
        const tail=lines.slice(-limit).flatMap(line=>isError?tui.wrapTextWithAnsi(line,Math.max(1,width-3)):[line]);
        const expand=getKeyHints().expand||sdk.keyText('app.tools.expand')||'expand tool output';
        return [...(lines.length>limit?[`   ${theme.fg('muted',`... ${lines.length-limit} earlier lines (${expand})`)}`]:[]),...tail.map(line=>`   ${theme.fg(isError?'error':'muted',line)}`)].map(line=>truncateToWidth(line,Math.max(1,width)));
      },()=>fallback('renderResult',result,theme,context,options));
    }};
}

export function registerReasonUI(pi,{cwd,getChildren=()=>[],offline=true,clock=systemClock}={}) {
  const states=new Map();let context,host,baseTheme,disabled=false,phase='idle';
  const activeTools=new Map();
  let startup,working,workingSince=0;
  let stopColorWatch=()=>{};
  let keyHints={};
  const restore=()=>{
    startup?.dispose();working?.dispose();
    stopColorWatch();
    if(!context||context.mode!=='tui')return;
    try{context.ui.setWidget?.('prototype-working',undefined);context.ui.setWorkingVisible?.(true);}catch{}
    for(const method of ['setTranscriptLayout','setUserMessageRenderer','setAssistantTextRenderer','setThinkingRenderer','setHeader','setFooter','setEditorComponent','setWorkingIndicator','setWorkingMessage','setHiddenThinkingLabel'])try{context.ui[method]?.(undefined);}catch{}
    try{if(baseTheme)context.ui.setTheme(baseTheme);}catch{}
  };
  const fail=error=>{
    if(disabled)return;
    disabled=true;restore();
    try{pi.appendEntry('prototype_ui_failure',{error:cleanText(error?.message??'render failed').slice(0,500)});}catch{}
    try{context?.ui.notify('Terminal renderer failed; restored Pi presentation.','warning');}catch{}
  };
  const component=render=>({invalidate(){},render(width){try{return render(width);}catch(error){fail(error);return [];}}});
  const refresh=ctx=>{
    if(ctx)context=ctx;
    if(context?.mode==='tui'&&!disabled){
      try{context.ui.setWorkingMessage(phase==='thinking'?'Thinking':phase==='writing'?'Writing':phase.startsWith('running ')?`Running ${phase.slice(8)}`:undefined);}catch(error){fail(error);}
    }
    working?.update();
    host?.requestRender();
  };
  pi.on('session_start',(_event,ctx)=>{
    context=ctx;if(ctx.mode!=='tui'||disabled)return;
    try {
      startup?.dispose();working?.dispose();stopColorWatch();phase='idle';states.clear();activeTools.clear();
      baseTheme??=ctx.ui.theme;
      let theme=createReasonTheme(baseTheme),surface=null;
      const life={active:true};let unsubscribeColors=()=>{};
      stopColorWatch=()=>{life.active=false;unsubscribeColors();};
      const result=ctx.ui.setTheme(theme);if(result?.success===false)throw Error('UI_THEME_REJECTED');
      ctx.ui.setHeader(t=>{
        host=t;
        const applyColors=colors=>{
          if(!life.active||disabled)return;
          const next=editorSurface(colors);
          if(!next||next.fill===surface?.fill&&next.appearance===surface.appearance)return;
          surface=next;
          try{
            theme=createReasonTheme(baseTheme,next.appearance);
            const changed=ctx.ui.setTheme(theme);if(changed?.success===false)throw Error('UI_THEME_REJECTED');
            t.requestRender();
          }catch(error){fail(error);}
        };
        const query=()=>{try{if(life.active&&typeof t.queryTerminalColors==='function')Promise.resolve(t.queryTerminalColors({timeoutMs:500,onLateReply:applyColors})).then(applyColors,()=>{});}catch{}};
        unsubscribeColors=t.onTerminalColorSchemeChange?.(query)??(()=>{});query();
        startup=new ReasonStartup({host:t,clock,onFailure:fail,
          fresh:!ctx.sessionManager?.getBranch?.().some(entry=>entry.type==='message'),
          details:()=>[theme.fg('muted',`Pi ${runtimeLabel}`)+separator+theme.fg('accent',oneLine(`${context.model?.provider??'provider unknown'}/${context.model?.id??'model unknown'}`)),theme.fg('muted',oneLine(context.cwd??cwd))]});
        const header=startup;
        return {render:width=>header.render(width),invalidate:()=>header.invalidate(),dispose:()=>{header.dispose();life.active=false;unsubscribeColors();}};
      });
      ctx.ui.setUserMessageRenderer?.((text,width,currentTheme)=>renderUserMessage(text,width,currentTheme,surface));
      ctx.ui.setTranscriptLayout?.('content');
      ctx.ui.setAssistantTextRenderer?.((text,width,currentTheme,_streaming,padding)=>renderAssistantText(text,width,currentTheme,{padding}));
      ctx.ui.setThinkingRenderer?.((text,width,currentTheme,options)=>renderThinking(text,width,currentTheme,options));
      ctx.ui.setEditorComponent((t,editorTheme,keys)=>{keyHints={expand:keys.getKeys('app.tools.expand').join('/'),cancel:keys.getKeys('app.interrupt').join('/')};return new ReasonEditor(t,editorTheme,keys,{onFailure:fail,markerColor:text=>theme.fg('accent',text),getSurface:()=>surface});});
      ctx.ui.setFooter((t,_theme,data)=>{host=t;const unsubscribe=data.onBranchChange(()=>t.requestRender());return {...component(width=>renderFooter({model:context.model?.id,provider:context.model?.provider,phase:offline?'offline':phase,contextPercent:context.getContextUsage()?.percent,children:getChildren(),statuses:[...data.getExtensionStatuses().values()],cwd,keyHints},theme,width)),dispose:unsubscribe};});
      if(ctx.ui.setWidget&&ctx.ui.setWorkingVisible){
        ctx.ui.setWorkingVisible(false);
        ctx.ui.setWidget('prototype-working',t=>{
          working=new ReasonWorking({host:t,clock,onFailure:fail,getState:()=>({
            label:phase==='thinking'?'Thinking':phase==='writing'?'Writing':phase.startsWith('running ')?`Running ${phase.slice(8)}`:'',
            detail:`${Math.max(0,Math.round((clock.now()-workingSince)/1000))}s${separator}${keyHints.cancel||sdk.keyText('app.interrupt')} to cancel`,appearance:theme.appearance})});
          return working;
        },{placement:'aboveEditor'});
      }
      ctx.ui.setHiddenThinkingLabel('Thinking');
      ctx.ui.setWorkingIndicator({frames:[theme.fg('warning',dot)]});
    } catch(error) { fail(error); }
  });
  pi.on('agent_start',(_event,ctx)=>{startup?.stop();workingSince=clock.now();phase='thinking';refresh(ctx);});
  pi.on('agent_end',(_event,ctx)=>{activeTools.clear();if(!['cancelled','error'].includes(phase))phase='idle';refresh(ctx);});
  pi.on('message_update',(event,ctx)=>{if(activeTools.size)return;const type=event.assistantMessageEvent?.type;if(type==='text_delta')phase='writing';else if(type==='thinking_delta')phase='thinking';refresh(ctx);});
  pi.on('message_end',(event,ctx)=>{if(event.message?.role!=='assistant')return;if(event.message.stopReason==='aborted')phase='cancelled';else if(event.message.stopReason==='error')phase='error';refresh(ctx);});
  pi.on('model_select',(_event,ctx)=>refresh(ctx));
  pi.on('session_compact',(_event,ctx)=>{phase='idle';refresh(ctx);});
  pi.on('session_compact_failed',(_event,ctx)=>{phase='compaction failed';refresh(ctx);});
  pi.on('tool_execution_start',(event,ctx)=>{states.set(event.toolCallId,'running');activeTools.set(event.toolCallId,event.toolName);phase=`running ${event.toolName}`;refresh(ctx);});
  pi.on('tool_execution_end',(event,ctx)=>{states.set(event.toolCallId,event.isError?'failed':'done');activeTools.delete(event.toolCallId);if(states.size>512)states.delete(states.keys().next().value);if(!['cancelled','error'].includes(phase))phase=activeTools.size?`running ${activeTools.values().next().value}`:'thinking';refresh(ctx);});
  pi.on('session_shutdown',()=>{startup?.dispose();working?.dispose();stopColorWatch();host=undefined;});
  const facade=new Proxy(pi,{get(target,key){
    if(key==='registerTool')return definition=>target.registerTool(wrapToolPresentation(definition,{states,failed:()=>disabled,onFailure:fail,getKeyHints:()=>keyHints}));
    const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
  }});
  for(const definition of [sdk.createReadToolDefinition(cwd),sdk.createEditToolDefinition(cwd),sdk.createWriteToolDefinition(cwd)])facade.registerTool(definition);
  return {pi:facade,states,restore,failed:()=>disabled};
}
