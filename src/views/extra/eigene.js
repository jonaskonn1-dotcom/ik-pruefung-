// Eigene Fragen und Lernkarten anlegen (gespeichert im Lernstand, mit Export/Import übertragbar).
import { data, rebuild } from '../../content.js';
import { store } from '../../store.js';
import { esc, header, icon, toast } from '../../ui.js';
import { parseNumber } from '../../lib/template.js';
import { mehrLinks } from '../mehr.js';

function view(el, _p, query) {
  const art = query.art === 'karte' ? 'karte' : 'frage';
  const eig = store.get().eigene || { fragen: [], karten: [] };
  const themen = data().themen.filter((t) => !t.eigen);
  const themaSelect = `<label class="field">Thema<select name="thema"><option value="eigene">Eigene (ohne Zuordnung)</option>${themen.map((t) => `<option value="${t.id}">${esc(t.titel)}</option>`).join('')}</select></label>`;
  const titel = (t) => data().themenById.get(t)?.titel || 'Eigene';

  el.innerHTML = `
    ${header('Eigene Fragen & Karten', '#/mehr')}
    <div class="seg" role="tablist"><a role="tab" class="seg-link" aria-selected="${art === 'frage'}" href="#/eigene">Frage</a><a role="tab" class="seg-link" aria-selected="${art === 'karte'}" href="#/eigene?art=karte">Lernkarte</a></div>
    <form class="card" id="f" autocomplete="off">
      ${themaSelect}
      ${art === 'frage' ? `
        <label class="field">Fragetyp<select name="typ"><option value="einfach">Einfachauswahl</option><option value="mehrfach">Mehrfachauswahl</option><option value="zahl">Rechenaufgabe (Zahl)</option></select></label>
        <label class="field">Frage<textarea name="frage" rows="3" required></textarea></label>
        <div id="opts">
          ${[0, 1, 2, 3].map((i) => `<div class="opt-edit"><label class="check"><input type="checkbox" name="richtig" value="${i}" aria-label="Antwort ${i + 1} ist richtig"></label><input type="text" name="opt${i}" placeholder="Antwort ${i + 1}${i < 2 ? '' : ' (optional)'}"></div>`).join('')}
          <p class="small muted">Häkchen = richtige Antwort(en).</p>
        </div>
        <div id="zahl" hidden>
          <label class="field">Lösung<input type="text" name="loesung" inputmode="decimal"></label>
          <div class="row-btns"><label class="field">Einheit<input type="text" name="einheit" placeholder="€, %, Stück"></label><label class="field">Toleranz<input type="text" name="toleranz" inputmode="decimal" value="0,01"></label></div>
        </div>
        <label class="field">Erklärung / Lösungsweg<textarea name="erklaerung" rows="3"></textarea></label>`
      : `
        <label class="field">Vorderseite<textarea name="vorne" rows="2" required></textarea></label>
        <label class="field">Rückseite<textarea name="hinten" rows="4" required></textarea></label>`}
      <p class="small muted">Tipp: <code>**fett**</code> und Zeilen mit <code>- </code> werden als Liste dargestellt.</p>
      <button class="btn primary big" type="submit">${icon.plus} Speichern</button>
    </form>
    <section>
      <h2>Gespeichert (${eig.fragen.length} Fragen, ${eig.karten.length} Karten)</h2>
      ${eig.fragen.length ? `<a class="btn" href="#/quiz?ids=${eig.fragen.map((q) => q.id).join(',')}">Eigene Fragen üben</a>` : ''}
      <ul class="plain-list eigene-list">
        ${eig.fragen.map((q) => `<li><b>${esc(q.frage.slice(0, 90))}</b><br><span class="small muted">${esc(titel(q.thema))} · ${q.typ}</span> <button class="link-btn" data-del-f="${q.id}">Löschen</button></li>`).join('')}
        ${eig.karten.map((k) => `<li><b>${esc(k.vorne.slice(0, 90))}</b><br><span class="small muted">Karte · ${esc(titel(k.thema))}</span> <button class="link-btn" data-del-k="${k.id}">Löschen</button></li>`).join('')}
      </ul>
    </section>`;

  const f = el.querySelector('#f');
  const typSel = f.querySelector('[name=typ]');
  typSel?.addEventListener('change', () => {
    const z = typSel.value === 'zahl';
    el.querySelector('#opts').hidden = z; el.querySelector('#zahl').hidden = !z;
  });

  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(f);
    const id = 'eigen-' + Date.now().toString(36);
    const thema = fd.get('thema');
    if (art === 'karte') {
      const k = { id, thema, vorne: fd.get('vorne').trim(), hinten: fd.get('hinten').trim() };
      store.update((s) => { s.eigene.karten.push(k); });
    } else {
      const typ = fd.get('typ');
      const q = { id, thema, typ, frage: fd.get('frage').trim(), erklaerung: fd.get('erklaerung').trim() || 'Keine Erklärung hinterlegt.' };
      if (typ === 'zahl') {
        q.loesung = parseNumber(fd.get('loesung'));
        q.einheit = fd.get('einheit').trim();
        q.toleranz = parseNumber(fd.get('toleranz')) || 0;
        if (!Number.isFinite(q.loesung)) { toast('Bitte eine gültige Lösung als Zahl eingeben.'); return; }
      } else {
        const opts = [0, 1, 2, 3].map((i) => ({ i, t: (fd.get('opt' + i) || '').trim() })).filter((o) => o.t);
        const richtig = fd.getAll('richtig').map(Number);
        if (opts.length < 2) { toast('Mindestens zwei Antworten eingeben.'); return; }
        q.optionen = opts.map((o) => o.t);
        const idx = opts.map((o, n) => (richtig.includes(o.i) ? n : -1)).filter((n) => n >= 0);
        if (!idx.length) { toast('Bitte mindestens eine richtige Antwort ankreuzen.'); return; }
        if (typ === 'einfach' && idx.length > 1) { toast('Einfachauswahl: genau eine richtige Antwort.'); return; }
        q.loesung = typ === 'einfach' ? idx[0] : idx;
      }
      store.update((s) => { s.eigene.fragen.push(q); });
    }
    rebuild(); toast('Gespeichert'); window.dispatchEvent(new Event('ik-rerender'));
  });

  el.addEventListener('click', (e) => {
    const df = e.target.dataset.delF, dk = e.target.dataset.delK;
    if (!df && !dk) return;
    if (!confirm('Eintrag löschen?')) return;
    store.update((s) => {
      if (df) { s.eigene.fragen = s.eigene.fragen.filter((q) => q.id !== df); delete s.q[df]; delete s.fehler[df]; }
      if (dk) { s.eigene.karten = s.eigene.karten.filter((k) => k.id !== dk); delete s.karten[dk]; }
    });
    rebuild(); window.dispatchEvent(new Event('ik-rerender'));
  });
}

export function register(addRoute) {
  addRoute({ path: 'eigene', view, nav: 'mehr' });
  mehrLinks.push({ href: '#/eigene', label: 'Eigene Fragen & Karten', text: 'Selbst Inhalte ergänzen', icon: icon.plus, order: 28 });
}
