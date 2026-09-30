// What students see when the AI fails: daily cap (429), Claude down (502), bad key (503), on chat, practice test and photo cards. Run: node dev/errors.js
const { chromium } = require('playwright');
const M = 'http://localhost:8787';
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:1000}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(M+'/');await p.waitForTimeout(800);await p.click('.lnav [data-land=skip]');await p.waitForTimeout(600);
const lastBot = () => p.$$eval('#msgs .msg.bot',els=>els[els.length-1].innerText.trim());
console.log('device id sent:', await p.evaluate(()=>!!localStorage.getItem('clutch.id')) || '(set on first message)');
for (const st of [429, 502]){ await p.request.get(M+'/fail?status='+st); await p.fill('#box','what should I do tonight?'); await p.click('#sendBtn'); await p.waitForTimeout(1200); console.log(`chat ${st}:`, await lastBot()); }
const calls = await (await p.request.get(M+'/calls')).json(); console.log('x-clutch-id stored:', await p.evaluate(()=>localStorage.getItem('clutch.id')));
await p.request.get(M+'/fail?status=429'); await p.click('#views [data-v=study]'); await p.click('#testNew'); await p.waitForTimeout(300); await p.click('#ptGo'); await p.waitForTimeout(1200);
console.log('practice test 429:', (await p.$eval('#ptBody',e=>e.innerText)).replace(/\n+/g,' | ').slice(0,120)); await p.keyboard.press('Escape');
await p.request.get(M+'/fail?status=502'); await p.setInputFiles('#photoIn', __dirname+'/notes.png'); await p.waitForTimeout(2000); console.log('photo cards 502:', await lastBot());
await p.request.get(M+'/fail?status=503'); await p.click('#views [data-v=plan]'); await p.fill('#box','hi'); await p.click('#sendBtn'); await p.waitForTimeout(1200);
console.log('chat 503:', await lastBot(), '| status:', await p.$eval('#aiStatus',e=>e.textContent));
console.log('errors:',errs);await b.close();})();
