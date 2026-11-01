// Trainer für die Fachaufgabe im Einsatzgebiet: Checklisten, typische Fachgesprächsfragen mit Notizen, Probe-Timer.
import { fachaufgabe, aktivesProfil } from '../../content.js';
import { store } from '../../store.js';
import { esc, header, icon, progressBar, shuffle } from '../../ui.js';
import { faFortschritt } from '../fortschritt.js';
import { mehrLinks } from '../mehr.js';

const D = () => fachaufgabe[0];
const fa = () => store.get().fa || {};
const setFa = (fn) => store.update((s) => { s.fa ||= {}; s.fa.check ||= {}; s.fa.notizen ||= {}; fn(s.fa); });

const tabs = [['', 'Übersicht'], ['fragen', 'Fachgespräch'], ['timer', 'Probe-Timer']];
const tabNav = (akt) => `<div class="seg" role="tablist" aria-label="Bereiche">${tabs.map(([id, l]) => `<a role="tab" class="seg-link" aria-selected="${akt === id}" href="#/fachaufgabe${id ? '?tab=' + id : ''}">${l}</a>`).join('')}</div>`;

function uebersicht(el) {
  const d = D(); const f = fa();
  const b = aktivesProfil().bereiche.find((x) => x.art === 'muendlich');
  const p = faFortschritt();
  el.innerHTML = `
    ${header('Fachaufgabe', '#/')}
    ${tabNav('')}
    <section class="card">
      <label class="field">Thema meiner Fachaufgabe<input type="text" id="thema" value="${esc(f.thema || '')}" placeholder="z. B. Einführung eines Kanban-Systems für C-Teile"></label>
      <label class="field">Einsatzgebiet<select id="gebiet"><option value="">– wählen –</option>${d.einsatzgebiete.map((g) => `<option${f.gebiet === g ? ' selected' : ''}>${esc(g)}</option>`).join('')}</select></label>
      <label class="field">Kernaussage in zwei Sätzen (für Einstieg und Schluss)<textarea id="pitch" rows="3" placeholder="Ausgangslage, Ziel, Ergebnis …">${esc(f.pitch || '')}</textarea></label>
      ${b ? `<p class="small muted">Gewichtung: ${b.teile.map((t) => `${esc(t.name)} ${t.gewicht} %`).join(' · ')} – zusammen ${b.gewicht} % der Gesamtnote.</p>` : ''}
    </section>
    <section class="card">
      <h2 class="h-small">Fortschritt Checklisten</h2>
      ${progressBar(p.frac, 'Checklisten')}<p class="small muted">${p.text}</p>
    </section>
    ${d.checklisten.map((c) => `<details class="card" ${c.punkte.some((_, i) => !f.check?.[`${c.id}:${i}`]) ? 'open' : ''}><summary>${esc(c.titel)} <span class="muted small">&nbsp;${c.punkte.filter((_, i) => f.check?.[`${c.id}:${i}`]).length}/${c.punkte.length}</span></summary>
      <ul class="checklist">${c.punkte.map((pt, i) => `<li><label class="check"><input type="checkbox" data-check="${c.id}:${i}" ${f.check?.[`${c.id}:${i}`] ? 'checked' : ''}> <span>${esc(pt)}</span></label></li>`).join('')}</ul></details>`).join('')}
    <p class="small muted">${esc(d.hinweis)}</p>`;
  const save = (k) => (e) => setFa((x) => { x[k] = e.target.value; });
  el.querySelector('#thema').addEventListener('input', save('thema'));
  el.querySelector('#pitch').addEventListener('input', save('pitch'));
  el.querySelector('#gebiet').addEventListener('change', save('gebiet'));
  el.addEventListener('change', (e) => {
    const k = e.target.dataset.check;
    if (k) { setFa((x) => { x.check[k] = e.target.checked; }); const s = e.target.closest('details').querySelector('summary .muted'); const all = e.target.closest('ul').querySelectorAll('input'); s.innerHTML = `&nbsp;${[...all].filter((i) => i.checked).length}/${all.length}`; }
  });
}

function fragenTab(el) {
  const d = D(); const f = fa();
  const gebiet = f.gebiet || '';
  const passend = d.fragen.filter((q) => !q.kategorie.startsWith('Einsatzgebiet') || q.kategorie.endsWith(gebiet));
  let reihe = shuffle(passend); let i = 0;
  const kats = [...new Set(passend.map((q) => q.kategorie))];
  function render() {
    const q = reihe[i];
    el.innerHTML = `
      ${header('Fachaufgabe', '#/')}
      ${tabNav('fragen')}
      <p class="muted small">Zufällige Fragen wie im Fachgespräch${gebiet ? ` (inkl. Einsatzgebiet ${esc(gebiet)})` : ' – Einsatzgebiet in der Übersicht wählen für passende Zusatzfragen'}. Antworte laut, notiere Stichpunkte.</p>
      <article class="card fa-q">
        <p class="q-topic">${esc(q.kategorie)} · ${i + 1}/${reihe.length}</p>
        <p class="fa-frage">${esc(q.frage)}</p>
        <details><summary>Tipp</summary><p>${esc(q.tipp)}</p></details>
        <label class="field">Meine Stichpunkte<textarea id="notiz" rows="4" placeholder="Antwort-Stichpunkte für meine Fachaufgabe …">${esc(f.notizen?.[q.id] || '')}</textarea></label>
      </article>
      <div class="row-btns"><button class="btn" id="prev" ${i === 0 ? 'disabled' : ''}>‹ Zurück</button><button class="btn primary" id="next">Weiter ›</button></div>
      <details class="card"><summary>Alle Fragen und Notizen</summary>
        ${kats.map((k) => `<h3 class="h-small">${esc(k)}</h3><ul class="plain-list">${passend.filter((x) => x.kategorie === k).map((x) => `<li>${esc(x.frage)}${f.notizen?.[x.id] ? `<br><span class="small muted">→ ${esc(f.notizen[x.id])}</span>` : ''}</li>`).join('')}</ul>`).join('')}
      </details>`;
    el.querySelector('#notiz').addEventListener('input', (e) => setFa((x) => { x.notizen[q.id] = e.target.value; }));
    el.querySelector('#next').onclick = () => { i = (i + 1) % reihe.length; if (i === 0) reihe = shuffle(passend); render(); };
    el.querySelector('#prev').onclick = () => { i = Math.max(0, i - 1); render(); };
  }
  render();
}

