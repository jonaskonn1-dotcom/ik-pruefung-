// Hängt Fragen aus einer JSON-Datei ({"thema-id": [fragen…]}) an die Themen-Dateien an,
// ohne die übrige Formatierung zu verändern: node scripts/append-fragen.mjs neue-fragen.json
import { readFileSync, writeFileSync } from 'node:fs';
import { loadAll } from './lib-content.mjs';
const neu = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const { themen } = loadAll();
for (const [id, fragen] of Object.entries(neu)) {
  const t = themen.find((x) => x.data.id === id);
  if (!t) { console.error('✗ Thema nicht gefunden:', id); process.exitCode = 1; continue; }
  const text = readFileSync(t.file, 'utf8');
  const marker = text.lastIndexOf('\n  ],\n  "karten"');
  if (marker < 0) { console.error('✗ Struktur nicht erkannt:', t.rel); process.exitCode = 1; continue; }
  const vorhanden = new Set(t.data.fragen.map((q) => q.id));
  const add = fragen.filter((q) => !vorhanden.has(q.id));
  if (!add.length) continue;
  const block = add.map((q) => JSON.stringify(q, null, 2).replace(/^/gm, '    ')).join(',\n');
  writeFileSync(t.file, text.slice(0, marker) + ',\n' + block + text.slice(marker));
  console.log(`✓ ${id}: +${add.length}`);
}
