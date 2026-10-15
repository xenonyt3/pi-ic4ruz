import {tui} from './ui-runtime.mjs';

const {truncateToWidth,visibleWidth,stripTerminalSequences}=tui;
const safe=value=>stripTerminalSequences(String(value??'')).replace(/[\x00-\x1f\x7f]/g,' ').trim();
export const motion={sweepMs:1400,pauseMs:500,workingMs:80,startupMs:2400,startupTickMs:33};
export const systemClock={now:()=>Date.now(),setInterval:(fn,ms)=>setInterval(fn,ms),clearInterval:id=>clearInterval(id)};

export function shimmer(text,progress,{appearance='dark',noColor=process.env.NO_COLOR!==undefined}={}) {
  const chars=[...text],center=progress*(chars.length+8)-4;
  const [base,peak]=appearance==='light'?[243,232]:[245,255];
  return chars.map((char,index)=>{
    const intensity=Math.max(0,1-Math.abs(index-center)/4);
    if(noColor)return intensity>0.5?`\x1b[1m${char}\x1b[22m`:char;
    return `\x1b[38;5;${Math.round(base+(peak-base)*intensity)}m${char}`;
  }).join('')+(noColor?'':'\x1b[39m');
}

export function renderWorking({label='',detail='',tip='',now=Date.now(),appearance='dark',noColor=process.env.NO_COLOR!==undefined},width) {
  if(!label&&!tip)return [];
  const muted=text=>noColor?text:`\x1b[38;5;${appearance==='light'?243:245}m${text}\x1b[39m`;
  const progress=Math.min(1,(now%(motion.sweepMs+motion.pauseMs))/motion.sweepMs);
  const suffix=detail?` ${muted(`(${safe(detail)})`)}`:'';
  const line=label?truncateToWidth(` ${muted('\u2022')} ${shimmer(safe(label),progress,{appearance,noColor})}${suffix}`,width):'';
  const available=width-visibleWidth(line)-3;
  const hint=safe(tip);
  return [!hint||available<visibleWidth(hint)?line:`${line}${' '.repeat(available-visibleWidth(hint)+2)}${hint} `];
}

// The source's braille sampling and rotation, with an owned Pi silhouette, not Reason's bitmap.
export function rasterBraille(bitmap,rows,columns,turn=0) {
  const bits=[[1,8],[2,16],[4,32],[64,128]],samples=[0.25,0.75];
  const cx=bitmap.width/2,cy=bitmap.height/2,cos=Math.cos(turn*2*Math.PI),sin=Math.sin(turn*2*Math.PI);
  const pixel=(x,y)=>{x=Math.floor(x);y=Math.floor(y);return x<0||y<0||x>=bitmap.width||y>=bitmap.height?0:(bitmap.bits[(y*bitmap.width+x)>>3]>>(7-((y*bitmap.width+x)&7)))&1;};
  return Array.from({length:rows},(_,y)=>Array.from({length:columns},(_,x)=>{
    let value=0;
    for(let r=0;r<4;r++)for(let c=0;c<2;c++){
      let coverage=0;
      for(const sy of samples)for(const sx of samples){
        const px=(x*2+c+sx)*bitmap.width/(columns*2)-cx,py=(y*4+r+sy)*bitmap.height/(rows*4)-cy;
        coverage+=pixel(px*cos+py*sin+cx,-px*sin+py*cos+cy);
      }
      if(coverage>=2)value|=bits[r][c];
    }
    return String.fromCharCode(0x2800+value);
  }).join(''));
}
function bitmap(width,height,pixel) {
  const bits=new Uint8Array(Math.ceil(width*height/8));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(pixel(x,y)){
    const index=y*width+x;bits[index>>3]|=1<<(7-(index&7));
  }
  return {width,height,bits};
}
export const piBitmap=bitmap(128,128,(x,y)=>
  x>=18&&x<110&&y>=28&&y<44 || y>=44&&y<101&&(x>=36&&x<50||x>=79&&x<93));
