// Darstellung und Auswertung einer einzelnen Frage (alle 5 Aufgabentypen).
// Wird vom Quiz, Fehlerkorb und der Prüfungssimulation genutzt.
import { esc, rich, plain, shuffle, badge2026 } from '../ui.js';
import { parseNumber, fmtNumber } from '../lib/template.js';
import { config } from '../content.js';
import { faktorAbweichung } from '../lib/calc.js';

export const TYP_LABEL = {
  einfach: 'Einfachauswahl',
  mehrfach: 'Mehrfachauswahl',
  zuordnung: 'Zuordnung',
  reihenfolge: 'Reihenfolge',
  zahl: 'Rechenaufgabe',
  offen: 'Offene Aufgabe',
};

/** Selbstbewertung offener Aufgaben */
export const BEWERTUNG = {
  voll: { label: 'Voll', punkte: 1, ok: true },
  teilweise: { label: 'Teilweise', punkte: 0.5, ok: false },
  nicht: { label: 'Nicht', punkte: 0, ok: false },
};
const BEW_KEYS = ['voll', 'teilweise', 'nicht'];

/** Vorschlag aus abgehakten Bewertungspunkten. */
export function vorschlag(st) {
  const n = st.krit?.length || 0;
  const noetig = st.q.mindestens || st.q.kriterien.length;
  return n >= noetig ? 'voll' : n > 0 ? 'teilweise' : 'nicht';
}

/** Zustand für eine Frage anlegen (mischt Optionen). */
export function prepare(q) {
  const st = { q, revealed: false, ok: null };
  if (q.typ === 'einfach' || q.typ === 'mehrfach') {
    st.perm = q.feste_reihenfolge ? q.optionen.map((_, i) => i) : shuffle(q.optionen.map((_, i) => i));
    st.sel = new Set();
  } else if (q.typ === 'zuordnung') {
    st.rights = shuffle([...new Set(q.paare.map((p) => p[1]))]);
    st.rows = shuffle(q.paare.map((_, i) => i));
    st.sel = {};
  } else if (q.typ === 'reihenfolge') {
    let perm = shuffle(q.elemente.map((_, i) => i));
    if (perm.every((v, i) => v === i)) perm = perm.reverse();
    st.perm = perm;
    st.order = [];
  } else if (q.typ === 'zahl' || q.typ === 'offen') {
    st.value = '';
    if (q.typ === 'offen') { st.krit = []; st.rating = null; }
  }
  return st;
}

export function hasAnswer(st) {
  switch (st.q.typ) {
    case 'einfach': case 'mehrfach': return st.sel.size > 0;
    case 'zuordnung': return Object.keys(st.sel).length === st.q.paare.length;
    case 'reihenfolge': return st.order.length === st.q.elemente.length;
    case 'zahl': return !Number.isNaN(parseNumber(st.value));
    case 'offen': return !!String(st.value || '').trim();
  }
  return false;
}

/** Darf „Prüfen“ gedrückt werden? Offene Aufgaben auch ohne Text (Antwort im Kopf/auf Papier). */
export const canCheck = (st) => st.q.typ === 'offen' || hasAnswer(st);

/** Wertet aus. Liefert {ok, punkte (0..1, Teilpunkte für Simulation)} */
export function evaluate(st) {
  const q = st.q;
  let ok = false, punkte = 0;
  switch (q.typ) {
    case 'einfach': ok = st.sel.has(q.loesung); punkte = ok ? 1 : 0; break;
    case 'mehrfach': {
      const sol = new Set(q.loesung);
      ok = st.sel.size === sol.size && [...st.sel].every((i) => sol.has(i));
      punkte = ok ? 1 : 0;
      break;
    }
    case 'zuordnung': {
      const right = q.paare.filter((p, i) => st.sel[i] === p[1]).length;
      ok = right === q.paare.length; punkte = right / q.paare.length; break;
    }
    case 'reihenfolge': {
      const right = st.order.filter((v, i) => v === i).length;
      ok = right === q.elemente.length; punkte = right / q.elemente.length; break;
    }
    case 'zahl': {
      const v = parseNumber(st.value);
      const tol = q.toleranz ?? config.quiz.toleranzStandard;
      ok = Math.abs(v - q.loesung) <= tol + 1e-9; punkte = ok ? 1 : 0;
      st.faktor = ok ? null : faktorAbweichung(v, q.loesung);
      break;
    }
    case 'offen': {
      const b = BEWERTUNG[st.rating];
      ok = !!b?.ok; punkte = b ? b.punkte : 0;
      st.revealed = true; st.ok = ok; st.punkte = punkte;
      return { ok, punkte, offen: !b };
    }
  }
  st.revealed = true; st.ok = ok; st.punkte = punkte;
  return { ok, punkte };
}

