// Inhaltsübersicht: Fragen, Rechenaufgaben und Lernkarten je Thema (npm run uebersicht)
import { loadAll } from './lib-content.mjs';
const { themen } = loadAll();
const rows = themen.map(({ data: t }) => ({ b: t.bereich.ao2024, id: t.id, f: t.fragen.length, z: t.fragen.filter((q) => q.typ === 'zahl').length, k: t.karten.length }))
  .sort((a, b) => a.b.localeCompare(b.b) || a.f - b.f);
console.log('Bereich  Thema                                  Fragen  Rechen  Karten');
for (const r of rows) console.log(`${r.b.padEnd(8)} ${r.id.padEnd(38)} ${String(r.f).padStart(6)} ${String(r.z).padStart(7)} ${String(r.k).padStart(7)}`);
const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
console.log(`${'Summe'.padEnd(47)} ${String(sum('f')).padStart(6)} ${String(sum('z')).padStart(7)} ${String(sum('k')).padStart(7)}`);
