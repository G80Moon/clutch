// Listen button on Clutch replies: reads the reply with the device's own voice, flips to Stop while speaking. Run: node dev/tts.js
const { chromium, devices } = require('playwright');
(async()=>{ const b = await chromium.launch(); const errs=[];
 for (const ctxOpt of [{viewport:{width:1540,height:880}}, {...devices['iPhone 13']}]){
  const p = await (await b.newContext(ctxOpt)).newPage(); p.on('pageerror',e=>errs.push(e.message));
  // record what would be spoken instead of playing it
  await p.addInitScript(()=>{ window.__said=[]; speechSynthesis.speak = u => { window.__said.push(u.text); setTimeout(()=>u.onend && u.onend(), 50); }; });
  await p.goto('http://localhost:8787/'); await p.waitForTimeout(800);
  const phone = ctxOpt.viewport.width < 500;
  await p.click(phone ? '.lhero [data-land=skip]' : '.lnav [data-land=skip]'); await p.waitForTimeout(500);
  if (phone){ await p.click('[data-tab=ask]'); await p.waitForTimeout(300); }
  await p.fill('#box','What should I work on tonight?'); await p.click('#sendBtn'); await p.waitForTimeout(2500);
  const btns = await p.$$('#msgs .say'), btn = btns[btns.length-1];
  console.log(phone ? 'iPhone' : 'desktop', '| button:', btn && await btn.innerText());
  await btn.click(); await p.waitForTimeout(30); const during = await btn.innerText();
  await p.waitForTimeout(400); console.log('while speaking:', during, '| after:', await btn.innerText(), '| said:', JSON.stringify(await p.evaluate(()=>window.__said)));
  await p.screenshot({path:`${__dirname}/../.shots/tts-${ctxOpt.viewport.width}.png`});
 }
 console.log('errors:', errs); await b.close(); })();
