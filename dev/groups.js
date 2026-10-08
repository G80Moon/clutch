// Real class groups against the mock (which runs functions/api/groups.js on in-memory SQLite): create, join by invite link,
// shared goal, share + save a deck, leave, bad code. Two separate browser profiles = two students. Run: node dev/groups.js
const { chromium } = require('playwright');
const M = 'http://localhost:8787';
(async()=>{const b=await chromium.launch(); const errs=[];
const student = async (name, url) => { const ctx = await b.newContext({viewport:{width:1540,height:900}}); const p = await ctx.newPage(); p.on('pageerror',e=>errs.push(name+': '+e.message)); p.on('dialog', d=>d.accept(name));
  await p.goto(url || M+'/'); await p.waitForTimeout(900); if (await p.$('#land:not([hidden])')){ await p.click('.lnav [data-land=skip]'); await p.waitForTimeout(1200); } return p; };
const a = await student('Alice');
await a.click('#views [data-v=groups]'); await a.waitForTimeout(400);
console.log('empty state:', (await a.$eval('#gPane',e=>e.innerText)).split('\n')[0]);
await a.selectOption('#gCourse', {index:0}); await a.fill('#gName','Exam 1 crew'); await a.click('#gNewForm [type=submit]'); await a.waitForTimeout(900);
const code = await a.$eval('.gcode .code',e=>e.textContent); console.log('created:', code);
const bob = await student('Bob', M+'/#join='+code);
console.log('bob joined by link:', await bob.$eval('#grid',e=>e.dataset.view), await bob.$$eval('.gm b',e=>e.map(x=>x.textContent)));
await bob.evaluate(()=>{ const S=JSON.parse(localStorage.getItem('clutch.planner.v1')); S.decks=[{id:'k1',topic:'Memory basics',course:'PSY 101',cards:[{q:'Q1',a:'A1',miss:0,hit:0},{q:'Q2',a:'A2',miss:0,hit:0}],src:'photo',at:Date.now(),last:null}]; S.log.push({date:new Date().toISOString().slice(0,10),min:50,n:2,real:true}); localStorage.setItem('clutch.planner.v1',JSON.stringify(S)); });
await bob.reload(); await bob.waitForTimeout(900); await bob.click('#views [data-v=groups]'); await bob.waitForTimeout(1200);
await bob.click('[data-ga=share]'); await bob.waitForTimeout(800); console.log('bob shared:', await bob.$$eval('.gd b',e=>e.map(x=>x.textContent)));
const a2 = await a.context().newPage(); await a2.goto(M+'/'); await a2.waitForTimeout(900); await a2.click('#views [data-v=groups]'); await a2.waitForTimeout(1500);
console.log('alice sees goal:', (await a2.$eval('.gchal .grow',e=>e.innerText)).replace(/\n+/g,' | '), '| members:', await a2.$$eval('.gm',e=>e.map(x=>x.innerText.replace(/\n+/g,' '))));
await a2.click('[data-ga=save]'); await a2.waitForTimeout(600); console.log('alice decks now:', await a2.evaluate(()=>JSON.parse(localStorage.getItem('clutch.planner.v1')).decks.map(d=>d.topic)));
await a2.screenshot({path:__dirname+'/../.shots/groups.png'});
await bob.click('[data-ga=leave]'); await bob.click('[data-ga=leave]'); await bob.waitForTimeout(700); console.log('bob left:', await bob.$eval('#toastMsg',e=>e.textContent));
await bob.fill('#gCode','ZZZ999'); await bob.click('#gJoinForm [type=submit]'); await bob.waitForTimeout(600); console.log('bad code:', await bob.$eval('#toastMsg',e=>e.textContent));
console.log('errors:',errs); await b.close();})();
