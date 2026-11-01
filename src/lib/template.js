// Auswertung von Ausdrücken in Content-Texten: {{ ausdruck }} oder {{ ausdruck | format }}
// Formate: €  → 1.234,56 €   |  %  → 12,5 %   |  n0 / n1 / n2 … → feste Nachkommastellen
//          (ohne Format: bis zu 2 Nachkommastellen)
import { makeScope } from './calc.js';

const fnCache = new Map();

export function evalExpr(expr, vars = {}, W = {}) {
  const scope = { ...makeScope(W), ...vars };
  const keys = Object.keys(scope);
  const cacheKey = keys.join(',') + '§' + expr;
  let fn = fnCache.get(cacheKey);
  if (!fn) {
    // eslint-disable-next-line no-new-func
    fn = new Function(...keys, `"use strict"; return (${expr});`);
    fnCache.set(cacheKey, fn);
  }
  return fn(...keys.map((k) => scope[k]));
}

export function fmtNumber(x, decimals) {
  if (typeof x !== 'number' || !isFinite(x)) return String(x);
  const opts = decimals == null
    ? { minimumFractionDigits: 0, maximumFractionDigits: 2 }
    : { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
  return x.toLocaleString('de-DE', opts);
}

export function fmt(x, format) {
  switch ((format || '').trim()) {
    case '€': return fmtNumber(x, 2) + ' €';
    case '%': return fmtNumber(x) + ' %';
    case '': return typeof x === 'number' ? fmtNumber(x) : String(x);
    default: {
      const m = /^n(\d)$/.exec(format.trim());
      if (m) return fmtNumber(x, Number(m[1]));
      return String(x);
    }
  }
}

/** Ersetzt alle {{…}} in text. */
export function render(text, vars = {}, W = {}) {
  if (typeof text !== 'string' || !text.includes('{{')) return text;
  return text.replace(/\{\{([\s\S]+?)\}\}/g, (_, inner) => {
    const i = inner.lastIndexOf('|');
    let expr = inner, format = '';
    // "|" nur als Format-Trenner werten, wenn rechts ein bekanntes Format steht (kein ||)
    if (i > 0 && inner[i - 1] !== '|' && /^\s*(€|%|n\d)\s*$/.test(inner.slice(i + 1))) {
      expr = inner.slice(0, i); format = inner.slice(i + 1);
    }
    return fmt(evalExpr(expr.trim(), vars, W), format);
  });
}

/** Zahleneingabe deutsch/englisch tolerant parsen. */
export function parseNumber(str) {
  if (str == null) return NaN;
  let s = String(str).trim().replace(/[\s €%]/g, '').replace(/^\+/, '').replace(/−/g, '-');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return n;
}
