// Mobile (iPhone 13) test: study a deck, finish, tap 'Have Clutch quiz me', make sure the chat box is still tappable. Run: node dev/mobile.js
const { chromium, devices } = require('playwright');
(async()=>{const b=await chromium.launch();
const ctx=await b.newContext({...devices['iPhone 13']}); const p=await ctx.newPage(); p.setDefaultTimeout(5000);
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8787/m');await p.waitForTimeout(800);
await p.click('.lhero [data-land=skip]');await p.waitForTimeout(800);
await p.evaluate(()=>{ const S=JSON.parse(localStorage.getItem('clutch.planner.v1')); S.decks=[{id:'k1',topic:'Luther Leads the Reformation',course:'HIST 101',cards:Array.from({length:8},(_,i)=>({q:'Question number '+(i+1)+' about Luther and the reformation?',a:'Answer '+(i+1)+' with some words in it.',miss:0,hit:0})),src:'photo',at:Date.now(),last:null}]; localStorage.setItem('clutch.planner.v1',JSON.stringify(S)); });
await p.reload(); await p.waitForTimeout(800); if (await p.$('#land:not([hidden])')) { await p.click('.lhero [data-land=skip]'); await p.waitForTimeout(500); }
await p.click('nav.tabs [data-tab=focus]'); await p.waitForTimeout(300);
await p.click('#decks [data-dk=study]'); await p.waitForTimeout(400);
for (let i=0;i<8;i++){ await p.click('#fdBody .fc'); await p.waitForTimeout(60); await p.click(i%3? '#fd [data-fd=hit]':'#fd [data-fd=miss]'); await p.waitForTimeout(60); }
console.log('results text:', (await p.$eval('#fdBody',e=>e.innerText)).slice(0,140).replace(/\n/g,' | '));
await p.click('#fd [data-fd=quiz]'); await p.waitForTimeout(1800);
const info = await p.evaluate(()=>{ const box=document.getElementById('box'); const r=box.getBoundingClientRect(); const el=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
 return {fdHidden: document.getElementById('fd').hidden, bodyOverflow: document.body.style.overflow, rect:[r.left,r.top,r.width,r.height].map(Math.round), vh: innerHeight, docH: document.documentElement.scrollHeight, scrollY, hit: el ? (el.id||el.className||el.tagName) : null, sendState: document.getElementById('sendBtn').dataset.state, active: document.activeElement.id, tabview: document.getElementById('grid').dataset.tab+'/'+document.getElementById('grid').dataset.view }; });
console.log(info);
try { await p.tap('#box'); console.log('tap ok, active=', await p.evaluate(()=>document.activeElement.id)); } catch(e){ console.log('tap failed:', e.message.split('\n')[0]); }
console.log('last user bubble len:', await p.$$eval('#msgs .msg.me', els=>els[els.length-1].innerText.length));
console.log('errors:',errs);await b.close();})();
