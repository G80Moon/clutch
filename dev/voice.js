// Voice typing: tap the mic, talk, words land in the chat box (fake speech recognition), tap again to stop. Also: no mic button where the browser can't do it. Run: node dev/voice.js
const { chromium, devices } = require('playwright');
const FAKE = () => { window.webkitSpeechRecognition = class { start(){ window.__rec = this; const said = window.__sayList || ['what should I', 'what should I work on', 'what should I work on tonight'];
  said.forEach((t,i) => setTimeout(() => this.onresult && this.onresult({ results: [Object.assign([{ transcript: t }], { isFinal: i === said.length-1 })] }), 100*(i+1))); }
  stop(){ this.finish(); } abort(){ this.finish(); }
  finish(){ const said = window.__sayList || ['what should I work on tonight']; setTimeout(() => { this.onresult && this.onresult({ results: [Object.assign([{ transcript: said[said.length-1] }], { isFinal: true })] }); this.onend && this.onend(); }, 30); } }; window.SpeechRecognition = window.webkitSpeechRecognition; };
(async()=>{ const b = await chromium.launch(); const errs=[];
 for (const ctxOpt of [{viewport:{width:1540,height:880}}, {...devices['iPhone 13']}]){
  const p = await (await b.newContext(ctxOpt)).newPage(); p.on('pageerror',e=>errs.push(e.message)); await p.addInitScript(FAKE);
  await p.goto('http://localhost:8787/'); await p.waitForTimeout(800);
  const phone = ctxOpt.viewport.width < 500;
  await p.click(phone ? '.lhero [data-land=skip]' : '.lnav [data-land=skip]'); await p.waitForTimeout(500);
  if (phone){ await p.click('[data-tab=ask]'); await p.waitForTimeout(300); }
  await p.click('#micBtn'); await p.waitForTimeout(150);
  const mid = await p.$eval('#box', e=>e.value), on = await p.$eval('#micBtn', e=>e.getAttribute('aria-pressed'));
  await p.waitForTimeout(300); await p.screenshot({path:`${__dirname}/../.shots/voice-${ctxOpt.viewport.width}.png`});
  await p.click('#micBtn'); await p.waitForTimeout(100);
  console.log(phone ? 'iPhone' : 'desktop', '| listening:', on, '| mid-sentence:', JSON.stringify(mid), '| box:', JSON.stringify(await p.$eval('#box', e=>e.value)), '| after stop:', await p.$eval('#micBtn', e=>e.getAttribute('aria-pressed')));
  await p.click('#sendBtn'); await p.waitForTimeout(1500); console.log('sent bubble:', await p.$$eval('#msgs .msg.me', e=>e[e.length-1].textContent));
 }
 // the speech engine hears "he clutch": the box should still say "Hey Clutch,"
 const h = await (await b.newContext({viewport:{width:1280,height:800}})).newPage(); await h.addInitScript(FAKE); await h.addInitScript(()=>{ window.__sayList = ['he clutch', 'he clutch what should I do tonight']; });
 await h.goto('http://localhost:8787/'); await h.waitForTimeout(800); await h.click('.lnav [data-land=skip]'); await h.waitForTimeout(400);
 await h.click('#micBtn'); await h.waitForTimeout(400); console.log('"he clutch what should I do tonight" ->', JSON.stringify(await h.$eval('#box', e=>e.value)));
 const n = await (await b.newContext()).newPage(); await n.addInitScript(()=>{ delete window.webkitSpeechRecognition; delete window.SpeechRecognition; });
 await n.goto('http://localhost:8787/'); await n.waitForTimeout(600); console.log('no speech support -> mic hidden:', await n.$eval('#micBtn', e=>e.hidden));
 // send while still listening: the engine's late final result must not refill the box
 const q = await (await b.newContext({viewport:{width:1280,height:800}})).newPage(); await q.addInitScript(FAKE);
 await q.goto('http://localhost:8787/'); await q.waitForTimeout(800); await q.click('.lnav [data-land=skip]'); await q.waitForTimeout(400);
 await q.click('#micBtn'); await q.waitForTimeout(400); await q.click('#sendBtn'); await q.waitForTimeout(400);
 console.log('box after sending mid-listen:', JSON.stringify(await q.$eval('#box', e=>e.value)), '| mic:', await q.$eval('#micBtn', e=>e.getAttribute('aria-pressed')));
 console.log('errors:', errs); await b.close(); })();
