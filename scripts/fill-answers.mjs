// Rechnet alle Rechenaufgaben (typ "zahl") über ihren "calc"-Ausdruck nach und trägt das
// Ergebnis als "loesung" in die JSON-Datei ein. Nutzung beim Schreiben neuer Aufgaben:
//   1. Aufgabe mit "calc" und "loesung": null anlegen
//   2. npm run fill   → Lösung wird eingetragen und angezeigt
//   3. npm test       → prüft, dass loesung und calc übereinstimmen
import { readFileSync, writeFileSync } from 'node:fs';
import { loadAll } from './lib-content.mjs';
import { evalExpr } from '../src/lib/template.js';

const { W, themen } = loadAll();
let changed = 0;
for (const t of themen) {
  let text = readFileSync(t.file, 'utf8');
  let dirty = false;
  for (const q of t.data.fragen || []) {
    if (q.typ !== 'zahl' || !q.calc) continue;
    const val = evalExpr(q.calc, q.vars || {}, W);
    if (typeof q.loesung === 'number' && Math.abs(q.loesung - val) < 1e-9) continue;
    const idPos = text.indexOf(`"id": "${q.id}"`);
    const nextId = text.indexOf('"id": "', idPos + 5);
    const end = nextId === -1 ? text.length : nextId;
    const seg = text.slice(idPos, end);
    const re = /"loesung":\s*(-?[\d.]+|null)/;
    if (!re.test(seg)) { console.error(`✗ ${q.id}: kein "loesung"-Feld gefunden`); continue; }
    const rounded = Math.round(val * 1e6) / 1e6;
    text = text.slice(0, idPos) + seg.replace(re, `"loesung": ${rounded}`) + text.slice(end);
    console.log(`✓ ${q.id}: ${q.loesung} → ${rounded}`);
    dirty = true; changed++;
  }
  if (dirty) writeFileSync(t.file, text);
}
console.log(changed ? `${changed} Lösung(en) aktualisiert.` : 'Alle Lösungen waren bereits korrekt.');