function faktorText(st) {
  const { f, zuGross } = st.faktor;
  const q = st.q;
  const tsd = /Tsd/.test(q.einheit || '') || /T€|Tsd\./.test(q.frage);
  let tipp = 'Kommastelle bzw. Einheit prüfen.';
  if (f === 1000 && tsd) tipp = zuGross ? 'Gefragt ist das Ergebnis in Tsd. € – nicht in vollen Euro.' : 'Prüfe die Einheit: Tsd. € und volle Euro unterscheiden sich um den Faktor 1.000.';
  else if (f === 1000) tipp = 'Tsd. € und volle Euro verwechselt? Die Werte unterscheiden sich um den Faktor 1.000.';
  else if (f === 100 && q.einheit === '%') tipp = zuGross ? 'Prozentwert noch einmal prüfen.' : 'Als Dezimalzahl statt in Prozent geantwortet? Mit 100 multiplizieren.';
  else if (f === 100) tipp = 'Prozent und Dezimalzahl verwechselt oder Komma um zwei Stellen verschoben?';
  return `Fast richtig gerechnet: Dein Ergebnis ist genau um den Faktor ${f.toLocaleString('de-DE')} zu ${zuGross ? 'groß' : 'klein'}. ${tipp}`;
}

const keyHint = (i) => (i < 9 ? `<kbd class="k" aria-hidden="true">${i + 1}</kbd>` : '');

