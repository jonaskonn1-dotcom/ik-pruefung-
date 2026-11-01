// Prüfungssimulation: echtes Zeitlimit, keine Rückmeldung während der Bearbeitung, Bewertung nach IHK-Notenschlüssel.
import { data, aktivesProfil, themenImBereich, config } from '../../content.js';
import { store, recordAnswer } from '../../store.js';
import { esc, icon, header, shuffle, note, fmtDate, plain } from '../../ui.js';
import { restore, serialize, renderQuestion, renderFeedback, evaluate, hasAnswer, handleAction, keyToAction, gewicht, TYP_LABEL } from '../question.js';
import { mehrLinks } from '../mehr.js';
import { auswahlMitOffen } from '../quiz.js';
import { BEWERTUNG } from '../question.js';

const KURZ_FAKTOR = 0.5;

/** Fragen ziehen: reihum über alle Themen des Bereichs, damit jedes Thema vorkommt. */
function reihum(fragen, k) {
  const nachThema = new Map();
  for (const q of shuffle(fragen)) { if (!nachThema.has(q.thema)) nachThema.set(q.thema, []); nachThema.get(q.thema).push(q); }
  const toepfe = shuffle([...nachThema.values()]);
  const out = [];
  while (out.length < k && toepfe.some((t) => t.length)) {
    for (const t of toepfe) { if (t.length && out.length < k) out.push(t.pop()); }
  }
  return out;
}

function ziehen(bereich, anzahl) {
  const themen = shuffle(themenImBereich(bereich.id).filter((t) => (t.fragen || []).length));
  const pool = themen.flatMap((t) => t.fragen);
  const out = auswahlMitOffen(pool, anzahl, bereich.simAnteilOffen || 0, reihum);
  // Reihenfolge nach Themen gruppieren (wie Handlungssituationen in der Prüfung), gebundene vor offenen
  const order = new Map(themen.map((t, i) => [t.id, i]));
  return out.sort((a, b) => order.get(a.thema) - order.get(b.thema) || (a.typ === 'offen') - (b.typ === 'offen'));
}

/** Punkte, Prozent und Note aus den Einzelergebnissen berechnen. */
function berechne(res) {
  const punkte = res.ergebnisse.reduce((s, r) => s + r.p, 0);
  const max = res.ergebnisse.reduce((s, r) => s + r.g, 0);
  res.punkte = Math.round(punkte * 10) / 10; res.max = max;
  res.prozent = Math.round(punkte / max * 1000) / 10;
  res.note = note(res.prozent, config.notenschluessel).note;
  res.ausstehend = res.ergebnisse.filter((r) => r.pending).length;
  return res;
}

const fmtZeit = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(sec).padStart(2, '0');
};

