// Voice typing: tap the mic, talk, words land in the chat box (fake speech recognition), tap again to stop. Also: no mic button where the browser can't do it. Run: node dev/voice.js
const { chromium, devices } = require('playwright');
const FAKE = () => { window.webkitSpeechRecognition = class { start(){ window.__rec = this; const said = ['what should I', 'what should I work on', 'what should I work on tonight'];
  said.forEach((t,i) => setTimeout(() => this.onresult && this.onresult({ results: [Object.assign([{ transcript: t }], { isFinal: i === said.length-1 })] }), 100*(i+1))); }
  stop(){ setTimeout(() => this.onend && this.onend(), 20); } }; window.SpeechRecognition = window.webkitSpeechRecognition; };
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
 const n = await (await b.newContext()).newPage(); await n.addInitScript(()=>{ delete window.webkitSpeechRecognition; delete window.SpeechRecognition; });
 await n.goto('http://localhost:8787/'); await n.waitForTimeout(600); console.log('no speech support -> mic hidden:', await n.$eval('#micBtn', e=>e.hidden));
 console.log('errors:', errs); await b.close(); })();