/** HTML für Frage + Eingabebereich. showFeedback=false in der Simulation. */
export function renderQuestion(st, { showFeedback = true } = {}) {
  const q = st.q;
  const rev = st.revealed && showFeedback;
  const v = q.vars || {};
  let body = '';

  if (q.typ === 'einfach' || q.typ === 'mehrfach') {
    const multi = q.typ === 'mehrfach';
    const sol = new Set(multi ? q.loesung : [q.loesung]);
    body = `<div class="opts" role="${multi ? 'group' : 'radiogroup'}" aria-label="Antwortmöglichkeiten">` + st.perm.map((orig, di) => {
      const sel = st.sel.has(orig);
      let cls = sel ? ' sel' : '';
      if (rev) cls += sol.has(orig) ? (sel ? ' right' : ' missed') : sel ? ' wrong' : ' dim';
      return `<button type="button" class="opt${cls}" data-act="opt" data-i="${orig}" role="${multi ? 'checkbox' : 'radio'}" aria-checked="${sel}" ${st.revealed ? 'aria-disabled="true"' : ''}>
        ${keyHint(di)}<span class="mark" aria-hidden="true"></span><span class="opt-text">${rich(q.optionen[orig], v)}</span>
        ${rev && sol.has(orig) ? '<span class="sr-only">(richtig)</span>' : ''}</button>`;
    }).join('') + '</div>';
    if (multi && !st.revealed) body = `<p class="hint">Mehrere Antworten können richtig sein.</p>` + body;
  }

  if (q.typ === 'zuordnung') {
    body = `<div class="match">` + st.rows.map((i) => {
      const [left, right] = q.paare[i];
      const val = st.sel[i] || '';
      const okRow = rev && val === right;
      return `<div class="match-row${rev ? (okRow ? ' right' : ' wrong') : ''}">
        <label for="m-${i}" class="match-left">${esc(plain(left, v))}</label>
        <select id="m-${i}" data-act="match" data-i="${i}" ${st.revealed ? 'disabled' : ''}>
          <option value="">– bitte wählen –</option>
          ${st.rights.map((r) => `<option value="${esc(r)}"${r === val ? ' selected' : ''}>${esc(plain(r, v))}</option>`).join('')}
        </select>
        ${rev && !okRow ? `<div class="match-sol">Richtig: <strong>${esc(plain(right, v))}</strong></div>` : ''}
      </div>`;
    }).join('') + `</div>`;
  }

  if (q.typ === 'reihenfolge') {
    body = `<p class="hint">Tippen Sie die Elemente in der richtigen Reihenfolge an. Erneutes Tippen entfernt die Nummer.</p><div class="opts">` +
      st.perm.map((orig, di) => {
        const pos = st.order.indexOf(orig);
        let cls = pos >= 0 ? ' sel' : '';
        if (rev) cls += pos === orig ? ' right' : ' wrong';
        return `<button type="button" class="opt order${cls}" data-act="order" data-i="${orig}" ${st.revealed ? 'aria-disabled="true"' : ''} aria-label="${esc(plain(q.elemente[orig], v))}${pos >= 0 ? ', Position ' + (pos + 1) : ''}">
          ${keyHint(di)}<span class="num" aria-hidden="true">${pos >= 0 ? pos + 1 : ''}</span><span class="opt-text">${esc(plain(q.elemente[orig], v))}</span>
          ${rev && pos !== orig ? `<span class="sol-pos">→ ${orig + 1}</span>` : ''}</button>`;
      }).join('') + `</div>${!st.revealed && st.order.length ? '<button type="button" class="link-btn" data-act="order-reset">Zurücksetzen</button>' : ''}`;
  }

  if (q.typ === 'zahl') {
    const tol = q.toleranz ?? config.quiz.toleranzStandard;
    body = `<div class="numfield${rev ? (st.ok ? ' right' : ' wrong') : ''}">
      <label for="num-in" class="sr-only">Ihre Lösung${q.einheit ? ' in ' + esc(q.einheit) : ''}</label>
      <input id="num-in" data-act="num" type="text" inputmode="decimal" autocomplete="off" enterkeyhint="done"
        placeholder="Ergebnis" value="${esc(st.value)}" ${st.revealed ? 'readonly' : ''} aria-describedby="num-hint">
      ${q.einheit ? `<span class="unit">${esc(q.einheit)}</span>` : ''}
    </div>
    <p class="hint" id="num-hint">Komma oder Punkt möglich. Toleranz ± ${fmtNumber(tol)}${q.einheit ? ' ' + esc(q.einheit) : ''}.</p>
    ${rev && !st.ok && st.faktor ? `<p class="faktor-hint" role="note">⚠ ${esc(faktorText(st))}</p>` : ''}
    ${rev && !st.ok ? `<p class="sol">Richtige Lösung: <strong>${fmtNumber(q.loesung, Number.isInteger(q.loesung) ? 0 : 2)} ${esc(q.einheit || '')}</strong></p>` : ''}`;
  }

  if (q.typ === 'offen') {
    const ant = String(st.value || '');
    if (!st.revealed || !showFeedback) {
      body = `<label for="txt-in" class="sr-only">Ihre Antwort</label>
        <textarea id="txt-in" data-act="text" rows="7" placeholder="Antwort in Stichpunkten oder ganzen Sätzen …" ${st.revealed ? 'readonly' : ''}>${esc(ant)}</textarea>
        <p class="hint">${q.punkte ? q.punkte + ' Punkte · ' : ''}Danach siehst du die Musterlösung und bewertest dich selbst.</p>`;
    } else {
      const sug = vorschlag(st);
      body = `<div class="own-answer"><div class="q-topic">Deine Antwort</div>${ant.trim() ? `<p class="pre">${esc(ant)}</p>` : '<p class="muted small">(keine schriftliche Antwort)</p>'}</div>
        <div class="muster"><div class="q-topic">Musterlösung – Bewertungspunkte${q.mindestens ? ` (${q.mindestens} von ${q.kriterien.length} genügen)` : ''}</div>
          ${q.musterloesung ? `<p>${rich(q.musterloesung, v)}</p>` : ''}
          <p class="hint">Hake ab, was in deiner Antwort vorkommt:</p>
          <ul class="krit-list">${q.kriterien.map((k, i) => `<li><label class="check"><input type="checkbox" data-act="krit" data-i="${i}" ${st.krit.includes(i) ? 'checked' : ''} ${st.rating ? 'disabled' : ''}><span>${rich(k, v)}</span></label></li>`).join('')}</ul>
        </div>
        <div class="rate-box" role="group" aria-label="Selbstbewertung">
          <div class="q-topic">Selbstbewertung</div>
          <div class="rate-btns">${BEW_KEYS.map((k, i) => `<button type="button" class="btn rate-${k}${st.rating === k ? ' chosen' : ''}${!st.rating && sug === k ? ' suggested' : ''}" data-act="rate" data-v="${k}" ${st.rating ? 'disabled' : ''}>${BEWERTUNG[k].label}${keyHint(i)}</button>`).join('')}</div>
          ${!st.rating ? `<p class="hint">Vorschlag nach deinen Häkchen: <b>${BEWERTUNG[sug].label}</b>. Voll = richtig, Teilweise/Nicht = kommt in den Fehlerkorb.</p>` : ''}
        </div>`;
    }
  }

  return `<div class="q-meta"><span class="badge">${TYP_LABEL[q.typ]}</span>${q.stand2026 ? badge2026() : ''}${q.eigen ? '<span class="badge">eigene</span>' : ''}</div>
    <div class="q-text" id="q-text">${rich(q.frage, v)}</div>
    <div class="q-body">${body}</div>`;
}

