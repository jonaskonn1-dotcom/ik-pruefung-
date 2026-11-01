// Prüft: Simulation mit ausschließlich richtigen Antworten ergibt 100 Punkte (Server auf :4173 nötig).
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const Q = new Map(); for (const f of walk(new URL('../content/themen', import.meta.url).pathname)) for (const q of JSON.parse(readFileSync(f)).fragen) Q.set(q.id, q);
const b = await chromium.launch(); const p = await b.newPage();
p.on('dialog', d => d.accept()); const errs = []; p.on('pageerror', e => errs.push(e.message));
for (const ber of ['mvpk', 'wiso']) {
  await p.goto('http://localhost:4173/#/simulation'); await p.waitForSelector('.sim-card');
  await p.click(`[data-start=${ber}]:not([data-kurz])`); await p.waitForSelector('.sim-timer');
  const lauf = await p.evaluate(() => JSON.parse(localStorage.getItem('ik-lernstand-v1')).simLauf);
  for (const st of lauf.states) {
    const q = Q.get(st.id);
    if (q.typ === 'einfach') st.sel = [q.loesung];
    if (q.typ === 'mehrfach') st.sel = q.loesung;
    if (q.typ === 'zuordnung') st.sel = Object.fromEntries(q.paare.map((pp, i) => [i, pp[1]]));
    if (q.typ === 'reihenfolge') st.order = q.elemente.map((_, i) => i);
    if (q.typ === 'zahl') st.value = String(q.loesung).replace('.', ',');
  }
  await p.evaluate((l) => { const s = JSON.parse(localStorage.getItem('ik-lernstand-v1')); s.simLauf = l; localStorage.setItem('ik-lernstand-v1', JSON.stringify(s)); }, lauf);
  await p.reload(); await p.waitForSelector('.sim-timer');
  await p.click('#submit2'); await p.waitForSelector('.result');
  console.log(ber, (await p.textContent('.result-sub')).trim(), 'Fragen:', lauf.states.length, 'Themen:', new Set(lauf.states.map(s => Q.get(s.id) && s.id.split('-')[0])).size);
}
console.log('errors', errs); await b.close();
