import assert from 'node:assert/strict';
import {createServer as createViteServer}from'vite';
import {createServer}from'node:http';
import {readFile}from'node:fs/promises';
import{resolve,extname}from'node:path';
const{chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const vite=await createViteServer({configFile:'scripts/qa/vite.flight-school.config.ts'});await vite.listen();
const mime={'.js':'application/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.jpg':'image/jpeg','.wav':'audio/wav','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{try{const path=decodeURIComponent(req.url.split('?')[0]).replace(/^\/alien-force-classic\/?/,'');const file=resolve('dist-pages',path&&!extname(path)?'index.html':path||'index.html');if(!file.startsWith(resolve('dist-pages')+'/'))throw Error();const bytes=await readFile(file);res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(bytes);}catch{res.statusCode=404;res.end();}});await new Promise(done=>server.listen(8789,'127.0.0.1',done));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-zygote']});
const base='http://127.0.0.1:8789/alien-force-classic/';const errors=[];
async function offline(context){await context.route('**/*.supabase.co/**',route=>route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({code:'PGRST202',message:'Offline test'})}));}
async function hold(page,keys,time){for(const key of keys)await page.keyboard.down(key);await page.clock.runFor(time);for(const key of keys)await page.keyboard.up(key);}
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});await offline(context);
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base);await page.getByRole('button',{name:'START',exact:true}).click();await page.getByRole('heading',{name:'FLIGHT SCHOOL',exact:true}).waitFor();
 await page.screenshot({path:'../flight-school-desktop.png',fullPage:true});await page.clock.install();
 await page.getByRole('button',{name:'Begin training',exact:true}).click();
 const lessons=[['flight',['KeyW','KeyD'],2200],['shot',['Space'],1200],['lanes',['KeyA'],500],['reverse',['KeyR'],100],['shield',['KeyD'],1800],['freeze',['Space'],1200],['rapid',['Space'],200],['speed',['KeyD'],800],['teleport',['KeyD','ShiftLeft'],200]];
 for(const[id,keys,time]of lessons){
  await page.locator(`.flight-school[data-lesson="${id}"]`).waitFor();await page.getByRole('button',{name:'Begin lesson',exact:true}).click();
  await hold(page,keys,time);if(id==='lanes')await hold(page,['KeyW'],700);
  await page.locator('.flight-school[data-complete="true"]').waitFor();
  await page.getByRole('button',{name:'Next lesson',exact:true}).click();
 }
 await page.getByRole('button',{name:'Complete training',exact:true}).click();await page.getByRole('button',{name:/Choose game, current game/}).waitFor();
 assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('alien-force-flight-school-v1')).completed.guest));
 await page.reload();await page.getByRole('button',{name:'START',exact:true}).click();await page.getByRole('button',{name:/Choose game, current game/}).waitFor();assert.equal(await page.getByRole('heading',{name:'FLIGHT SCHOOL',exact:true}).count(),0);
 await page.getByRole('button',{name:/Choose game, current game/}).click();await page.locator('.hangar-selector[open] button').filter({has:page.locator('strong',{hasText:/^Practice$/})}).click();
 await page.getByRole('button',{name:'Ready up',exact:true}).click();await page.getByRole('button',{name:'Start match',exact:true}).click();await page.getByRole('button',{name:/Train with AX-7/}).click();await page.getByRole('heading',{name:'FLIGHT SCHOOL',exact:true}).waitFor();
 console.log('First visit, all nine real-input lessons, completion persistence, revisit and Practice replay passed.');
 const existing=await browser.newContext({reducedMotion:'reduce'});await offline(existing);await existing.addInitScript(()=>localStorage.setItem('alien-force-match-history-v1',JSON.stringify([{id:'existing-run',owner:null,mode:'practice',durationMs:1000,recordedAt:new Date().toISOString(),outcome:'win',source:'device'}])));
 const returning=await existing.newPage();await returning.goto(base);await returning.getByRole('button',{name:'START',exact:true}).click();await returning.getByRole('button',{name:/Choose game, current game/}).waitFor();assert.equal(await returning.locator('.flight-school').count(),0);await existing.close();
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});await offline(mobile);const phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(e.message));
 await phone.goto(base);await phone.getByRole('button',{name:'START',exact:true}).click();await phone.getByRole('heading',{name:'FLIGHT SCHOOL',exact:true}).waitFor();await phone.screenshot({path:'../flight-school-phone.png',fullPage:true});assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await phone.getByRole('button',{name:'Begin training'}).click();await phone.getByRole('button',{name:'Begin lesson'}).click();const joystick=phone.getByRole('group',{name:'Movement joystick'});await joystick.scrollIntoViewIfNeeded();const box=await joystick.boundingBox();const cdp=await mobile.newCDPSession(phone);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+5,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
 await mobile.close();
 const campaign=await context.newPage();campaign.on('pageerror',e=>errors.push(e.message));await campaign.goto(`http://127.0.0.1:${vite.config.server.port}/scripts/qa/campaign-gates.html`);await campaign.clock.install();
 await campaign.getByRole('button',{name:'Skip narration'}).click();await campaign.getByRole('button',{name:'Skip narration'}).click();await campaign.getByRole('button',{name:'Start Protecting'}).click();
 await campaign.getByRole('dialog',{name:'Entering the mission gate'}).waitFor();await campaign.clock.runFor(2500);assert.equal(await campaign.evaluate(()=>window.__campaign.current.phase),'waiting');
 const state=await campaign.evaluate(()=>({player:window.__campaign.current.player,enemies:window.__campaign.current.enemies,elapsed:window.__campaign.current.elapsed}));await campaign.clock.runFor(3000);assert.deepEqual(await campaign.evaluate(()=>window.__campaign.current.enemies),state.enemies);assert.equal(state.player.x,412);assert.equal(state.player.y,412);assert.equal(state.elapsed,0);
 await hold(campaign,['ArrowLeft'],100);assert.equal(await campaign.evaluate(()=>window.__campaign.current.phase),'playing');
 await campaign.evaluate(()=>{window.__campaign.current.enemies=[];});await campaign.clock.runFor(300);assert.equal(await campaign.evaluate(()=>window.__campaign.current.phase),'level_clear');await campaign.screenshot({path:'../adventure-fireworks.png'});
 await campaign.evaluate(()=>Object.assign(window.__campaign.current.player,{x:212,y:12,direction:'up'}));await campaign.clock.runFor(150);await campaign.getByRole('dialog',{name:'Flying to the next level'}).waitFor();await campaign.clock.runFor(3900);await campaign.getByRole('dialog',{name:'Adventure star route'}).waitFor();await campaign.screenshot({path:'../adventure-star-route-desktop.png'});
 await campaign.setViewportSize({width:390,height:844});await campaign.screenshot({path:'../adventure-star-route-phone.png',fullPage:true});assert.ok(await campaign.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await campaign.getByRole('button',{name:'Sector →',exact:true}).click();assert.equal(await campaign.getByRole('button',{name:'Enter level 2 ↗',exact:true}).count(),1);await campaign.getByRole('button',{name:'Enter level 2 ↗',exact:true}).click();await campaign.getByRole('dialog',{name:'Entering the mission gate'}).waitFor();await campaign.clock.runFor(2500);assert.equal(await campaign.evaluate(()=>window.__campaign.current.phase),'waiting');assert.deepEqual(await campaign.evaluate(()=>window.__campaign.current.player),{id:0,x:412,y:412,direction:'left'});
 await campaign.evaluate(()=>{const s=window.__campaign.current;s.level=20;s.scene=undefined;s.phase='playing';s.enemies=[];});await campaign.clock.runFor(100);await campaign.evaluate(()=>Object.assign(window.__campaign.current.player,{x:212,y:12}));await campaign.clock.runFor(4000);await campaign.getByRole('dialog',{name:'Adventure story cinematic'}).waitFor();await campaign.getByRole('button',{name:'Skip narration'}).click();await campaign.getByRole('button',{name:'Continue Mission'}).click();await campaign.getByRole('dialog',{name:'Adventure star route'}).waitFor();assert.equal(await campaign.evaluate(()=>window.__campaign.current.level),21);
 assert.deepEqual(errors,[]);console.log('Existing-player bypass, phone joystick/layout, fireworks, travel/map/arrival, locked progression, fresh movement and boss transfer passed.');
}finally{await browser.close();await vite.close();await new Promise(done=>server.close(done));}