const letters=['1111000111','1000100010','1000100010','1111000010','1000000010','1000000010','1000000111'];
const wordBitmap=bitmap(80,56,(x,y)=>letters[Math.floor(y/8)][Math.floor(x/8)]==='1');
export const piMark=(rows,turn=0)=>rasterBraille(piBitmap,rows,rows*2,turn);
export const piName=rows=>rasterBraille(wordBitmap,rows,Math.round(rows*2*wordBitmap.width/wordBitmap.height));

export class ReasonStartup {
  constructor({details,host,clock=systemClock,fresh=false,onFailure=()=>{}}) {
    Object.assign(this,{details,host,clock,onFailure});this.turn=0;this.timer=null;this.disposed=false;this.drawn=null;
    if(fresh&&this.large(host.terminal.columns)){
      const start=clock.now();
      this.timer=clock.setInterval(()=>{
        if(this.disposed||this.timer===null)return;
        const progress=Math.min(1,(clock.now()-start)/motion.startupMs);
        this.turn=progress<1?0.08*Math.cos(progress*2.5*Math.PI)*Math.exp(-progress*3):0;
        if(progress>=1)this.stop();
        host.requestRender();
      },motion.startupTickMs);
      this.timer?.unref?.();
    }
  }
  large(width) { return width>=44&&this.host.terminal.rows-16>=7; }
  stop() { if(this.timer!==null)this.clock.clearInterval(this.timer);this.timer=null;this.turn=0; }
  dispose() { this.disposed=true;this.stop(); }
  invalidate() { this.drawn=null; }
  render(width) {
    try {
      const details=this.details();
      if(!this.large(width)){
        const mark=piMark(6),markWidth=visibleWidth(mark[0]);
        const name=[4,3].map(piName).find(lines=>markWidth+3+visibleWidth(lines[0])+2<=width);
        if(!name)return ['Pi',...details].map(line=>truncateToWidth(` ${line}`,width));
        const right=[...name,...details];
        return Array.from({length:Math.max(mark.length,right.length)},(_,index)=>truncateToWidth(` ${mark[index]??' '.repeat(markWidth)}   ${right[index]??''}`,width,'\u2026'));
      }
      const rows=Math.min(16,this.host.terminal.rows-16);
      if(this.drawn?.rows!==rows||this.drawn.turn!==this.turn)this.drawn={rows,turn:this.turn,lines:piMark(rows,this.turn)};
      return ['',...this.drawn.lines,'',...piName(4),'',...details].map(line=>{
        const clipped=truncateToWidth(line,width);
        return ' '.repeat(Math.max(0,Math.floor((width-visibleWidth(clipped))/2)))+clipped;
      });
    }catch(error){this.dispose();this.onFailure(error);return [];}
  }
}

export class ReasonWorking {
  constructor({host,getState,clock=systemClock,onFailure=()=>{}}) {
    Object.assign(this,{host,getState,clock,onFailure});this.timer=null;this.disposed=false;this.drawn=null;
  }
  update() {
    if(this.disposed)return;
    if(this.getState().label){
      if(this.timer===null){this.timer=this.clock.setInterval(()=>{
        if(this.disposed||this.timer===null||!this.drawn)return;
        try{
          const lines=this.lines(this.drawn.width);
          if(lines.join('\n')!==this.drawn.lines.join('\n'))this.host.requestRender();
        }catch(error){this.dispose();this.onFailure(error);}
      },motion.workingMs);this.timer?.unref?.();}
    }else this.stop();
    this.host.requestRender();
  }
  lines(width) { return renderWorking({...this.getState(),now:this.clock.now()},width); }
  render(width) {
    if(this.disposed)return [];
    try{const lines=this.lines(width);this.drawn={width,lines};return lines;}
    catch(error){this.dispose();this.onFailure(error);return [];}
  }
  invalidate() { this.drawn=null; }
  stop() { if(this.timer!==null)this.clock.clearInterval(this.timer);this.timer=null; }
  dispose() { this.disposed=true;this.stop(); }
}
