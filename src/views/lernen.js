import { data, aktivesProfil, themenImBereich, bereichVonThema } from '../content.js';
import { store } from '../store.js';
import { esc, progressBar, icon, header, plain } from '../ui.js';
import { faelligeKarten } from './karten.js';

export function themaFortschritt(t) {
  const s = store.get();
  const fragen = t.fragen || [];
  const sicher = fragen.filter((q) => s.q[q.id]?.last).length;
  return { sicher, gesamt: fragen.length, frac: fragen.length ? sicher / fragen.length : 0 };
}

export function lernenView(el, _p, query) {
  const profil = aktivesProfil();
  const s = store.get();
  const fehler = Object.keys(s.fehler).filter((id) => data().fragen.has(id)).length;
  const sections = profil.bereiche.filter((b) => b.art !== 'muendlich').map((b) => {
    const themen = themenImBereich(b.id);
    const list = themen.length
      ? themen.map((t) => {
          const p = themaFortschritt(t);
          return `<li><a class="topic" href="#/thema/${t.id}">
            <span class="topic-main"><span class="topic-group">${esc(t.gruppe || '')}</span><span class="topic-title">${esc(t.titel)}</span>
            ${progressBar(p.frac, t.titel)}</span>
            <span class="topic-num">${p.sicher}/${p.gesamt}</span></a></li>`;
        }).join('')
      : `<li class="muted empty">Noch keine Themen in diesem Bereich.</li>`;
    return `<section class="bereich${query.bereich === b.id ? ' hl' : ''}" id="b-${b.id}" aria-labelledby="h-${b.id}">
      <div class="section-head"><h2 id="h-${b.id}">${esc(b.kurz)} <span class="muted">· ${b.dauer} Min. · ${b.gewicht} %</span></h2>
      ${themen.length ? `<a class="small-link" href="#/quiz?bereich=${b.id}">Quiz ${esc(b.kurz)}</a>` : ''}</div>
      <p class="muted small">${esc(b.name)}${b.hinweis ? ' – ' + esc(b.hinweis) : ''}</p>
      <ul class="topics">${list}</ul></section>`;
  }).join('');

  const eigen = data().themenById.get('eigene');
  el.innerHTML = `
    ${header('Quiz & Themen')}
    <div class="row-btns">
      <a class="btn primary" href="#/quiz?modus=mix">${icon.quiz} Gemischt (${s.settings.quizAnzahl})</a>
      <a class="btn" href="#/fehler">${icon.basket} Fehlerkorb (${fehler})</a>
    </div>
    ${sections}
    ${eigen ? `<section><h2>Eigene</h2><ul class="topics"><li><a class="topic" href="#/thema/eigene"><span class="topic-main"><span class="topic-title">${esc(eigen.titel)}</span></span><span class="topic-num">${eigen.fragen.length}</span></a></li></ul></section>` : ''}`;

  if (query.bereich) document.getElementById('b-' + query.bereich)?.scrollIntoView({ block: 'start' });
}

export function themaView(el, { id }) {
  const t = data().themenById.get(id);
  if (!t) { el.innerHTML = header('Thema nicht gefunden', '#/lernen'); return; }
  const p = themaFortschritt(t);
  const b = bereichVonThema(t);
  const nZahl = (t.fragen || []).filter((q) => q.typ === 'zahl').length;
  const faellig = faelligeKarten(t.id).length;
  const fehler = (t.fragen || []).filter((q) => store.get().fehler[q.id]).length;
  el.innerHTML = `
    ${header(t.titel, '#/lernen')}
    <p class="muted">${b ? esc(b.kurz) + ' · ' : ''}${esc(t.beschreibung || '')}</p>
    <div class="card">
      ${progressBar(p.frac, t.titel)}
      <p class="small muted">${p.sicher} von ${p.gesamt} Fragen sicher beantwortet · ${(t.karten || []).length} Lernkarten (${faellig} fällig)</p>
    </div>
    <div class="stack">
      <a class="btn primary big" href="#/quiz?thema=${t.id}">${icon.quiz} Quiz starten</a>
      <a class="btn big" href="#/quiz?thema=${t.id}&alle=1">Alle ${p.gesamt} Fragen</a>
      ${nZahl ? `<a class="btn big" href="#/quiz?thema=${t.id}&typ=zahl&alle=1">Nur Rechenaufgaben (${nZahl})</a>` : ''}
      ${fehler ? `<a class="btn big" href="#/quiz?modus=fehler&thema=${t.id}">${icon.basket} Fehler wiederholen (${fehler})</a>` : ''}
      <a class="btn big" href="#/karten/lernen?thema=${t.id}">${icon.cards} Lernkarten</a>
    </div>
    <details class="card"><summary>Alle Fragen ansehen</summary>
      <ol class="qlist">${(t.fragen || []).map((q) => {
        const st = store.get().q[q.id];
        return `<li><span class="dot ${st ? (st.last ? 'ok' : 'bad') : ''}" aria-label="${st ? (st.last ? 'zuletzt richtig' : 'zuletzt falsch') : 'noch nicht beantwortet'}"></span>${esc(plain(q.frage, q.vars).split('\n')[0].slice(0, 140))}</li>`;
      }).join('')}</ol>
    </details>`;
}