function timerTab(el) {
  const d = D();
  let modus = 'praes';
  const dauer = { praes: 10 * 60, fg: 20 * 60 };
  let start = null, vergangen = 0, interval = null, frage = null;
  const lauf = () => vergangen + (start ? (Date.now() - start) / 1000 : 0);
  const fmt = (s) => `${s < 0 ? '+' : ''}${Math.floor(Math.abs(s) / 60)}:${String(Math.floor(Math.abs(s) % 60)).padStart(2, '0')}`;
  const neueFrage = () => { frage = shuffle(d.fragen)[0]; };

  function render() {
    const rest = dauer[modus] - lauf();
    const anteil = Math.min(1, lauf() / dauer[modus]);
    const cls = rest < 0 ? 'over' : rest < 60 ? 'low' : rest < 120 ? 'mid' : '';
    el.innerHTML = `
      ${header('Fachaufgabe', '#/')}
      ${tabNav('timer')}
      <div class="seg" role="radiogroup" aria-label="Modus">
        <button role="radio" aria-checked="${modus === 'praes'}" data-m="praes">Präsentation 10 Min.</button>
        <button role="radio" aria-checked="${modus === 'fg'}" data-m="fg">Fachgespräch 20 Min.</button>
      </div>
      <div class="card big-timer ${cls}">
        <div class="bt-zeit" role="timer" aria-live="off" id="bt">${fmt(rest)}</div>
        <div class="bt-sub">${rest < 0 ? 'Zeit überschritten' : modus === 'praes' ? (lauf() < 30 ? 'Einstieg: Wer, was, warum?' : rest < 120 ? 'Zum Schluss kommen: Ergebnis + Reflexion' : 'Hauptteil: Vorgehen und Entscheidungen') : 'Fachgespräch läuft'}</div>
        ${progressBar(anteil, 'Zeit')}
      </div>
      <div class="row-btns">
        <button class="btn primary big" id="startstop">${start ? 'Pause' : lauf() > 0 ? 'Weiter' : 'Start'}</button>
        <button class="btn big" id="reset">Zurücksetzen</button>
      </div>
      ${modus === 'fg' ? `<article class="card fa-q"><p class="q-topic">Frage des Prüfungsausschusses</p><p class="fa-frage">${esc(frage?.frage || 'Start drücken – dann erscheint die erste Frage.')}</p>
        <button class="btn" id="nf" ${frage ? '' : 'disabled'}>Nächste Frage</button></article>` : `<p class="small muted">Ziel: 9:30 bis 10:00 Minuten. Bei 2 Minuten Restzeit wird die Anzeige gelb, bei 1 Minute rot; auf dem Handy vibriert es kurz.</p>`}`;
  }
  let vib2 = false, vib1 = false;
  function tick() {
    const rest = dauer[modus] - lauf();
    if (navigator.vibrate) { if (!vib2 && rest < 120 && rest > 119) { navigator.vibrate(200); vib2 = true; } if (!vib1 && rest <= 0) { navigator.vibrate([200, 100, 200]); vib1 = true; } }
    const t = el.querySelector('#bt'); if (t) t.textContent = fmt(rest);
    const box = el.querySelector('.big-timer'); if (box) { box.classList.toggle('over', rest < 0); box.classList.toggle('low', rest >= 0 && rest < 60); box.classList.toggle('mid', rest >= 60 && rest < 120); }
    const bar = el.querySelector('.big-timer .bar span'); if (bar) bar.style.width = Math.min(100, lauf() / dauer[modus] * 100) + '%';
  }
  el.addEventListener('click', (e) => {
    const m = e.target.closest('[data-m]');
    if (m) { modus = m.dataset.m; start = null; vergangen = 0; frage = null; clearInterval(interval); render(); return; }
    const id = e.target.closest('button')?.id;
    if (id === 'startstop') {
      if (start) { vergangen = lauf(); start = null; clearInterval(interval); }
      else { start = Date.now(); if (modus === 'fg' && !frage) neueFrage(); interval = setInterval(tick, 250); vib1 = vib2 = false; }
      render();
    } else if (id === 'reset') { start = null; vergangen = 0; frage = null; clearInterval(interval); render(); }
    else if (id === 'nf') { neueFrage(); render(); }
  });
  render();
  return () => clearInterval(interval);
}

function view(el, _p, query) {
  if (query.tab === 'fragen') return fragenTab(el);
  if (query.tab === 'timer') return timerTab(el);
  return uebersicht(el);
}

export function register(addRoute) {
  addRoute({ path: 'fachaufgabe', view, nav: 'mehr' });
  mehrLinks.push({ href: '#/fachaufgabe', label: 'Fachaufgaben-Trainer', text: 'Checklisten, Fachgesprächsfragen, 10-Minuten-Timer', icon: icon.mic, order: 15 });
}