function setupView(el) {
  const profil = aktivesProfil();
  const s = store.get();
  const lauf = s.simLauf;
  const bereiche = profil.bereiche.filter((b) => b.art === 'schriftlich' && b.simFragen);
  const verlauf = (s.sims || []).filter((x) => x.profil === profil.id).slice(-10).reverse();
  el.innerHTML = `
    ${header('Prüfungssimulation', '#/')}
    ${lauf ? `<div class="card warnbox"><p><strong>Eine Simulation läuft noch</strong> (${esc(lauf.titel)}, Restzeit ${fmtZeit(lauf.ende - Date.now())}).</p>
      <div class="row-btns"><a class="btn primary" href="#/simulation/laufend">Fortsetzen</a><button class="btn bad" id="abbruch">Verwerfen</button></div></div>` : ''}
    <p class="muted">Wie in der echten Prüfung: feste Bearbeitungszeit, keine Lösungen während der Bearbeitung, am Ende Punkte und IHK-Note. Rechenaufgaben zählen doppelt, offene Aufgaben je nach Umfang 2–6 Punkte (Selbstbewertung nach der Abgabe), Zuordnungen und Reihenfolgen geben Teilpunkte. MVPK enthält ca. 60 % offene Aufgaben, WiSo ist wie in der echten Prüfung rein gebunden.</p>
    <div class="stack">
      ${bereiche.map((b) => {
        const n = Math.min(b.simFragen, themenImBereich(b.id).reduce((x, t) => x + (t.fragen || []).length, 0));
        return `<div class="card sim-card">
          <div class="area-top"><span class="area-name">${esc(b.kurz)}</span><span class="area-meta">${b.gewicht} % der Gesamtnote</span></div>
          <p class="small muted">${esc(b.name)}</p>
          <div class="row-btns">
            <button class="btn primary" data-start="${b.id}" ${lauf || !n ? 'disabled' : ''}>${icon.clock} ${b.dauer} Min. · ${n} Fragen</button>
            <button class="btn" data-start="${b.id}" data-kurz="1" ${lauf || !n ? 'disabled' : ''}>Kurz: ${Math.round(b.dauer * KURZ_FAKTOR)} Min. · ${Math.round(n * KURZ_FAKTOR)}</button>
          </div></div>`;
      }).join('')}
    </div>
    ${verlauf.length ? `<h2>Bisherige Simulationen</h2>
      <table class="tbl"><thead><tr><th>Datum</th><th>Bereich</th><th>Punkte</th><th>Note</th></tr></thead><tbody>
      ${verlauf.map((v) => `<tr><td>${fmtDate(v.datum, { day: '2-digit', month: '2-digit' })}</td><td>${esc(v.titel)}</td><td>${v.prozent} %</td><td><b>${v.ausstehend ? '<a href="#/simulation/ergebnis?i=' + (s.sims || []).indexOf(v) + '">bewerten</a>' : v.note}</b></td></tr>`).join('')}
      </tbody></table>` : ''}
    <p class="small muted">Notenschlüssel: ${config.notenschluessel.map((n) => `${n.note} ab ${n.ab}`).join(' · ')} Punkten.</p>`;

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-start]');
    if (b && !b.disabled) {
      const ber = profil.bereiche.find((x) => x.id === b.dataset.start);
      const kurz = !!b.dataset.kurz;
      const anzahl = Math.round(ber.simFragen * (kurz ? KURZ_FAKTOR : 1));
      const fragen = ziehen(ber, anzahl);
      const minuten = Math.round(ber.dauer * (kurz ? KURZ_FAKTOR : 1));
      const states = fragen.map((q) => restore(q));
      store.update((x) => {
        x.simLauf = {
          profil: profil.id, bereich: ber.id, titel: `${ber.kurz}${kurz ? ' (kurz)' : ''}`, minuten,
          start: Date.now(), ende: Date.now() + minuten * 60000, idx: 0, states: states.map(serialize),
        };
      });
      location.hash = '#/simulation/laufend';
    }
    if (e.target.id === 'abbruch' && confirm('Laufende Simulation verwerfen?')) {
      store.update((x) => { delete x.simLauf; });
      window.dispatchEvent(new Event('ik-rerender'));
    }
  });
}

