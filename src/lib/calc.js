// Rechen-Hilfsfunktionen. Werden in Content-Ausdrücken ({{ … }} und "calc") verwendet
// und von scripts/test-content.mjs zum Nachrechnen genutzt. Keine Browser-Abhängigkeiten.

/** Kaufmännisch runden auf d Nachkommastellen (Standard 2). */
export function r(x, d = 2) {
  const f = 10 ** d;
  return Math.round((x + Math.sign(x) * Number.EPSILON * Math.max(1, Math.abs(x))) * f) / f;
}
export const r2 = (x) => r(x, 2);
export const r0 = (x) => r(x, 0);

/** Werte-Objekt {key: {wert}} → {key: zahl} */
export function flattenWerte(werteJson) {
  const out = {};
  for (const [k, v] of Object.entries(werteJson.werte)) out[k] = v.wert;
  return out;
}

/**
 * Arbeitnehmeranteile zur Sozialversicherung (Monat).
 * opts: zusatz (KV-Zusatzbeitrag gesamt in %), kinderlos (ab 23), kinder (Anzahl Kinder < 25), sachsen
 */
export function svAN(W, brutto, opts = {}) {
  const zusatz = opts.zusatz ?? W.kvZusatzDurchschnitt;
  const bKV = Math.min(brutto, W.bbgKvMonat);
  const bRV = Math.min(brutto, W.bbgRvMonat);
  let pvSatz = opts.sachsen ? W.pv - W.pvSachsenAG : W.pv / 2;
  if (opts.kinderlos) pvSatz += W.pvKinderlosZuschlag;
  const kinder = opts.kinder ?? 0;
  if (!opts.kinderlos && kinder >= 2) pvSatz -= (Math.min(kinder, 5) - 1) * W.pvAbschlagJeKind;
  const kv = r2(bKV * (W.kvAllgemein / 2 + zusatz / 2) / 100);
  const pv = r2(bKV * pvSatz / 100);
  const rv = r2(bRV * (W.rv / 2) / 100);
  const av = r2(bRV * (W.av / 2) / 100);
  return { kv, pv, rv, av, summe: r2(kv + pv + rv + av), pvSatz };
}

/** Arbeitgeberanteile zur Sozialversicherung (ohne U1/U2, mit Insolvenzgeldumlage). */
export function svAG(W, brutto, opts = {}) {
  const zusatz = opts.zusatz ?? W.kvZusatzDurchschnitt;
  const bKV = Math.min(brutto, W.bbgKvMonat);
  const bRV = Math.min(brutto, W.bbgRvMonat);
  const pvSatz = opts.sachsen ? W.pvSachsenAG : W.pv / 2;
  const kv = r2(bKV * (W.kvAllgemein / 2 + zusatz / 2) / 100);
  const pv = r2(bKV * pvSatz / 100);
  const rv = r2(bRV * (W.rv / 2) / 100);
  const av = r2(bRV * (W.av / 2) / 100);
  const u3 = r2(bRV * W.insolvenzgeldumlage / 100);
  return { kv, pv, rv, av, u3, summe: r2(kv + pv + rv + av + u3) };
}

/** Annuitätenfaktor / Barwertfaktoren für Investitionsrechnung */
export const abzinsen = (betrag, i, n) => betrag / (1 + i / 100) ** n;
export const aufzinsen = (betrag, i, n) => betrag * (1 + i / 100) ** n;
export const annuitaet = (k, i, n) => { const q = 1 + i / 100; return k * (q ** n * (q - 1)) / (q ** n - 1); };

/** Kaufmännische Zinsen (30/360) */
export const zinsen = (k, p, tage) => (k * p * tage) / (100 * 360);

/** Scope, der in allen Content-Ausdrücken verfügbar ist. */
export function makeScope(W) {
  return {
    W,
    r, r2, r0,
    min: Math.min, max: Math.max, abs: Math.abs, sqrt: Math.sqrt, pow: Math.pow,
    ceil: Math.ceil, floor: Math.floor,
    svAN: (brutto, opts) => svAN(W, brutto, opts),
    svAG: (brutto, opts) => svAG(W, brutto, opts),
    abzinsen, aufzinsen, annuitaet, zinsen,
    sum: (...a) => a.flat().reduce((s, x) => s + x, 0),
  };
}

/** Erkennt Abweichungen um Faktor 10/100/1.000 (Kommastelle, Tsd. € vs. €, Prozent vs. Dezimalzahl). */
export function faktorAbweichung(v, loesung) {
  if (!Number.isFinite(v) || !v || !loesung) return null;
  const r = v / loesung;
  for (const f of [10, 100, 1000]) {
    if (Math.abs(r / f - 1) < 0.002) return { f, zuGross: true };
    if (Math.abs(r * f - 1) < 0.002) return { f, zuGross: false };
  }
  return null;
}
