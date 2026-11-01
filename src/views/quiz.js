import { data, aktivesProfil, themenImBereich, mixBereiche, config } from '../content.js';
import { store, recordAnswer } from '../store.js';
import { esc, icon, shuffle, note, header, plain } from '../ui.js';
import { schwachFragen } from './extra/statistik.js';
import { prepare, renderQuestion, renderFeedback, evaluate, canCheck, handleAction, keyToAction } from './question.js';
import { toast } from '../ui.js';

/** Fragen für eine Sitzung zusammenstellen. */
export function selectQuestions(query) {
  const db = data();
  const s = store.get();
  const n = Number(query.n) || s.settings.quizAnzahl || config.quiz.standardAnzahl;
  let pool;
  if (query.schwach) return schwachFragen(n);
  if (query.ids) pool = query.ids.split(',').map((id) => db.fragen.get(id)).filter(Boolean);
  else if (query.modus === 'fehler') pool = Object.keys(s.fehler).map((id) => db.fragen.get(id)).filter(Boolean);
  else if (query.thema) pool = db.themenById.get(query.thema)?.fragen || [];
  else if (query.bereich) pool = themenImBereich(query.bereich).flatMap((t) => t.fragen || []);
  else {
    pool = mixBereiche().flatMap((b) => themenImBereich(b.id)).flatMap((t) => t.fragen || []);
  }
  if (query.thema && (query.modus === 'fehler')) pool = pool.filter((q) => q.thema === query.thema);
  if (query.typ) pool = pool.filter((q) => q.typ === query.typ);

  if (query.alle || query.modus === 'fehler' || query.ids) return shuffle(pool);
  if (!query.thema && !query.typ) {
    const bereiche = query.bereich ? aktivesProfil().bereiche.filter((b) => b.id === query.bereich) : mixBereiche();
    return mischung(bereiche, n);
  }
  return gewichtet(pool, n);
}

/** Gewichtete Zufallsauswahl: falsch beantwortete (3) > neue (2) > richtige (1). */
export function gewichtet(pool, n) {
  const s = store.get();
  return pool.map((q) => {
    const st = s.q[q.id];
    const w = !st ? 2 : st.last ? 1 : 3;
    return { q, k: Math.random() ** (1 / w) };
  }).sort((a, b) => b.k - a.k).slice(0, n).map((x) => x.q);
}

/** Auswahl über mehrere Bereiche (anteilig nach Fragenzahl). Bereiche mit simAnteilOffen
 *  (z. B. MVPK 0,6) erhalten den entsprechenden Anteil offener Aufgaben. */
export function mischung(bereiche, n) {
  const pools = bereiche.map((b) => ({ b, fragen: themenImBereich(b.id).flatMap((t) => t.fragen || []) })).filter((x) => x.fragen.length);
  const total = pools.reduce((s, x) => s + x.fragen.length, 0);
  let rest = n;
  const out = [];
  pools.forEach((x, i) => {
    const k = i === pools.length - 1 ? rest : Math.min(rest, Math.round(n * x.fragen.length / total));
    rest -= k;
    // Bereiche mit festem Anteil offener Aufgaben (MVPK ~60 %), sonst natürliche Mischung
    out.push(...(x.b.simAnteilOffen != null ? auswahlMitOffen(x.fragen, k, x.b.simAnteilOffen, gewichtet) : gewichtet(x.fragen, k)));
  });
  return shuffle(out);
}

/** k Fragen aus pool ziehen, davon Anteil `anteil` vom Typ „offen“ (soweit vorhanden). */
export function auswahlMitOffen(pool, k, anteil, ziehe) {
  const offen = pool.filter((q) => q.typ === 'offen');
  const geb = pool.filter((q) => q.typ !== 'offen');
  let ko = Math.min(offen.length, Math.round(k * anteil));
  let kg = Math.min(geb.length, k - ko);
  ko = Math.min(offen.length, k - kg);
  return [...ziehe(offen, ko), ...ziehe(geb, kg)];
}

function titleFor(query) {
  const db = data();
  if (query.modus === 'fehler') return 'Fehlerkorb';
  if (query.schwach) return 'Schwächste Themen';
  if (query.thema) return db.themenById.get(query.thema)?.titel || 'Quiz';
  if (query.bereich) return aktivesProfil().bereiche.find((b) => b.id === query.bereich)?.kurz || 'Quiz';
  return 'Gemischtes Quiz';
}

