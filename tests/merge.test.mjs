// Unit-Test für das Zusammenführen von Lernständen: node tests/merge.test.mjs
import assert from 'node:assert/strict';
import { mergeState, parseExport, EXPORT_APP } from '../src/lib/merge.js';

const handy = {
  settings: { theme: 'dark' }, simLauf: { titel: 'läuft' },
  q: { a: { n: 1, ok: 0, last: false, t: 100 }, b: { n: 2, ok: 2, last: true, t: 300 } },
  fehler: { a: { seit: 100, streak: 0 } },
  karten: { k1: { box: 2, due: '2026-11-03', n: 2 } },
  tage: { '2026-11-01': { fragen: 5, richtig: 3, karten: 1 } },
  sims: [{ datum: '2026-11-01', titel: 'WiSo', prozent: 70, punkte: 21 }],
  eigene: { fragen: [{ id: 'e1' }], karten: [] },
};
const mac = {
  settings: { theme: 'light' },
  q: { a: { n: 2, ok: 1, last: true, t: 200 }, c: { n: 1, ok: 0, last: false, t: 50 } },
  fehler: { a: { seit: 100, streak: 1 }, c: { seit: 50, streak: 0 } },
  karten: { k1: { box: 3, due: '2026-11-08', n: 3 }, k2: { box: 1, due: '2026-11-02', n: 1 } },
  tage: { '2026-11-01': { fragen: 2, richtig: 2, karten: 4 }, '2026-10-31': { fragen: 9, richtig: 7, karten: 0 } },
  sims: [{ datum: '2026-11-01', titel: 'WiSo', prozent: 70, punkte: 21 }, { datum: '2026-10-30', titel: 'MVPK', prozent: 61, punkte: 34 }],
  eigene: { fragen: [{ id: 'e2' }], karten: [{ id: 'ek1' }] },
};

const m = mergeState(handy, mac);
assert.equal(m.settings.theme, 'dark', 'Einstellungen bleiben lokal');
assert.equal(m.simLauf.titel, 'läuft', 'laufende Simulation bleibt');
assert.equal(m.q.a.t, 200, 'neuere Antwort gewinnt');
assert.equal(m.q.b.t, 300);
assert.ok(m.q.c, 'Frage nur auf dem Mac übernommen');
assert.deepEqual(m.fehler.a, { seit: 100, streak: 1 }, 'Fehlerkorb vom Gerät mit neuerer Antwort');
assert.ok(m.fehler.c);
assert.equal(m.karten.k1.box, 3, 'Karte mit mehr Wiederholungen gewinnt');
assert.ok(m.karten.k2);
assert.deepEqual(m.tage['2026-11-01'], { fragen: 5, richtig: 3, karten: 4 });
assert.equal(m.sims.length, 2, 'Simulationen ohne Duplikate');
assert.equal(m.eigene.fragen.length, 2);
assert.equal(m.eigene.karten.length, 1);
// Richtung umgekehrt: Fehler „a“ ist auf dem Mac neuer beantwortet (richtig) – Eintrag bleibt mit Streak 1
assert.equal(mergeState(mac, handy).q.a.t, 200);
// Export-Format
assert.equal(parseExport(JSON.stringify({ app: EXPORT_APP, daten: handy })).q.b.t, 300);
assert.throws(() => parseExport('kein json'), /kein gültiges JSON/);
assert.throws(() => parseExport('{"foo":1}'), /keinen Lernstand/);
console.log('✓ Merge-Tests OK');
