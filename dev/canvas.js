// Canvas feed test against the mock: connect, review list, add, row colors, sync (nothing new), sync after a due date moves. Run: node dev/canvas.js
const { chromium, devices } = require('playwright');
const FEED = 'https://canvas.morainevalley.edu/feeds/calendars/user_abc123XYZ.ics';
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:1000}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8787/');await p.waitForTimeout(800);
await p.click('.lnav [data-land=skip]');await p.waitForTimeout(600);
console.log('button:', await p.$eval('#canvasBtn',e=>e.textContent), '| example card:', !!(await p.$('#cxCta .cxcta')));
await p.click('#cxCta [data-cxcta]'); await p.waitForTimeout(200);
await p.fill('#cxUrl','https://example.com/not-a-feed'); await p.click('#cxFoot [data-cxgo]'); await p.waitForTimeout(300);
console.log('bad link error:', await p.$eval('.cxerr',e=>e.textContent));
await p.fill('#cxUrl',FEED); await p.waitForTimeout(800); // a valid link starts on its own
console.log('review:', await p.$eval('#cxTitle',e=>e.textContent), '|', await p.$$eval('.cxrow',rs=>rs.map(r=>`${r.querySelector('input').checked?'[x]':'[ ]'} ${r.querySelector('.course').textContent}: ${r.querySelector('.t').textContent.slice(0,40)} @ ${r.querySelector('.when').innerText.replace('\n',' ')}`).join('\n  ')));
console.log('add btn:', await p.$eval('#cxFoot [data-cxadd]',e=>e.textContent), '| replace example:', !!(await p.$('#cxReplace')));
await p.click('#cxFoot [data-cxadd]'); await p.waitForTimeout(600);
const rows = await p.$$eval('#list .item',els=>els.map(e=>`${(e.className.match(/st-\w+/)||['plain'])[0]} ${e.querySelector('.t').textContent.slice(0,30)} | ${e.querySelector('.due').textContent}`));
console.log('list:\n  '+rows.join('\n  '));
console.log('example card gone:', !(await p.$('#cxCta .cxcta')), '| plan offer:', await p.$eval('#toastBtn',e=>e.hidden?'none':e.textContent));
console.log('example flag:', await p.evaluate(()=>JSON.parse(localStorage.getItem('clutch.planner.v1')).example), '| button:', await p.$eval('#canvasBtn',e=>e.textContent));
// check one off -> green
await p.click('#list .item.st-soon [data-act=toggle]'); await p.waitForTimeout(900);
console.log('done rows:', await p.$$eval('#list .item.st-done',e=>e.length));
// sync with nothing new
await p.click('#canvasBtn'); await p.waitForTimeout(800);
console.log('sync 1 toast:', await p.$eval('.toast',e=>e.textContent), '| modal open:', !(await p.$eval('#cx',e=>e.hidden)));
// professor moves the quiz
await p.request.get('http://localhost:8787/canvas-move');
const before = await p.evaluate(()=>JSON.parse(localStorage.getItem('clutch.planner.v1')).assignments.find(a=>a.cid==='event-assignment-104').due);
await p.click('#canvasBtn'); await p.waitForTimeout(800);
const after = await p.evaluate(()=>JSON.parse(localStorage.getItem('clutch.planner.v1')).assignments.find(a=>a.cid==='event-assignment-104').due);
console.log('sync 2 toast:', await p.$eval('.toast',e=>e.textContent), '| quiz due', before, '->', after);
// chat canvas card links to real Canvas
console.log('feed url kept on device only:', await p.evaluate(u=>localStorage.getItem('clutch.planner.v1').includes(u), FEED));
await p.screenshot({path:__dirname+'/../.shots/canvas-list.png'});
// mobile: the header fits and the review list looks right
const m = await (await b.newContext({...devices['iPhone 13']})).newPage(); m.on('pageerror',e=>errs.push(e.message));
await m.goto('http://localhost:8787/m'); await m.waitForTimeout(800); await m.click('.lhero [data-land=skip]'); await m.waitForTimeout(500);
const hdr = await m.$eval('.c-due .sh', e=>({w:e.scrollWidth, cw:e.clientWidth}));
console.log('mobile due header overflow:', hdr.w > hdr.cw, hdr);
await m.click('#cxCta [data-cxcta]'); await m.fill('#cxUrl',FEED); await m.waitForTimeout(800);
await m.screenshot({path:__dirname+'/../.shots/canvas-mobile-review.png'});
await m.click('#cxFoot [data-cxadd]'); await m.waitForTimeout(600);
await m.screenshot({path:__dirname+'/../.shots/canvas-mobile-list.png'});
const o = await (await b.newContext({viewport:{width:1280,height:900}})).newPage(); o.on('pageerror',e=>errs.push(e.message));
await o.goto('http://localhost:8787/'); await o.waitForTimeout(700); await o.click('.lnav [data-land=start]'); await o.waitForTimeout(300);
await o.fill('#obName','Sam'); await o.click('#obGoal .choice'); await o.waitForTimeout(200);
for (let i=0;i<3;i++){ await o.click('#obNext'); await o.waitForTimeout(300); }
console.log('setup start options:', await o.$$eval('#obStart .choice b',e=>e.map(x=>x.textContent).join(' | '), ), '| picked:', await o.$eval('#obStart [aria-pressed=true] b',e=>e.textContent));
await o.click('#obNext'); await o.waitForTimeout(400);
console.log('after setup, connect open:', !(await o.$eval('#cx',e=>e.hidden)), '| list empty of examples:', await o.$$eval('#list .item',e=>e.length));
await o.screenshot({path:__dirname+'/../.shots/canvas-connect-desktop.png'});
// a feed link pasted into the chat goes to Canvas import, not the AI; greeting updates; a second tab picks up the change
const ctx2 = await b.newContext({viewport:{width:1280,height:900}}); const c = await ctx2.newPage(); c.on('pageerror',e=>errs.push(e.message));
await c.goto('http://localhost:8787/'); await c.waitForTimeout(700); await c.click('.lnav [data-land=skip]'); await c.waitForTimeout(500);
const c2 = await ctx2.newPage(); await c2.goto('http://localhost:8787/'); await c2.waitForTimeout(900);
const before2 = await c.request.get('http://localhost:8787/calls').then(r=>r.json()).then(x=>x.length);
await c.fill('#box', FEED); await c.click('#sendBtn'); await c.waitForTimeout(900);
const after2 = await c.request.get('http://localhost:8787/calls').then(r=>r.json()).then(x=>x.length);
console.log('chat link -> review open:', !(await c.$eval('#cx',e=>e.hidden)), '| AI calls made:', after2-before2, '| link in chat bubbles:', await c.$$eval('#msgs .msg.me',els=>els.some(e=>e.textContent.includes('feeds'))));
await c.click('#cxFoot [data-cxadd]'); await c.waitForTimeout(700);
console.log('greeting now:', (await c.$eval('#greet .body',e=>e.textContent)).slice(0,70));
await c2.waitForTimeout(300); console.log('other tab sees import:', await c2.$$eval('#list .item',e=>e.length), 'items, button:', await c2.$eval('#canvasBtn',e=>e.textContent));
console.log('errors:',errs);await b.close();})();