function laufView(el) {
  const lauf = store.get().simLauf;
  if (!lauf) { location.hash = '#/simulation'; return; }
  const db = data();
  const states = lauf.states.map((d) => restore(db.fragen.get(d.id), d)).filter((st) => st.q);
  let idx = Math.min(lauf.idx || 0, states.length - 1);
  let timer;
  let navOpen = false;

  const persist = () => store.update((x) => { if (x.simLauf) { x.simLauf.states = states.map(serialize); x.simLauf.idx = idx; } });

  function render() {
    const st = states[idx];
    const beantwortet = states.filter(hasAnswer).length;
    el.innerHTML = `
      <div class="sim-top">
        <button class="icon-btn" id="pause" aria-label="Simulation verlassen (läuft weiter)">${icon.x}</button>
        <div class="sim-info"><b>${esc(lauf.titel)}</b><span>${beantwortet}/${states.length} beantwortet</span></div>
        <div class="sim-timer" id="timer" role="timer" aria-live="off">${fmtZeit(lauf.ende - Date.now())}</div>
      </div>
      <h1 class="sr-only">Prüfungssimulation – Aufgabe ${idx + 1}</h1>
      <button class="link-btn" id="navtoggle" aria-expanded="${navOpen}">Aufgabe ${idx + 1} von ${states.length} ▾ Übersicht</button>
      ${navOpen ? `<div class="sim-nav" role="list">${states.map((x, i) => `<button role="listitem" class="sim-dot${i === idx ? ' cur' : ''}${hasAnswer(x) ? ' done' : ''}${x.flag ? ' flag' : ''}" data-go="${i}" aria-label="Aufgabe ${i + 1}${hasAnswer(x) ? ', beantwortet' : ''}${x.flag ? ', markiert' : ''}">${i + 1}</button>`).join('')}</div>` : ''}
      <p class="q-topic">${esc(db.themenById.get(st.q.thema)?.titel || '')} · ${gewicht(st.q)} P.</p>
      <article class="question" aria-labelledby="q-text">${renderQuestion(st, { showFeedback: false })}</article>
      <label class="check"><input type="checkbox" id="flag" ${st.flag ? 'checked' : ''}> Zum Überprüfen markieren</label>
      <div class="actionbar sim-actions">
        <button class="btn" id="prev" ${idx === 0 ? 'disabled' : ''} aria-label="Vorherige Aufgabe">‹</button>
        ${idx < states.length - 1 ? `<button class="btn primary" id="next">Weiter <kbd class="k light" aria-hidden="true">↵</kbd></button>` : `<button class="btn primary" id="submit">Abgeben</button>`}
        <button class="btn" id="submit2" aria-label="Simulation abgeben">Abgeben</button>
      </div>`;
  }

  function goTo(i) { idx = Math.max(0, Math.min(states.length - 1, i)); persist(); render(); scrollTo(0, 0); }

  function abgeben(auto) {
    if (!auto) {
      const offen = states.filter((x) => !hasAnswer(x)).length;
      if (!confirm(offen ? `${offen} Aufgabe(n) sind noch unbeantwortet. Trotzdem abgeben?` : 'Simulation jetzt abgeben?')) return;
    }
    clearInterval(timer);
    const schwelle = config.quiz.fehlerkorbRichtigBisEntfernen;
    const ergebnisse = states.map((x) => {
      const beantwortet = hasAnswer(x);
      const g = gewicht(x.q);
      // Offene Aufgaben mit Antwort werden nach der Abgabe selbst bewertet
      if (x.q.typ === 'offen' && beantwortet) return { id: x.q.id, thema: x.q.thema, ok: false, p: 0, g, beantwortet, pending: true, d: serialize(x) };
      const r = beantwortet ? evaluate(x) : (x.revealed = true, x.ok = false, x.punkte = 0, { ok: false, punkte: 0 });
      recordAnswer(x.q.id, r.ok, schwelle, r.punkte);
      return { id: x.q.id, thema: x.q.thema, ok: r.ok, p: r.punkte * g, g, beantwortet, d: serialize(x) };
    });
    const res = berechne({
      datum: new Date().toISOString().slice(0, 10), profil: lauf.profil, bereich: lauf.bereich, titel: lauf.titel,
      dauerMin: Math.round((Math.min(Date.now(), lauf.ende) - lauf.start) / 60000),
      minuten: lauf.minuten, ergebnisse, auto: !!auto,
    });
    store.update((x) => { x.sims = [...(x.sims || []), res].slice(-30); delete x.simLauf; });
    location.hash = '#/simulation/ergebnis';
  }

  function tick() {
    const rest = lauf.ende - Date.now();
    const t = el.querySelector('#timer');
    if (t) { t.textContent = fmtZeit(rest); t.classList.toggle('low', rest < 5 * 60000); }
    if (rest <= 0) { alert('Die Zeit ist abgelaufen. Die Simulation wird abgegeben.'); abgeben(true); }
  }

  el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]');
    if (a && a.tagName === 'BUTTON') { if (handleAction(states[idx], a.dataset.act, Number(a.dataset.i))) { const y = scrollY; persist(); render(); scrollTo(0, y); } return; }
    const g = e.target.closest('[data-go]'); if (g) { navOpen = false; goTo(Number(g.dataset.go)); return; }
    const id = e.target.closest('button')?.id;
    if (id === 'next') goTo(idx + 1);
    else if (id === 'prev') goTo(idx - 1);
    else if (id === 'submit' || id === 'submit2') abgeben(false);
    else if (id === 'navtoggle') { navOpen = !navOpen; render(); }
    else if (id === 'pause') { persist(); location.hash = '#/simulation'; }
  });
  el.addEventListener('change', (e) => {
    if (e.target.id === 'flag') { states[idx].flag = e.target.checked; persist(); return; }
    if (e.target.dataset.act === 'match') { handleAction(states[idx], 'match', Number(e.target.dataset.i), e.target.value); persist(); }
  });
  el.addEventListener('input', (e) => {
    const a = e.target.dataset.act;
    if (a === 'num' || a === 'text') { handleAction(states[idx], a, 0, e.target.value); persist(); if (a === 'text') { const info = el.querySelector('.sim-info span'); if (info) info.textContent = `${states.filter(hasAnswer).length}/${states.length} beantwortet`; } }
  });
  const onKey = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = e.target.tagName;
    if (tag === 'TEXTAREA') return;
    if (e.key === 'Enter' && tag !== 'SELECT' && !(tag === 'BUTTON' && !e.target.closest('.opts'))) { e.preventDefault(); if (idx < states.length - 1) goTo(idx + 1); return; }
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.key === 'ArrowRight') { goTo(idx + 1); return; }
    if (e.key === 'ArrowLeft') { goTo(idx - 1); return; }
    const a = keyToAction(states[idx], e.key);
    if (a && handleAction(states[idx], a.act, a.i)) { e.preventDefault(); persist(); render(); }
  };
  document.addEventListener('keydown', onKey);
  render();
  timer = setInterval(tick, 1000);
  tick();
  return () => { clearInterval(timer); document.removeEventListener('keydown', onKey); };
}

