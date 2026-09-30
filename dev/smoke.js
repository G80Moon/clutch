// Desktop smoke test against the mock: chat reply, plan-my-week tool round, practice test JSON, photo flashcards. Run: node dev/smoke.js
const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:1000}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8787/');await p.waitForTimeout(800);
await p.click('.lnav [data-land=skip]');await p.waitForTimeout(800);
console.log('status:', await p.$eval('#aiStatus',e=>e.textContent));
await p.fill('#box','what should I do tonight?'); await p.click('#sendBtn'); await p.waitForTimeout(1500);
console.log('reply:', await p.$$eval('#msgs .msg.bot',els=>els[els.length-1].innerText.slice(0,90)));
const before = await p.$$eval('#week .blk',e=>e.length);
await p.fill('#box','plan my week'); await p.click('#sendBtn'); await p.waitForTimeout(2500);
console.log('blocks', before, '->', await p.$$eval('#week .blk',e=>e.length));
console.log('reply2:', await p.$$eval('#msgs .msg.bot',els=>els[els.length-1].innerText.slice(0,120)));
console.log('plancard:', !!(await p.$('.plancard')), '| action:', await p.$$eval('#msgs .action',els=>els.map(e=>e.textContent).join(' | ')));
// practice test via json
await p.click('#views [data-v=study]'); await p.click('#testNew'); await p.waitForTimeout(300); await p.click('#ptGo'); await p.waitForTimeout(1500);
console.log('test title:', await p.$eval('#ptTitle',e=>e.textContent), '|', await p.$eval('#ptSub',e=>e.textContent));
await p.keyboard.press('Escape');
// photo flashcards with image
await p.setInputFiles('#photoIn', __dirname+'/notes.png'); await p.waitForTimeout(2500);
console.log('deck:', await p.$$eval('.deck .dkh b',els=>els.map(e=>e.textContent).join(' | ')));
const calls = await (await p.request.get('http://localhost:8787/calls')).json();
const img = calls.find(c=>Array.isArray(c.messages[0].content) && c.messages[0].content.some(x=>x.type==='image'));
console.log('image sent:', !!img, img ? img.messages[0].content[0].source.media_type + ' ' + img.messages[0].content[0].source.data.length + ' b64 chars' : '');
console.log('tools sent on plan:', calls.filter(c=>c.tools).length, 'models:', [...new Set(calls.map(c=>c.model))].join(','));
console.log('errors:',errs);await b.close();})();
