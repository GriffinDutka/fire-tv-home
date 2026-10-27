// Regenerates docs/redesign/screens/*.png from the mockup.
// Usage: node docs/redesign/tools/screenshots.js docs/redesign/mockup.html docs/redesign/screens
// Needs Node and Playwright (npm i -D playwright && npx playwright install chromium).
const { chromium } = require('playwright');
(async () => {
  const [file, out] = process.argv.slice(2).map(p => require("path").resolve(p));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1.5 });
  p.on('pageerror', e => console.log('ERROR:', e.message));
  await p.goto('file://' + file); await p.waitForTimeout(2500);
  const tv = await (await p.$('#tv')).boundingBox();
  const shot = async n => { await p.waitForTimeout(900); await p.screenshot({ path: out + '/' + n + '.png', clip: tv }); };
  const k = async (x, n = 1) => { for (let i = 0; i < n; i++) { await p.keyboard.press(x); await p.waitForTimeout(250); } };
  await p.click('[data-w="evening"]'); await p.evaluate(() => { document.activeElement.blur(); scrollTo(0, 0); });
  await shot('1-screensaver');
  await k('ArrowUp'); await shot('2-home');
  await k('ArrowRight'); await k('h'); await shot('3-options');
  await k('Escape'); await k('ArrowDown', 2); await k('ArrowRight'); await k('Enter'); await shot('4-settings');
  await k('ArrowDown', 3); await k('ArrowRight'); await shot('5-settings-screensaver');
  await b.close();
})();