export function quizView(el, _params, query) {
  const fragen = selectQuestions(query);
  const title = titleFor(query);
  const back = query.thema ? `#/thema/${query.thema}` : query.modus === 'fehler' ? '#/fehler' : '#/lernen';
  if (!fragen.length) {
    el.innerHTML = `${header(title, back)}<div class="card empty-state"><p>${query.modus === 'fehler' ? 'Der Fehlerkorb ist leer – sehr gut! 🎉' : 'Keine passenden Fragen gefunden.'}</p><a class="btn primary" href="#/lernen">Zu den Themen</a></div>`;
    return;
  }
  const schwelle = config.quiz.fehlerkorbRichtigBisEntfernen;
  const states = fragen.map(prepare);
  let idx = 0;
  const results = [];

  function renderEnd() {
    const richtig = results.filter((r) => r.ok).length;
    const pct = Math.round(richtig / results.length * 100);
    const n = note(pct, config.notenschluessel);
    const falsch = results.filter((r) => !r.ok);
    el.innerHTML = `
      ${header('Ergebnis', back)}
      <div class="card result">
        <div class="result-big">${richtig} / ${results.length}</div>
        <div class="result-sub">${pct} % · IHK-Note ${n.note} (${n.text})</div>
      </div>
      ${falsch.length ? `<section class="card"><h2 class="h-small">Falsch beantwortet (im Fehlerkorb)</h2><ul class="plain-list">${falsch.map((r) => `<li>${esc(plain(r.q.frage, r.q.vars).split('\n')[0].replace(/\*\*/g, '').slice(0, 140))}</li>`).join('')}</ul></section>` : ''}
      <div class="stack">
        ${falsch.length ? `<a class="btn primary big" href="#/quiz?ids=${falsch.map((r) => r.q.id).join(',')}">Falsche sofort wiederholen</a>` : ''}
        <button class="btn big${falsch.length ? '' : ' primary'}" id="again">Neue Runde</button>
        <a class="btn big" href="${back}">Fertig</a>
      </div>`;
    el.querySelector('#again').onclick = () => window.dispatchEvent(new Event('ik-rerender'));
  }

  function render() {
    if (idx >= states.length) { renderEnd(); return; }
    const st = states[idx];
    const t = data().themenById.get(st.q.thema);
    el.innerHTML = `
      <div class="quiz-top">
        <a class="icon-btn" href="${back}" aria-label="Quiz beenden">${icon.x}</a>
        <div class="quiz-progress"><div class="quiz-count">Frage ${idx + 1} von ${states.length}</div>
          <div class="bar thin"><span style="width:${(idx / states.length) * 100}%"></span></div></div>
      </div>
      <h1 class="sr-only">${esc(title)} – Frage ${idx + 1}</h1>
      <p class="q-topic">${esc(t?.titel || '')}</p>
      <article class="question" aria-labelledby="q-text">${renderQuestion(st)}</article>
      <div id="fb">${st.revealed ? renderFeedback(st) : ''}</div>
      <div class="actionbar">
        <button class="btn primary big" id="go" ${(!st.revealed && !canCheck(st)) || wartetAufBewertung(st) ? 'disabled' : ''}>
          ${st.revealed ? (idx + 1 < states.length ? 'Weiter' : 'Auswertung') : st.q.typ === 'offen' ? 'Musterlösung zeigen' : 'Prüfen'} <kbd class="k light" aria-hidden="true">↵</kbd></button>
      </div>`;
    if (wartetAufBewertung(st)) el.querySelector('.muster')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    else if (st.revealed) el.querySelector('#fb .feedback')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    else if (st.q.typ === 'zahl' && matchMedia('(pointer:fine)').matches) el.querySelector('#num-in')?.focus();
  }

  function updateGo() {
    const st = states[idx];
    const go = el.querySelector('#go');
    if (go && !st.revealed) go.disabled = !canCheck(st);
  }

  const wartetAufBewertung = (st) => st.q.typ === 'offen' && st.revealed && !st.rating;

  /** Offene Aufgabe: nach Selbstbewertung werten und speichern. */
  function bewertet(st) {
    const { ok, punkte } = evaluate(st);
    recordAnswer(st.q.id, ok, schwelle, punkte);
    results.push({ q: st.q, ok });
    const y = scrollY; render(); scrollTo(0, y);
    el.querySelector('#fb .feedback')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function go() {
    const st = states[idx];
    if (!st) return;
    if (wartetAufBewertung(st)) { toast('Bitte zuerst selbst bewerten: Voll, Teilweise oder Nicht.'); return; }
    if (!st.revealed && st.q.typ === 'offen') { st.revealed = true; render(); return; }
    if (!st.revealed) {
      if (!canCheck(st)) return;
      const { ok } = evaluate(st);
      recordAnswer(st.q.id, ok, schwelle);
      results.push({ q: st.q, ok });
      render();
      el.querySelector('#go')?.focus({ preventScroll: true });
    } else { idx++; render(); }
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b && b.tagName === 'BUTTON') {
      const r = handleAction(states[idx], b.dataset.act, Number(b.dataset.i), b.dataset.v);
      if (r === 'rated') bewertet(states[idx]);
      else if (r) { const y = scrollY; render(); scrollTo(0, y); }
      return;
    }
    if (e.target.closest('#go')) go();
  });
  el.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.act === 'num') { handleAction(states[idx], 'num', 0, t.value); updateGo(); }
    if (t.dataset.act === 'text') handleAction(states[idx], 'text', 0, t.value);
  });
  el.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.act === 'match') { handleAction(states[idx], 'match', Number(t.dataset.i), t.value); updateGo(); }
    if (t.dataset.act === 'krit') { handleAction(states[idx], 'krit', Number(t.dataset.i)); const y = scrollY; render(); scrollTo(0, y); }
  });

  const onKey = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const st = states[idx];
    if (!st) return;
    if (e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'Enter') {
      if (e.target.tagName === 'BUTTON' && e.target.id !== 'go' && !e.target.closest('.opts')) return;
      if (e.target.tagName === 'SELECT') return;
      e.preventDefault(); go(); return;
    }
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    const a = keyToAction(st, e.key);
    const r = a && handleAction(st, a.act, a.i, a.v);
    if (r === 'rated') { e.preventDefault(); bewertet(st); }
    else if (r) { e.preventDefault(); const y = scrollY; render(); scrollTo(0, y); }
  };
  document.addEventListener('keydown', onKey);
  render();
  return () => document.removeEventListener('keydown', onKey);
}
