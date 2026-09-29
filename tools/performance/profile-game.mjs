/** Repeatable development-only browser measurements; no changes to game state persist. */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
const { chromium } = await import(process.env.PERF_PLAYWRIGHT_MODULE || 'playwright');
const output = process.env.PERF_OUTPUT || 'outputs/performance/browser.json';
const url = process.env.PERF_URL || 'http://127.0.0.1:5188/?playtest=1';
const duration = Number(process.env.PERF_SAMPLE_MS || 8000);
const browser = await chromium.launch({headless: true, executablePath: process.env.PERF_BROWSER_EXECUTABLE || undefined});
try {
  const page = await browser.newPage({viewport: {width:1600,height:1000}, deviceScaleFactor: 2});
  await page.addInitScript(()=>performance.setResourceTimingBufferSize(10000));
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  page.on('console', m=>{if(m.type()==='error')errors.push(m.text());});
  const started=Date.now();
  await page.goto(url, {waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Seed run',exact:true}).click({timeout:120000});
  const readyMs=Date.now()-started;
  const inventory = await page.evaluate(()=>{
    const r=window.__lastJackpot.renderer,s=r.scene,e=r.engine;
    return {userAgent:navigator.userAgent,gpu:e.getGlInfo(),width:e.getRenderWidth(),height:e.getRenderHeight(),pixelRatio:devicePixelRatio,
      meshCount:s.meshes.length,transformCount:s.transformNodes.length,geometryCount:s.geometries.length,
      vertices:s.getTotalVertices(),materialCount:s.materials.length,textureCount:s.textures.length,lights:s.lights.length,
      shadowMaps:s.lights.filter(l=>l.getShadowGenerator()).map(l=>({name:l.name,casters:l.getShadowGenerator().getShadowMap().renderList.length})),
      assetTransferBytes:performance.getEntriesByType('resource').filter(r=>/\.(glb|png|jpg|webp|wav)(\?|$)/.test(r.name)).reduce((n,r)=>n+r.transferSize,0)};
  });
  console.log('READY',JSON.stringify({readyMs,...inventory}));
  await page.evaluate(()=>{
   const r=window.__lastJackpot,renderer=r.renderer;
   window.__perf={interval:[],render:[],step:[],draws:[],active:[],raf:[],longTasks:[],last:0,rafLast:0,collect:false};
   const wrap=(owner,key,bucket)=>{const original=owner[key];owner[key]=function(...args){const start=performance.now();const result=original.apply(this,args);if(window.__perf.collect)window.__perf[bucket].push(performance.now()-start);return result;};};
   wrap(renderer.scene,'render','render');
   const original=renderer.update;
   renderer.update=function(...args){const p=window.__perf,now=performance.now(),drawsBefore=renderer.engine._drawCalls.current;if(p.collect&&p.last)p.interval.push(now-p.last);p.last=now;const result=original.apply(this,args);if(p.collect){p.draws.push(renderer.engine._drawCalls.current-drawsBefore);p.active.push(renderer.scene.getActiveMeshes().length);}return result;};
   // A seed run replaces the simulation; wrap its prototype so every run is measured.
   wrap(Object.getPrototypeOf(r.sim),'step','step');
   const raf=t=>{const p=window.__perf;if(p.collect&&p.rafLast)p.raf.push(t-p.rafLast);p.rafLast=t;requestAnimationFrame(raf);};requestAnimationFrame(raf);
   new PerformanceObserver(list=>{if(window.__perf.collect)window.__perf.longTasks.push(...list.getEntries().map(e=>e.duration));}).observe({type:'longtask',buffered:false});
  });
  const scenarios=[['casino','casinoWide'],['hotel','hotel-lobby'],['supply','serviceOverview'],['casino-crowd','crowd']];
  const samples=[];
  for(const [name,action] of scenarios){
   await page.evaluate(action=>{const r=window.__lastJackpot;r.testAction('new');r.testAction(action==='crowd'?'floor':action);if(action==='crowd')r.testAction('crowd');},action);
   await page.waitForTimeout(2500);
   await page.evaluate(()=>{const p=window.__perf;for(const key of ['interval','render','step','draws','active','raf','longTasks'])p[key]=[];p.last=p.rafLast=0;p.collect=true;});
   await page.waitForTimeout(duration);
   const stats=await page.evaluate(()=>{
    const p=window.__perf;p.collect=false;
    const summary=a=>{a=[...a].sort((a,b)=>a-b);return{n:a.length,mean:a.reduce((a,b)=>a+b,0)/a.length,p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],p99:a[Math.floor(a.length*.99)],max:a.at(-1)}};
    return Object.fromEntries(['interval','render','step','draws','active','raf','longTasks'].map(k=>[k,summary(p[k])]));
   });
   samples.push({name,...stats});console.log('SCENARIO',JSON.stringify(samples.at(-1)));
  }
  const doors=await page.evaluate(()=>{
   const r=window.__lastJackpot;r.testAction('new');const s=r.sim;
   return ['lounge','vip','cashier','hotel','supply'].map(id=>{const starts=performance.now();if(id==='hotel')s.hotel=true;else s.doorsOpen[id]=true;s.refreshMap();return{id,ms:performance.now()-starts};});
  });
  await mkdir(dirname(output),{recursive:true});
  await writeFile(output,JSON.stringify({date:new Date().toISOString(),url,readyMs,inventory,samples,doors,errors},null,2)+'\n');
  console.log('DOORS',JSON.stringify(doors));console.log('SAVED',output,'ERRORS',JSON.stringify(errors));
  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  await browser.close();
}