export function renderFeedback(st) {
  const q = st.q;
  if (q.typ === 'offen') {
    if (!st.rating) return '';
    const b = BEWERTUNG[st.rating];
    return `<div class="feedback ${b.ok ? 'ok' : st.rating === 'teilweise' ? 'part' : 'bad'}" role="status"><div class="fb-head">Selbstbewertung: ${b.label} (${b.punkte * 100} %)</div>${q.erklaerung ? `<div class="fb-expl">${rich(q.erklaerung, q.vars || {})}</div>` : ''}</div>`;
  }
  return `<div class="feedback ${st.ok ? 'ok' : 'bad'}" role="status">
    <div class="fb-head">${st.ok ? '✓ Richtig!' : '✗ Leider falsch'}</div>
    <div class="fb-expl">${rich(q.erklaerung, q.vars || {})}</div>
  </div>`;
}

/** Interaktion auf ein Element anwenden. Gibt true zurück, wenn neu gerendert werden muss. */
export function handleAction(st, act, i, value) {
  if (st.q.typ === 'offen' && st.revealed && !st.rating) {
    if (act === 'krit') { st.krit = st.krit.includes(i) ? st.krit.filter((x) => x !== i) : [...st.krit, i]; return true; }
    if (act === 'rate' && BEWERTUNG[value]) { st.rating = value; return 'rated'; }
  }
  if (st.revealed) return false;
  if (act === 'text') { st.value = value; return false; }
  const q = st.q;
  if (act === 'opt') {
    if (q.typ === 'einfach') { st.sel = new Set([i]); }
    else { st.sel.has(i) ? st.sel.delete(i) : st.sel.add(i); }
    return true;
  }
  if (act === 'order') {
    const pos = st.order.indexOf(i);
    if (pos >= 0) st.order.splice(pos, 1); else st.order.push(i);
    return true;
  }
  if (act === 'order-reset') { st.order = []; return true; }
  if (act === 'match') { if (value) st.sel[i] = value; else delete st.sel[i]; return false; }
  if (act === 'num') { st.value = value; return false; }
  return false;
}

/** Zifferntasten 1–9 → Option in Anzeigereihenfolge */
export function keyToAction(st, key) {
  const n = Number(key);
  if (!(n >= 1 && n <= 9)) return null;
  if (st.q.typ === 'offen') return st.revealed && !st.rating && n <= 3 ? { act: 'rate', v: BEW_KEYS[n - 1] } : null;
  if ((st.q.typ === 'einfach' || st.q.typ === 'mehrfach' || st.q.typ === 'reihenfolge') && st.perm[n - 1] != null) {
    return { act: st.q.typ === 'reihenfolge' ? 'order' : 'opt', i: st.perm[n - 1] };
  }
  return null;
}

/** Zustand speicherbar machen (Simulation übersteht Neuladen). */
export function serialize(st) {
  return {
    id: st.q.id, perm: st.perm, rows: st.rows, rights: st.rights, order: st.order, value: st.value,
    sel: st.sel instanceof Set ? [...st.sel] : st.sel, flag: !!st.flag, krit: st.krit, rating: st.rating,
  };
}
export function restore(q, d) {
  const st = prepare(q);
  if (!d) return st;
  for (const k of ['perm', 'rows', 'rights', 'order', 'value', 'krit', 'rating']) if (d[k] !== undefined) st[k] = d[k];
  if (d.sel !== undefined) st.sel = Array.isArray(d.sel) ? new Set(d.sel) : d.sel;
  st.flag = !!d.flag;
  return st;
}
/** Punktgewicht in der Simulation: Rechenaufgaben zählen doppelt. */
export const gewicht = (q) => (q.typ === 'offen' ? (q.punkte ? Math.min(6, Math.max(2, q.punkte / 2)) : 3) : q.typ === 'zahl' ? 2 : 1);
