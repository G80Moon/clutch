// Loads the app headless and prints any page error or console error. Run after every edit: node dev/perr.js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  let bad = 0;
  p.on('pageerror', e => { bad++; console.log('PAGEERROR:', e.message); });
  p.on('console', m => { if (m.type()==='error') { bad++; console.log('CONSOLE:', m.text()); } });
  await p.goto('http://localhost:8787/'); await p.waitForTimeout(1500);
  await b.close(); console.log(bad ? `${bad} problem(s)` : 'clean'); process.exit(bad ? 1 : 0);
})();
