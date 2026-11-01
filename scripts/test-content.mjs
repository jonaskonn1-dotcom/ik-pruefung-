// Prüft alle Inhalte: Schema, eindeutige IDs, Mindestanzahl, Templates und
// rechnet jede Rechenaufgabe über ihren calc-Ausdruck nach.
//   npm test               → Fehler brechen ab
//   npm test -- --verbose  → zeigt jede Rechenaufgabe mit Ergebnis
import { loadAll } from './lib-content.mjs';
import { evalExpr, render, parseNumber } from '../src/lib/template.js';
import { svAN, svAG, r2, faktorAbweichung } from '../src/lib/calc.js';

const verbose = process.argv.includes('--verbose');
const MIN_FRAGEN = 15;
const MIN_KARTEN = 10;
const TYPEN = ['einfach', 'mehrfach', 'zuordnung', 'reihenfolge', 'zahl', 'offen'];
const MIN_OFFEN = { mvpk: 8, wiso: 3 };

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`✗ ${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`! ${where}: ${msg}`);

let data;
try { data = loadAll(); } catch (e) { console.error('✗ ' + e.message); process.exit(1); }
const { W, themen, formeln, profile, werte, fachaufgabe } = data;

// ---------- Werte ----------
for (const [k, v] of Object.entries(werte.werte)) {
  if (typeof v.wert !== 'number') err(`werte-2026/${k}`, 'wert ist keine Zahl');
  if (!v.quelle || !werte.quellen[v.quelle]) err(`werte-2026/${k}`, `Quelle "${v.quelle}" fehlt in "quellen"`);
}

// ---------- Profile ----------
const bereichIds = {};
for (const p of profile) {
  bereichIds[p.id] = new Set(p.bereiche.map((b) => b.id));
  const sum = p.bereiche.reduce((s, b) => s + b.gewicht, 0);
  if (sum !== 100) err(`pruefung/${p.id}`, `Gewichte ergeben ${sum} % statt 100 %`);
}

// ---------- Hilfen ----------
function checkText(where, text, vars) {
  if (text == null) return;
  let out;
  try { out = render(String(text), vars, W); }
  catch (e) { err(where, `Template-Fehler: ${e.message}`); return; }
  if (/NaN|undefined|Infinity|\{\{|\}\}/.test(out)) err(where, `Ausgabe enthält NaN/undefined/{{ }}: …${out.slice(0, 80)}`);
}

const allIds = new Map();
function uniq(id, where) {
  if (!id) { err(where, 'id fehlt'); return; }
  if (allIds.has(id)) err(where, `doppelte id "${id}" (auch in ${allIds.get(id)})`);
  allIds.set(id, where);
}

// ---------- Themen ----------
let nFragen = 0, nKarten = 0, nRechen = 0, nOffen = 0;
for (const { rel, data: t } of themen) {
  uniq(t.id, rel);
  if (!t.titel) err(rel, 'titel fehlt');
  for (const [pid, set] of Object.entries(bereichIds)) {
    const b = t.bereich?.[pid];
    if (!b) err(rel, `bereich.${pid} fehlt`);
    else if (!set.has(b)) err(rel, `bereich.${pid} = "${b}" existiert nicht im Profil`);
  }
  const fragen = t.fragen || [];
  const karten = t.karten || [];
  if (fragen.length < MIN_FRAGEN) err(rel, `nur ${fragen.length} Fragen (mind. ${MIN_FRAGEN})`);
  if (karten.length < MIN_KARTEN) err(rel, `nur ${karten.length} Lernkarten (mind. ${MIN_KARTEN})`);
  const minOffen = MIN_OFFEN[t.bereich?.ao2024] || 0;
  const anzOffen = fragen.filter((q) => q.typ === 'offen').length;
  if (anzOffen < minOffen) err(rel, `nur ${anzOffen} offene Aufgaben (mind. ${minOffen})`);

  for (const q of fragen) {
    nFragen++;
    const w = `${rel} › ${q.id}`;
    uniq(q.id, rel);
    if (!TYPEN.includes(q.typ)) { err(w, `unbekannter typ "${q.typ}"`); continue; }
    if (!q.frage) err(w, 'frage fehlt');
    if (!q.erklaerung && q.typ !== 'offen') err(w, 'erklaerung fehlt');
    const vars = q.vars || {};
    checkText(w + ' frage', q.frage, vars);
    checkText(w + ' erklaerung', q.erklaerung, vars);

    switch (q.typ) {
      case 'einfach':
        if (!Array.isArray(q.optionen) || q.optionen.length < 2) err(w, 'optionen fehlen');
        else if (!Number.isInteger(q.loesung) || q.loesung < 0 || q.loesung >= q.optionen.length) err(w, 'loesung ist kein gültiger Index');
        q.optionen?.forEach((o, i) => checkText(`${w} option ${i}`, o, vars));
        if (new Set(q.optionen).size !== q.optionen?.length) err(w, 'doppelte Optionen');
        break;
      case 'mehrfach':
        if (!Array.isArray(q.optionen) || q.optionen.length < 3) err(w, 'mind. 3 optionen nötig');
        else if (!Array.isArray(q.loesung) || !q.loesung.length || q.loesung.some((i) => !Number.isInteger(i) || i < 0 || i >= q.optionen.length)) err(w, 'loesung muss Liste gültiger Indizes sein');
        else if (new Set(q.loesung).size !== q.loesung.length) err(w, 'doppelte Indizes in loesung');
        q.optionen?.forEach((o, i) => checkText(`${w} option ${i}`, o, vars));
        break;
      case 'zuordnung':
        if (!Array.isArray(q.paare) || q.paare.length < 2 || q.paare.some((p) => !Array.isArray(p) || p.length !== 2)) err(w, 'paare: Liste von [links, rechts] (mind. 2)');
        else if (new Set(q.paare.map((p) => p[0])).size !== q.paare.length) err(w, 'linke Seiten müssen eindeutig sein');
        break;
      case 'reihenfolge':
        if (!Array.isArray(q.elemente) || q.elemente.length < 3) err(w, 'elemente: mind. 3');
        else if (new Set(q.elemente).size !== q.elemente.length) err(w, 'doppelte elemente');
        break;
      case 'offen':
        nOffen++;
        if (!Array.isArray(q.kriterien) || q.kriterien.length < 2) err(w, 'offen: mind. 2 kriterien (Bewertungspunkte)');
        else q.kriterien.forEach((k, i) => checkText(`${w} kriterium ${i}`, k, vars));
        if (q.mindestens != null && (!Number.isInteger(q.mindestens) || q.mindestens < 1 || q.mindestens > (q.kriterien?.length || 0))) err(w, 'mindestens ungültig');
        if (q.punkte != null && !(q.punkte > 0)) err(w, 'punkte ungültig');
        checkText(w + ' musterloesung', q.musterloesung, vars);
        break;
      case 'zahl': {
        nRechen++;
        if (!q.calc) { err(w, 'Rechenaufgabe ohne "calc" – Lösung nicht nachprüfbar'); break; }
        if (typeof q.loesung !== 'number') { err(w, 'loesung ist keine Zahl (npm run fill ausführen)'); break; }
        let val;
        try { val = evalExpr(q.calc, vars, W); }
        catch (e) { err(w, `calc-Fehler: ${e.message}`); break; }
        if (typeof val !== 'number' || !isFinite(val)) { err(w, `calc liefert keine Zahl: ${val}`); break; }
        if (Math.abs(val - q.loesung) > 1e-6) err(w, `loesung ${q.loesung} ≠ nachgerechnet ${val}`);
        const tol = q.toleranz ?? 0.01;
        if (tol < 0) err(w, 'toleranz negativ');
        // Eingabe-Parser mit deutscher Schreibweise der Lösung testen
        const asText = q.loesung.toLocaleString('de-DE', { maximumFractionDigits: 6 });
        if (Math.abs(parseNumber(asText) - q.loesung) > tol) err(w, `Parser erkennt "${asText}" nicht`);
        if (verbose) console.log(`  ${q.id.padEnd(16)} ${String(q.loesung).padStart(12)}  = ${q.calc}`);
        break;
      }
    }
  }
  for (const k of karten) {
    nKarten++;
    uniq(k.id, rel);
    if (!k.vorne || !k.hinten) err(`${rel} › ${k.id}`, 'vorne/hinten fehlt');
    checkText(`${rel} › ${k.id}`, k.vorne, k.vars || {});
    checkText(`${rel} › ${k.id}`, k.hinten, k.vars || {});
  }
}

// ---------- Formeln ----------
let nFormeln = 0;
for (const { rel, data: g } of formeln) {
  if (!g.titel || !Array.isArray(g.formeln)) { err(rel, 'titel/formeln fehlt'); continue; }
  for (const f of g.formeln) {
    nFormeln++;
    const w = `${rel} › ${f.id}`;
    uniq(f.id, rel);
    if (!f.name || !f.formel) err(w, 'name/formel fehlt');
    if (f.beispiel) {
      const b = f.beispiel;
      checkText(w + ' beispiel', b.text, b.vars || {});
      if (b.calc) {
        try {
          const val = evalExpr(b.calc, b.vars || {}, W);
          if (typeof b.ergebnis === 'number' && Math.abs(val - b.ergebnis) > 1e-6) err(w, `beispiel.ergebnis ${b.ergebnis} ≠ ${val}`);
        } catch (e) { err(w, `beispiel.calc-Fehler: ${e.message}`); }
      }
    }
  }
}

// ---------- Fachaufgabe ----------
for (const { rel, data: d } of fachaufgabe) {
  for (const f of d.fragen || []) uniq(f.id, rel);
}

// ---------- Unit-Tests Rechenfunktionen ----------
function eq(name, a, b) { if (Math.abs(a - b) > 0.005) err('unit', `${name}: ${a} ≠ ${b}`); }
// Brutto 3.000 €, mit Kind, Zusatzbeitrag 2,9 %:
// KV 3000 × (7,3 + 1,45) % = 262,50; PV 3000 × 1,8 % = 54,00; RV 3000 × 9,3 % = 279,00; AV 3000 × 1,3 % = 39,00
const a = svAN(W, 3000, { kinder: 1 });
eq('svAN.kv', a.kv, 262.5); eq('svAN.pv', a.pv, 54); eq('svAN.rv', a.rv, 279); eq('svAN.av', a.av, 39); eq('svAN.summe', a.summe, 634.5);
// kinderlos: PV 2,4 % = 72,00
eq('svAN kinderlos pv', svAN(W, 3000, { kinderlos: true }).pv, 72);
// 3 Kinder: PV 1,8 − 2 × 0,25 = 1,3 % = 39,00
eq('svAN 3 Kinder pv', svAN(W, 3000, { kinder: 3 }).pv, 39);
// über BBG: KV gedeckelt bei 5.812,50 → 5.812,50 × 8,75 % = 508,59
eq('svAN BBG kv', svAN(W, 9000).kv, 508.59);
// RV gedeckelt bei 8.450 → 785,85
eq('svAN BBG rv', svAN(W, 9000).rv, 785.85);
// AG inkl. Insolvenzgeldumlage 0,15 %: 3000 → 4,50
eq('svAG u3', svAG(W, 3000).u3, 4.5);
eq('r2(1.005)', r2(1.005), 1.01);
eq('r2(-2.345)', r2(-2.345), -2.35);
for (const [s, v] of [['1.234,56', 1234.56], ['1234,5', 1234.5], ['1.234', 1234], ['12.5', 12.5], ['-4.500', -4500], ['46 368,40 €', 46368.4], ['6,79 %', 6.79]]) {
  if (Math.abs(parseNumber(s) - v) > 1e-9) err('unit', `parseNumber("${s}") = ${parseNumber(s)} ≠ ${v}`);
}

// Faktor-Hinweis (Tsd. € vs. €, Prozent vs. Dezimal, Kommafehler)
for (const [v, l, f, gross] of [[1115000, 1115, 1000, true], [1.115, 1115, 1000, false], [0.7308, 73.08, 100, false], [151.0, 15.1, 10, true]]) {
  const r = faktorAbweichung(v, l);
  if (!r || r.f !== f || r.zuGross !== gross) err('unit', `faktorAbweichung(${v}, ${l}) = ${JSON.stringify(r)}`);
}
if (faktorAbweichung(1116, 1115) || faktorAbweichung(0, 5)) err('unit', 'faktorAbweichung meldet fälschlich');
if (render('{{x|T€}}', { x: 400 }) !== '400\u00a0Tsd.\u00a0€ (=\u00a0400.000\u00a0€)') err('unit', `T€-Format: ${render('{{x|T€}}', { x: 400 })}`);

// ---------- Ausgabe ----------
for (const w of warnings) console.warn(w);
if (errors.length) {
  for (const e of errors) console.error(e);
  console.error(`\n${errors.length} Fehler. (${themen.length} Themen, ${nFragen} Fragen, davon ${nRechen} Rechenaufgaben, ${nKarten} Karten, ${nFormeln} Formeln)`);
  process.exit(1);
}
console.log(`✓ Inhalte OK: ${themen.length} Themen, ${nFragen} Fragen (${nRechen} Rechenaufgaben nachgerechnet, ${nOffen} offene Aufgaben), ${nKarten} Lernkarten, ${nFormeln} Formeln.`);
