// Focus: Start focus runs the timer in place (no takeover), the countdown shows in the tab title, leaving the tab isn't punished,
// Full screen is optional, and finishing logs the minutes with a chime. Run: node dev/focus.js
const { chromium, devices } = require('playwright');
(async()=>{ const b = await chromium.launch(); const errs=[];
 const p = await (await b.newContext({viewport:{width:1540,height:880}})).newPage(); p.on('pageerror',e=>errs.push(e.message)); await p.clock.install();
 await p.goto('http://localhost:8787/'); await p.waitForTimeout(800); await p.click('.lnav [data-land=skip]'); await p.waitForTimeout(400);
 await p.click('#views [data-v=focus]'); await p.waitForTimeout(300);
 const title0 = await p.title();
 await p.click('#smOpen'); await p.waitForTimeout(1300);
 console.log('takeover after Start focus:', !(await p.$eval('#sm',e=>e.hidden)), '| button:', await p.$eval('#smOpen',e=>e.textContent), '| tab title:', await p.title(), '| toast:', await p.$eval('.toast',e=>e.textContent));
 // switch away for 5 seconds and back: nothing should count it
 await p.evaluate(()=>{ Object.defineProperty(document,'hidden',{value:true,configurable:true}); document.dispatchEvent(new Event('visibilitychange')); });
 await p.evaluate(()=>{ Object.defineProperty(document,'hidden',{value:false,configurable:true}); document.dispatchEvent(new Event('visibilitychange')); });
 await p.click('#smOpen'); await p.waitForTimeout(300); console.log('paused title:', await p.title(), '| button:', await p.$eval('#smOpen',e=>e.textContent));
 await p.click('#fsBtn'); await p.waitForTimeout(400); console.log('Full screen opens study mode:', !(await p.$eval('#sm',e=>e.hidden)), '| button:', await p.$eval('[data-sm=pause]',e=>e.textContent));
 await p.screenshot({path:`${__dirname}/../.shots/focus-fullscreen.png`});
 // finish the session fast
 const logged = () => p.evaluate(()=>JSON.parse(localStorage.getItem('clutch.planner.v1')).log.filter(r=>r.real).reduce((t,r)=>t+r.min,0));
 const before = await logged();
 await p.clock.fastForward('25:30'); await p.waitForTimeout(800);
 const after = await logged();
 console.log('done screen:', await p.$eval('#smMain',e=>e.innerText.replace(/\s+/g,' ').slice(0,140)), '| logged:', before, '->', after, '| title:', await p.title());
 await p.click('[data-sm=exit]'); await p.waitForTimeout(300);
 await p.screenshot({path:`${__dirname}/../.shots/focus-card.png`});
 // hero "Start focus" on the planner view: no takeover either
 const h = await (await b.newContext({viewport:{width:1280,height:800}})).newPage(); h.on('pageerror',e=>errs.push(e.message));
 await h.goto('http://localhost:8787/'); await h.waitForTimeout(800); await h.click('.lnav [data-land=skip]'); await h.waitForTimeout(400);
 const hero = await h.$('#nextStart'); console.log('hero button:', hero && await hero.textContent());
 if (hero){ await hero.click(); await h.waitForTimeout(1200); console.log('hero -> takeover:', !(await h.$eval('#sm',e=>e.hidden)), '| hero now:', await h.$eval('#nextStart',e=>e.textContent), '| title:', await h.title()); }
 // phone
 const m = await (await b.newContext({...devices['iPhone 13']})).newPage(); m.on('pageerror',e=>errs.push(e.message));
 await m.goto('http://localhost:8787/'); await m.waitForTimeout(800); await m.click('.lhero [data-land=skip]'); await m.waitForTimeout(400);
 await m.click('[data-tab=focus]'); await m.waitForTimeout(300); await m.click('#smOpen'); await m.waitForTimeout(1200);
 console.log('phone takeover:', !(await m.$eval('#sm',e=>e.hidden)), '| button:', await m.$eval('#smOpen',e=>e.textContent));
 await m.screenshot({path:`${__dirname}/../.shots/focus-phone.png`});
 console.log('start title was:', title0, '| errors:', errs); await b.close(); })();
