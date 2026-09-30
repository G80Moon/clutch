// Canvas feed test against the mock: connect, review list, add, row colors, sync (nothing new), sync after a due date moves. Run: node dev/canvas.js
const { chromium, devices } = require('playwright');
const FEED = 'https://canvas.morainevalley.edu/feeds/calendars/user_abc123XYZ.ics';
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:1000}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8787/');await p.waitForTimeout(800);
await p.click('.lnav [data-land=skip]');await p.waitForTimeout(600);
console.log('button:', await p.$eval('#canvasBtn',e=>e.textContent));
await p.click('#canvasBtn'); await p.waitForTimeout(200);
await p.fill('#cxUrl','https://example.com/not-a-feed'); await p.click('#cxFoot [data-cxgo]'); await p.waitForTimeout(300);
console.log('bad link error:', await p.$eval('.cxerr',e=>e.textContent));
await p.fill('#cxUrl',FEED); await p.click('#cxFoot [data-cxgo]'); await p.waitForTimeout(800);
console.log('review:', await p.$eval('#cxTitle',e=>e.textContent), '|', await p.$$eval('.cxrow',rs=>rs.map(r=>`${r.querySelector('input').checked?'[x]':'[ ]'} ${r.querySelector('.course').textContent}: ${r.querySelector('.t').textContent.slice(0,40)} @ ${r.querySelector('.when').innerText.replace('\n',' ')}`).join('\n  ')));
console.log('add btn:', await p.$eval('#cxFoot [data-cxadd]',e=>e.textContent), '| replace example:', !!(await p.$('#cxReplace')));
await p.click('#cxFoot [data-cxadd]'); await p.waitForTimeout(600);
const rows = await p.$$eval('#list .item',els=>els.map(e=>`${(e.className.match(/st-\w+/)||['plain'])[0]} ${e.querySelector('.t').textContent.slice(0,30)} | ${e.querySelector('.due').textContent}`));
console.log('list:\n  '+rows.join('\n  '));
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
await m.click('#canvasBtn'); await m.fill('#cxUrl',FEED); await m.click('#cxFoot [data-cxgo]'); await m.waitForTimeout(800);
await m.screenshot({path:__dirname+'/../.shots/canvas-mobile-review.png'});
await m.click('#cxFoot [data-cxadd]'); await m.waitForTimeout(600);
await m.screenshot({path:__dirname+'/../.shots/canvas-mobile-list.png'});
console.log('errors:',errs);await b.close();})();
