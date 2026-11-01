// Lernkarten mit Leitner-System (5 Fächer).
import { data, aktivesProfil, themenImBereich } from '../content.js';
import { store, today, recordCard } from '../store.js';
import { esc, rich, icon, header, progressBar, badge2026 } from '../ui.js';

// Wiederholungsabstand in Tagen je Fach (Fach 1 … 5)
export const INTERVALLE = [0, 1, 3, 7, 16, 35];

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return today(d);
}

function alleKarten(themaId) {
  if (themaId) return data().themenById.get(themaId)?.karten || [];
  const profil = aktivesProfil();
  const ids = new Set(profil.bereiche.flatMap((b) => themenImBereich(b.id)).map((t) => t.id));
  ids.add('eigene');
  return data().themen.filter((t) => ids.has(t.id)).flatMap((t) => t.karten || []);
}

/** Fällige Karten (Wiederholungen) + neue Karten bis zum Tageslimit. */
export function faelligeKarten(themaId) {
  const s = store.get();
  const heute = today();
  const karten = alleKarten(themaId);
  const wdh = karten.filter((k) => s.karten[k.id] && s.karten[k.id].due <= heute);
  const neuHeute = Object.values(s.karten).filter((c) => c.erst === heute).length;
  const limit = themaId ? 999 : Math.max(0, (s.settings.neueKartenProTag ?? 20) - neuHeute);
  const neu = karten.filter((k) => !s.karten[k.id]).slice(0, limit);
  return [...wdh, ...neu];
}

export function bewerten(kid, stufe) {
  store.update((s) => {
    const heute = today();
    const c = s.karten[kid] || { box: 0, due: heute, n: 0, erst: heute };
    c.n++;
    if (stufe === 'nochmal') { c.box = 1; c.due = heute; }
    else if (stufe === 'schwer') { c.box = Math.max(1, c.box); c.due = addDays(heute, 1); }
    else { c.box = Math.min(5, c.box + 1); c.due = addDays(heute, INTERVALLE[c.box]); }
    s.karten[kid] = c;
  });
  recordCard();
}

export function kartenView(el) {
  const s = store.get();
  const profil = aktivesProfil();
  const karten = alleKarten();
  const boxes = [0, 0, 0, 0, 0, 0];
  karten.forEach((k) => boxes[s.karten[k.id]?.box || 0]++);
  const faellig = faelligeKarten().length;
  const themen = profil.bereiche.flatMap((b) => themenImBereich(b.id)).filter((t) => (t.karten || []).length);
  el.innerHTML = `
    ${header('Lernkarten')}
    <div class="card">
      <p><strong>${faellig}</strong> Karten heute fällig · ${karten.length} insgesamt</p>
      <div class="boxes" aria-label="Verteilung auf die Leitner-Fächer">
        ${boxes.map((n, i) => `<div class="box"><div class="box-bar" style="height:${karten.length ? Math.max(4, n / karten.length * 100) : 4}%"></div><b>${n}</b><span>${i === 0 ? 'neu' : 'Fach ' + i}</span></div>`).join('')}
      </div>
      <p class="small muted">Leitner-System: „Gewusst“ schiebt die Karte ein Fach weiter (Wiederholung nach ${INTERVALLE.slice(1).join(' / ')} Tagen), „Nochmal“ zurück in Fach 1.</p>
    </div>
    <a class="btn primary big" href="#/karten/lernen" ${faellig ? '' : 'aria-disabled="true"'}>${icon.cards} ${faellig ? `Jetzt ${faellig} Karten lernen` : 'Heute alles erledigt ✓'}</a>
    <h2>Nach Thema</h2>
    <ul class="topics">${themen.map((t) => {
      const ks = t.karten;
      const gelernt = ks.filter((k) => (s.karten[k.id]?.box || 0) >= 3).length;
      return `<li><a class="topic" href="#/karten/lernen?thema=${t.id}"><span class="topic-main"><span class="topic-group">${esc(t.gruppe || '')}</span><span class="topic-title">${esc(t.titel)}</span>${progressBar(gelernt / ks.length, t.titel)}</span><span class="topic-num">${ks.length}</span></a></li>`;
    }).join('')}</ul>`;
}

export function kartenLernenView(el, _p, query) {
  const themaId = query.thema;
  let queue = faelligeKarten(themaId);
  // Beim Themen-Lernen ohne fällige Karten: alle Karten des Themas üben
  if (!queue.length && themaId) queue = alleKarten(themaId).slice();
  queue = queue.sort(() => Math.random() - 0.5);
  const total = queue.length;
  let done = 0;
  let flipped = false;
  const back = themaId ? `#/thema/${themaId}` : '#/karten';

  function render() {
    if (!queue.length) {
      el.innerHTML = `${header('Lernkarten', back)}<div class="card empty-state"><p>🎉 ${total ? `${total} Karten erledigt.` : 'Keine Karten fällig.'}</p><a class="btn primary" href="${back}">Zurück</a></div>`;
      return;
    }
    const k = queue[0];
    const t = data().themenById.get(k.thema);
    el.innerHTML = `
      <div class="quiz-top">
        <a class="icon-btn" href="${back}" aria-label="Beenden">${icon.x}</a>
        <div class="quiz-progress"><div class="quiz-count">${done} erledigt · ${queue.length} offen</div>
        <div class="bar thin"><span style="width:${total ? done / (done + queue.length) * 100 : 0}%"></span></div></div>
      </div>
      <h1 class="sr-only">Lernkarte</h1>
      <p class="q-topic">${esc(t?.titel || '')} ${k.stand2026 ? badge2026() : ''}</p>
      <button class="flashcard${flipped ? ' flipped' : ''}" id="card" aria-live="polite" aria-label="${flipped ? 'Rückseite' : 'Vorderseite – tippen zum Umdrehen'}">
        ${flipped ? `<div class="fc-front">${rich(k.vorne, k.vars || {})}</div>` : ''}
        <div class="fc-side">${rich(flipped ? k.hinten : k.vorne, k.vars || {})}</div>
        ${flipped ? '' : '<div class="fc-hint">Tippen zum Umdrehen <kbd class="k" aria-hidden="true">Leertaste</kbd></div>'}
      </button>
      <div class="actionbar rate">
        ${flipped
          ? `<button class="btn bad" data-r="nochmal">Nochmal <kbd class="k" aria-hidden="true">1</kbd></button>
             <button class="btn" data-r="schwer">Schwer <kbd class="k" aria-hidden="true">2</kbd></button>
             <button class="btn good" data-r="gewusst">Gewusst <kbd class="k" aria-hidden="true">3</kbd></button>`
          : `<button class="btn primary big" data-r="flip">Antwort zeigen</button>`}
      </div>`;
  }

  function rate(r) {
    if (r === 'flip') { flipped = true; render(); return; }
    if (!flipped) return;
    const k = queue.shift();
    bewerten(k.id, r);
    if (r === 'nochmal') queue.push(k); else done++;
    flipped = false; render();
  }

  el.addEventListener('click', (e) => {
    if (e.target.closest('#card')) { flipped = !flipped; render(); return; }
    const b = e.target.closest('[data-r]');
    if (b) rate(b.dataset.r);
  });
  const onKey = (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!flipped) rate('flip'); else rate('gewusst'); }
    else if (flipped && ['1', '2', '3'].includes(e.key)) rate(['nochmal', 'schwer', 'gewusst'][Number(e.key) - 1]);
  };
  document.addEventListener('keydown', onKey);
  render();
  return () => document.removeEventListener('keydown', onKey);
}