function bewertungView(el, res, simIndex) {
  const db = data();
  const offen = res.ergebnisse.filter((r) => r.pending);
  const r = offen[0];
  const q = db.fragen.get(r.id);
  const st = restore(q, r.d);
  st.revealed = true;
  const nr = res.ergebnisse.indexOf(r) + 1;
  function render() {
    el.innerHTML = `
      ${header('Selbstbewertung', '#/simulation')}
      <p class="muted">Vergleiche deine Antworten mit der Musterlösung. Noch <b>${offen.length}</b> offene Aufgabe(n) zu bewerten – erst danach steht die Note fest.</p>
      ${progressBarSimple((res.ergebnisse.length - offen.length) / res.ergebnisse.length)}
      <p class="q-topic">Aufgabe ${nr} · ${esc(db.themenById.get(q.thema)?.titel || '')} · ${r.g} P.</p>
      <article class="question">${renderQuestion(st)}</article>`;
  }
  el.addEventListener('change', (e) => {
    if (e.target.dataset.act === 'krit') { handleAction(st, 'krit', Number(e.target.dataset.i)); const y = scrollY; render(); scrollTo(0, y); }
  });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act=rate]');
    if (!b) return;
    if (handleAction(st, 'rate', 0, b.dataset.v) !== 'rated') return;
    const bw = BEWERTUNG[st.rating];
    store.update((s) => {
      const x = s.sims[simIndex].ergebnisse.find((y) => y.id === r.id && y.pending);
      x.pending = false; x.ok = bw.ok; x.p = bw.punkte * x.g; x.d = serialize(st);
      berechne(s.sims[simIndex]);
    });
    recordAnswer(q.id, bw.ok, config.quiz.fehlerkorbRichtigBisEntfernen, bw.punkte);
    window.dispatchEvent(new Event('ik-rerender'));
    scrollTo(0, 0);
  });
  render();
}

