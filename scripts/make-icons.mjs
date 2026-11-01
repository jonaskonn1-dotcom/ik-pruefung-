// Erzeugt PNG-Icons aus den SVGs (einmalig nötig, Ergebnis liegt in public/icons).
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // global vorinstalliert (NODE_PATH=$(npm root -g))
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const dir = fileURLToPath(new URL('../public/icons/', import.meta.url));
const jobs = [['icon.svg', 'icon-192.png', 192], ['icon.svg', 'icon-512.png', 512], ['maskable.svg', 'maskable-512.png', 512], ['maskable.svg', 'apple-touch-icon.png', 180]];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [src, out, size] of jobs) {
  const svg = readFileSync(dir + src, 'utf8');
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: dir + out, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('✓', out);
}
await browser.close();
