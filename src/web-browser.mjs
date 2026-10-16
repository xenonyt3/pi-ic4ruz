import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {buildChildEnv} from '../launch.mjs';
import {spawnOwnedProcess,terminateTreeAndConfirm} from './process-lifecycle.mjs';
import {canonicalizeAllowedPath} from './tool-policy.ts';
import {PageConsoleCapture} from '../vendor/oh-my-pi/console-capture.mjs';
import {captureAriaSnapshot,parseAriaRefSelector,resolveAriaRefHandle} from '../vendor/oh-my-pi/aria-snapshot.mjs';

export function findBrowser(executable='auto') {
  const paths=executable==='auto'?[
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/chromium','/usr/bin/google-chrome','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ]:[executable];
  const found=paths.find(file=>path.isAbsolute(file)&&fs.existsSync(file));
  if(!found)throw new Error('WEB_BROWSER_NOT_INSTALLED: configure browserExecutable in config/web-tools.json');
  return found;
}

export class WebBrowser {
  constructor({config,network,workspace,directory}) {
    Object.assign(this,{config,network,workspace,directory});
    this.queue=Promise.resolve();this.pages=new Map();this.nextTab=1;this.current=null;
  }
  async start(signal) {
    signal.throwIfAborted();
    if(this.browser)return;
    if(this.cleanupFailed)throw new Error('WEB_BROWSER_CLEANUP_UNCONFIRMED');
    const {puppeteer,PipeTransport}=await import('../tools/web/browser.mjs');
    signal.throwIfAborted();
    const profile=path.join(this.directory,'browser-profiles',randomUUID());fs.mkdirSync(profile,{recursive:true});
    const args=['--remote-debugging-pipe',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--disable-default-apps','--disable-popup-blocking','--window-size=1280,800','about:blank'];
    if(this.config.browserHeadless)args.unshift('--headless=new');
    const env=buildChildEnv();env.TEMP=profile;env.TMP=profile;
    this.child=spawnOwnedProcess(findBrowser(this.config.browserExecutable),args,{env,cwd:this.workspace,stdio:['ignore','ignore','ignore','pipe','pipe'],detached:process.platform!=='win32'});
    const child=this.child;let spawnError;
    child.once('error',error=>{spawnError=error;});
    this.transport=new PipeTransport(child.stdio[3],child.stdio[4]);
    this.browser=await puppeteer.connect({transport:this.transport,defaultViewport:{width:1280,height:800},protocolTimeout:this.config.timeoutMs});
    if(spawnError)throw new Error('WEB_BROWSER_START_FAILED');
    signal.throwIfAborted();
    const context=await this.browser.createBrowserContext();this.context=context;
    const cdp=await this.browser.target().createCDPSession();
    await cdp.send('Browser.setDownloadBehavior',{behavior:'deny',browserContextId:context.id});
    await cdp.detach();
  }
  async newPage(signal) {
    if(this.pages.size>=5)throw new Error('WEB_BROWSER_TAB_LIMIT');
    const page=await this.context.newPage();
    page.setDefaultTimeout(this.config.timeoutMs);page.setDefaultNavigationTimeout(this.config.timeoutMs);
    await page.setBypassServiceWorker(true);
    await page.setRequestInterception(true);
    page.on('request',request=>{
      void (async()=>{
        if(request.isInterceptResolutionHandled())return;
        try {
          const url=request.url();
          if(url!=='about:blank'&&!/^(?:data|blob):/.test(url))await this.network.validate(url);
          if(!request.isInterceptResolutionHandled())await request.continue();
        }catch{if(!request.isInterceptResolutionHandled())await request.abort('blockedbyclient').catch(()=>{});}
      })();
    });
    page.on('dialog',dialog=>void dialog.dismiss().catch(()=>{}));
    page.on('popup',popup=>void popup?.close().catch(()=>{}));
    const capture=new PageConsoleCapture(200);await capture.install(page);
    const tab=String(this.nextTab++);this.pages.set(tab,{page,capture});this.current=tab;
    signal.throwIfAborted();return {tab,page,capture};
  }
  async target(selector,page) {
    const ref=parseAriaRefSelector(selector);
    const handle=ref?await resolveAriaRefHandle(page,ref):await page.$(selector);
    if(!handle)throw new Error('WEB_BROWSER_ELEMENT_NOT_FOUND: take a fresh snapshot');
    return handle;
  }
  run(args,signal) {
    const pending=this.queue.then(()=>this.execute(args,signal));
    this.queue=pending.catch(()=>{});return pending;
  }
  async execute(args,signal) {
    signal.throwIfAborted();
    let rejectAbort;
    const aborted=new Promise((_,reject)=>{rejectAbort=()=>reject(new Error('WEB_BROWSER_CANCELLED'));signal.addEventListener('abort',rejectAbort,{once:true});});
    try {
      return await Promise.race([this.action(args,signal),aborted]);
    }catch(error){
      await this.stop();
      if(signal.aborted)throw new Error('WEB_BROWSER_CANCELLED');
      throw error;
    }finally{signal.removeEventListener('abort',rejectAbort);}
  }
  async action(args,signal) {
    if(args.action==='close'){await this.stop();return {cleanupConfirmed:true};}
    await this.start(signal);
    if(args.action==='search_html') {
      const url=await this.network.validate(args.url);signal.throwIfAborted();
      const previous=this.current,{tab,page,capture}=await this.newPage(signal);
      try {
        const response=await page.goto(url.href,{waitUntil:'domcontentloaded'});
        if(response&&!response.ok())throw new Error(`WEB_HTTP_${response.status()}`);
        await page.waitForSelector('a h3',{timeout:Math.min(10000,this.config.timeoutMs),signal}).catch(()=>{});
        signal.throwIfAborted();const text=await page.content();
        if(Buffer.byteLength(text)>this.config.maxResponseBytes)throw new Error('WEB_RESPONSE_TOO_LARGE');
        return {url:page.url(),text};
      }finally{await capture.detach();await page.close().catch(()=>{});this.pages.delete(tab);this.current=previous;}
    }
    if(args.action==='tabs')return {tabs:[...this.pages].map(([tab,{page}])=>({tab,url:page.url()}))};
    let tab=args.tab??this.current,entry=this.pages.get(tab);
    if(args.action==='open'){
      const url=await this.network.validate(args.url);
      if(!entry||args.newTab){entry=await this.newPage(signal);tab=entry.tab;}
      await entry.page.goto(url.href,{waitUntil:'domcontentloaded'});
      signal.throwIfAborted();
      return {tab,url:entry.page.url(),snapshot:await captureAriaSnapshot(entry.page,null,{interactive:false,urls:true})};
    }
    if(!entry)throw new Error('WEB_BROWSER_TAB_REQUIRED: open a URL first');
    const {page,capture}=entry;this.current=tab;
    if(args.action==='snapshot')return {tab,url:page.url(),snapshot:await captureAriaSnapshot(page,null,{interactive:args.interactive??false,urls:true})};
    if(args.action==='extract') {
      const {extractReadableFromHtml}=await import('../vendor/oh-my-pi/readable.mjs');
      return {tab,...await extractReadableFromHtml(await page.content(),page.url(),'markdown',{selector:args.selector})};
    }
    if(args.action==='console')return {tab,console:await capture.console({limit:50}),errors:await capture.errors({limit:50})};
    if(args.action==='evaluate')return {tab,result:await page.evaluate(args.script)};
    if(args.action==='resize') {await page.setViewport({width:args.width,height:args.height});return {tab,width:args.width,height:args.height};}
    if(args.action==='wait') {await page.waitForSelector(args.selector,{visible:true,signal});return {tab,found:true};}
    if(args.action==='screenshot') {
      const relative=args.path??`.pi-web/screenshots/${randomUUID()}.png`;
      const file=canonicalizeAllowedPath(relative,this.workspace);
      if(!file.toLowerCase().endsWith('.png'))throw new Error('WEB_SCREENSHOT_PNG_REQUIRED');
      fs.mkdirSync(path.dirname(file),{recursive:true});
      canonicalizeAllowedPath(file,this.workspace);
      const data=await page.screenshot({type:'png',fullPage:args.fullPage??false});
      signal.throwIfAborted();fs.writeFileSync(file,data,{flag:'wx'});
      return {tab,path:path.relative(this.workspace,file),bytes:data.length,vision:'saved PNG; provider vision is not enabled by this tool'};
    }
    if(args.action==='close_tab') {await capture.detach();await page.close();this.pages.delete(tab);this.current=this.pages.keys().next().value??null;return {tab,closed:true};}
    if(['click','fill','press','select'].includes(args.action)){
      const handle=await this.target(args.selector,page);
      try {
        if(args.action==='click')await handle.click();
        if(args.action==='fill'){
          await handle.focus();
          await handle.evaluate(element=>{
            if(element instanceof HTMLInputElement||element instanceof HTMLTextAreaElement){element.value='';element.dispatchEvent(new Event('input',{bubbles:true}));}
            else if(element.isContentEditable)element.textContent='';else throw new Error('WEB_BROWSER_NOT_EDITABLE');
          });
          await handle.type(args.text);
        }
        if(args.action==='press')await handle.press(args.key);
        if(args.action==='select')await handle.select(...args.values);
      }finally{await handle.dispose().catch(()=>{});}
      return {tab,action:args.action,completed:true};
    }
    throw new Error('WEB_BROWSER_ACTION_UNKNOWN');
  }
  async stop() {
    if(this.stopping)return this.stopping;
    this.stopping=(async()=>{
      const child=this.child;
      if(!child){if(this.cleanupFailed)throw new Error('WEB_BROWSER_CLEANUP_UNCONFIRMED');return;}
      const closed=new Promise(resolve=>child.once('close',()=>resolve(true)));
      const receipt=child.pid?await terminateTreeAndConfirm(child):{status:'confirmed'};
      this.cleanupFailed=receipt.status!=='confirmed';
      await this.browser?.disconnect().catch(()=>{});this.transport?.close();
      // CDP pipes must close too before the existing process supervisor releases ownership.
      for(const stream of child.stdio)stream?.destroy();
      let timer;
      const stdioClosed=await Promise.race([closed,new Promise(resolve=>{timer=setTimeout(()=>resolve(false),5000);})]);
      clearTimeout(timer);this.cleanupFailed ||= !stdioClosed;
      this.browser=undefined;this.context=undefined;this.child=undefined;this.pages.clear();this.current=null;
      fs.mkdirSync(this.directory,{recursive:true});
      fs.writeFileSync(path.join(this.directory,'browser-cleanup.json'),JSON.stringify({cleanupConfirmed:!this.cleanupFailed,pid:child.pid??null,at:new Date().toISOString()}));
      if(this.cleanupFailed)throw new Error('WEB_BROWSER_CLEANUP_UNCONFIRMED');
    })();
    try{await this.stopping;}finally{this.stopping=undefined;}
  }
  async close(){await this.queue;await this.stop();}
}