const progressBarSimple = (f) => `<div class="bar"><span style="width:${Math.round(f * 100)}%"></span></div>`;

function ergebnisView(el, _p, query) {
  const sims = store.get().sims || [];
  const simIndex = query.i != null ? Number(query.i) : sims.length - 1;
  const res = sims[simIndex];
  if (!res) { location.hash = '#/simulation'; return; }
  if (res.ergebnisse.some((r) => r.pending)) return bewertungView(el, res, simIndex);
  const db = data();
  const n = config.notenschluessel.find((x) => x.note === res.note);
  const proThema = new Map();
  for (const r of res.ergebnisse) {
    const t = proThema.get(r.thema) || { p: 0, g: 0, n: 0, ok: 0 };
    t.p += r.p; t.g += r.g; t.n++; if (r.ok) t.ok++;
    proThema.set(r.thema, t);
  }
  const themen = [...proThema].map(([id, t]) => ({ id, titel: db.themenById.get(id)?.titel || id, pct: Math.round(t.p / t.g * 100), ...t })).sort((a, b) => a.pct - b.pct);
  const falsch = res.ergebnisse.filter((r) => !r.ok);
  el.innerHTML = `
    ${header('Ergebnis Simulation', '#/simulation')}
    <div class="card result">
      <div class="result-big">Note ${res.note}</div>
      <div class="result-sub">${res.prozent} von 100 Punkten · ${esc(n?.text || '')}</div>
      <p class="small muted">${esc(res.titel)} · ${res.punkte}/${res.max} Rohpunkte · ${res.dauerMin} von ${res.minuten} Min.${res.auto ? ' · Zeit abgelaufen' : ''}</p>
    </div>
    <section class="card"><h2 class="h-small">Ergebnis nach Thema (schwächste zuerst)</h2>
      ${themen.map((t) => `<div class="thema-row"><span>${esc(t.titel)}</span><span class="num ${t.pct < 50 ? 'bad-t' : t.pct < 67 ? 'mid-t' : 'ok-t'}">${t.pct} %</span>
        <div class="bar"><span style="width:${t.pct}%"></span></div></div>`).join('')}
    </section>
    <div class="stack">
      ${falsch.length ? `<a class="btn primary big" href="#/quiz?ids=${falsch.map((r) => r.id).join(',')}">${falsch.length} falsche Aufgaben mit Lösung üben</a>` : ''}
      <a class="btn big" href="#/simulation">Neue Simulation</a>
    </div>
    <details class="card"><summary>Alle Aufgaben mit Lösungen ansehen</summary>
      <div id="review"></div>
    </details>`;
  const det = el.querySelector('details');
  det.addEventListener('toggle', () => {
    if (!det.open || det.dataset.done) return;
    det.dataset.done = '1';
    el.querySelector('#review').innerHTML = res.ergebnisse.map((r, i) => {
      const q = db.fragen.get(r.id);
      if (!q) return '';
      const st = restore(q, r.d);
      if (r.beantwortet) evaluate(st); else { st.revealed = true; st.ok = false; if (q.typ === 'offen') st.rating = 'nicht'; }
      return `<article class="review-item"><p class="q-topic">Aufgabe ${i + 1} · ${TYP_LABEL[q.typ]} · ${Math.round(r.p * 10) / 10}/${r.g} P.${r.beantwortet ? '' : ' · nicht beantwortet'}</p>
        ${renderQuestion(st)}${renderFeedback(st)}</article>`;
    }).join('<hr>');
  });
  void plain;
}

export function register(addRoute) {
  addRoute({ path: 'simulation', view: setupView, nav: 'lernen' });
  addRoute({ path: 'simulation/laufend', view: laufView, nav: 'lernen', focus: true });
  addRoute({ path: 'simulation/ergebnis', view: ergebnisView, nav: 'lernen' });
  mehrLinks.push({ href: '#/simulation', label: 'Prüfungssimulation', text: 'Mit Zeitlimit und IHK-Note', icon: icon.clock, order: 10 });
}
