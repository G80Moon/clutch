// Money 101 inside the planner: lessons in Due, next-up stays real work, checkbox opens the lesson, quizzes turn rows green,
// all 5 shows the free-semester window, remove + undo, setup "Not now". Run: node dev/money.js
const { chromium, devices } = require('playwright');
const M = 'http://localhost:8787';
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1540,height:880}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(M+'/');await p.waitForTimeout(800);await p.click('.lnav [data-land=skip]');await p.waitForTimeout(600);
const rows = () => p.$$eval('#list .item',els=>els.filter(e=>e.querySelector('.course').textContent==='MONEY 101').map(e=>e.querySelector('.t').textContent+(e.classList.contains('st-done')?' [green]':'')));
console.log('money rows in Due:', await rows());
console.log('strip:', await p.$eval('#mStrip',e=>e.innerText.replace(/\n/g,' | ')));
console.log('next up is real work:', await p.$eval('#nextCard',e=>e.innerText.split('\n').find(l=>/Homework|outline|Lesson/.test(l))));
await p.click('#list .item:has(.course:text-is("MONEY 101")) [data-act=toggle]'); await p.waitForTimeout(500);
console.log('checkbox opened:', await p.$eval('#grid',e=>e.dataset.view), '|', await p.$eval('#mPane',e=>e.innerText.split('\n').filter(Boolean).slice(0,2).join(' / ')));
for (let i=0;i<5;i++){
  const nq = await p.$$eval('#mPane .q', e=>e.length); for (let qi=0; qi<nq; qi++){ const o = await p.$(`#mPane .q[data-q="${qi}"] .opt:not([disabled])`); if (o){ await o.click(); await p.waitForTimeout(120); } }
  await p.waitForTimeout(300);
  if (i<4){ const nx = await p.$('#qFoot [data-qa=next]'); if (nx){ await nx.click(); await p.waitForTimeout(300); } }
}
await p.waitForTimeout(1500);
console.log('reward window:', !(await p.$eval('#mw',e=>e.hidden)), '|', await p.$eval('#mw h2',e=>e.textContent));
await p.screenshot({path:__dirname+'/../.shots/money-reward.png'});
await p.click('#mw [data-mwclose]'); await p.click('#views [data-v=plan]'); await p.waitForTimeout(300);
const lst = await p.$$eval('#list [data-fold]', b=>b.map(x=>x.dataset.fold)); for (const f of lst) await p.click(`#list [data-fold="${f}"]`);
console.log('rows after quizzes:', await rows());
console.log('strip:', await p.$eval('#mStrip',e=>e.innerText.replace(/\n/g,' | ')), '| money tab says:', await p.$eval('#mProgLbl',e=>e.textContent));
await p.screenshot({path:__dirname+'/../.shots/money-strip.png'});
await p.click('#mStrip [data-mrm]'); await p.waitForTimeout(200); console.log('after remove:', (await rows()).length, 'rows'); await p.click('#toastBtn'); await p.waitForTimeout(200); console.log('after undo:', (await rows()).length, 'rows');
// setup with "Not now"
const o = await (await b.newContext({viewport:{width:1280,height:900}})).newPage(); o.on('pageerror',e=>errs.push(e.message));
await o.goto(M+'/'); await o.waitForTimeout(700); await o.click('.lnav [data-land=start]'); await o.waitForTimeout(300);
await o.fill('#obName','Sam'); await o.click('#obGoal .choice'); await o.waitForTimeout(200); for (let i=0;i<3;i++){ await o.click('#obNext'); await o.waitForTimeout(300); }
console.log('setup money question:', await o.$$eval('#obMoney .choice b',e=>e.map(x=>x.textContent).join(' | ')), '| default:', await o.$eval('#obMoney [aria-pressed=true] b',e=>e.textContent));
await o.screenshot({path:__dirname+'/../.shots/money-setup.png'});
await o.click('#obMoney [data-v=no]'); await o.click('#obStart [data-v=empty]'); await o.click('#obNext'); await o.waitForTimeout(400);
console.log('not now -> money rows:', await o.$$eval('#list .course',e=>e.filter(x=>x.textContent==='MONEY 101').length), '| money tab offers add:', await o.evaluate(()=>{ return !!document.querySelector('#mProgLbl [data-maddplan]') || 'n/a until opened'; }));
// phone look
const m = await (await b.newContext({...devices['iPhone 13']})).newPage(); m.on('pageerror',e=>errs.push(e.message));
await m.goto(M+'/m'); await m.waitForTimeout(700); await m.click('.lhero [data-land=skip]'); await m.waitForTimeout(3300);
await m.evaluate(()=>document.querySelector('#mStrip').scrollIntoView({block:'center'})); await m.waitForTimeout(200); await m.screenshot({path:__dirname+'/../.shots/money-iphone.png'});
console.log('errors:',errs);await b.close();})();
