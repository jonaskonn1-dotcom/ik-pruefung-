// Browser-Smoke-Test: node tests/e2e.mjs [url] [ausgabeordner]
// Benötigt laufenden Server (npm run build && npm run preview) und Playwright.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = process.argv[2] || 'http://localhost:4173/';
const out = process.argv[3] || 'screenshots';
const errors = [];
const browser = await chromium.launch();

async function run(name, viewport, scheme, fn) {
  const ctx = await browser.newContext({ viewport, colorScheme: scheme, deviceScaleFactor: 2, hasTouch: viewport.width < 600 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${name}] console: ${m.text()}`); });
  await page.goto(url);
  await fn(page, (n) => page.screenshot({ path: `${out}/${name}-${n}.png`, fullPage: false }));
  await ctx.close();
}

const answerCurrent = async (page) => {
  const typ = await page.locator('.q-meta .badge').first().textContent();
  if (/Rechen/.test(typ)) await page.fill('#num-in', '123');
  else if (/Zuordnung/.test(typ)) { for (const s of await page.locator('select[data-act=match]').all()) await s.selectOption({ index: 1 }); }
  else if (/Reihenfolge/.test(typ)) { for (const b of await page.locator('button[data-act=order]').all()) await b.click(); }
  else await page.locator('button[data-act=opt]').first().click();
  await page.click('#go');
};

await run('mobil', { width: 375, height: 812 }, 'light', async (page, shot) => {
  await page.waitForSelector('.hero'); await shot('1-start');
  await page.click('a[href="#/lernen"]'); await page.waitForSelector('.topics'); await shot('2-lernen');
  await page.goto(url + '#/quiz?thema=ksk-kalkulation&alle=1'); await page.waitForSelector('.question');
  await shot('3-quiz-frage');
  await answerCurrent(page); await page.waitForSelector('.feedback'); await shot('4-quiz-feedback');
  // restliche Fragen durchklicken
  for (;;) { await page.click('#go'); if (await page.$('.result')) break; await page.waitForSelector('.question'); await answerCurrent(page); await page.waitForSelector('.feedback'); }
  await page.waitForSelector('.result'); await shot('5-ergebnis');
  await page.goto(url + '#/fehler'); await page.waitForSelector('h1'); await shot('6-fehlerkorb');
  await page.goto(url + '#/karten/lernen'); await page.waitForSelector('.flashcard'); await page.click('.flashcard'); await shot('7-karte');
  await page.click('[data-r=gewusst]');
  await page.goto(url + '#/formeln'); await page.fill('#f-q', 'break'); await page.waitForTimeout(100); await shot('8-formeln');
  await page.goto(url + '#/'); await page.waitForSelector('.hero'); await shot('9-start-nachher');
  await page.goto(url + '#/mehr'); await page.waitForSelector('.seg'); await shot('10-mehr');
});

await run('mobil-dunkel', { width: 375, height: 812 }, 'dark', async (page, shot) => {
  await page.waitForSelector('.hero'); await shot('1-start');
  await page.goto(url + '#/quiz?thema=ksk-kalkulation&typ=zuordnung&alle=1'); await page.waitForSelector('.question'); await shot('2-zuordnung');
  await page.goto(url + '#/quiz?thema=ksk-kalkulation&typ=reihenfolge&alle=1'); await page.waitForSelector('.question');
  const bs = await page.locator('button[data-act=order]').all(); await bs[0].click(); await bs[1].click(); await shot('3-reihenfolge');
});

await run('desktop', { width: 1366, height: 860 }, 'light', async (page, shot) => {
  await page.waitForSelector('.hero'); await shot('1-start');
  await page.goto(url + '#/quiz?thema=ksk-kalkulation&typ=einfach&alle=1'); await page.waitForSelector('.question');
  await page.keyboard.press('2'); await page.keyboard.press('Enter'); await page.waitForSelector('.feedback'); await shot('2-quiz-tastatur');
  await page.keyboard.press('Enter'); await page.waitForSelector('.question');
  await page.goto(url + '#/formeln'); await page.waitForSelector('.formel'); await shot('3-formeln');
});

await browser.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('✓ E2E ok – Screenshots in ' + out);
