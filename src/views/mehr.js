import { config, werte, firma, profile, aktivesProfil, rebuild } from '../content.js';
import { store } from '../store.js';
import { esc, header, toast, fmtDate, badge2026, icon } from '../ui.js';
import { fmtNumber } from '../lib/template.js';

/** Zusätzliche Menüpunkte (P2/P3-Module tragen sich hier ein). */
export const mehrLinks = [];

export function mehrView(el) {
  const s = store.get();
  const aktiv = aktivesProfil();
  const t = config.termine;
  const fmtWert = (v) => (v.einheit === '%' || v.einheit === '%-Pkt.' ? fmtNumber(v.wert) + ' ' + v.einheit : fmtNumber(v.wert, v.wert % 1 ? 2 : 0) + ' ' + v.einheit);

  el.innerHTML = `
    ${header('Mehr')}
    ${mehrLinks.length ? `<nav class="menu" aria-label="Weitere Funktionen">${[...mehrLinks].sort((a, b) => (a.order || 0) - (b.order || 0)).map((l) => `<a href="${l.href}" class="menu-item">${l.icon || ''}<span><b>${esc(l.label)}</b><small>${esc(l.text || '')}</small></span></a>`).join('')}</nav>` : ''}

    <section class="card">
      <h2 class="h-small">Prüfungsordnung</h2>
      <div class="seg" role="radiogroup" aria-label="Prüfungsordnung">
        ${Object.values(profile).sort((a) => (a.id === 'ao2024' ? -1 : 1)).map((p) => `<button role="radio" aria-checked="${p.id === aktiv.id}" data-profil="${p.id}">${esc(p.kurz)}</button>`).join('')}
      </div>
      <p class="small muted">${esc(aktiv.rechtsgrundlage)}</p>
      <table class="tbl"><thead><tr><th>Prüfungsbereich</th><th>Min.</th><th>Gewicht</th></tr></thead><tbody>
        ${aktiv.bereiche.map((b) => `<tr><td>${esc(b.name)}${b.aufgaben ? `<br><small class="muted">${esc(b.aufgaben)}</small>` : ''}${b.teile ? `<br><small class="muted">${b.teile.map((x) => `${esc(x.name)} ${x.gewicht} %`).join(' · ')}</small>` : ''}</td><td>${b.dauer || '–'}</td><td>${b.gewicht} %</td></tr>`).join('')}
      </tbody></table>
      <details><summary>Bestehensregeln</summary><ul>${aktiv.bestehen.map((r) => `<li>${esc(r)}</li>`).join('')}</ul><p class="small muted">${esc(aktiv.bestehenHinweis || '')}</p></details>
    </section>

    <section class="card">
      <h2 class="h-small">Darstellung</h2>
      <div class="seg" role="radiogroup" aria-label="Farbschema">
        ${[['auto', 'System'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([v, l]) => `<button role="radio" aria-checked="${s.settings.theme === v}" data-theme-set="${v}">${l}</button>`).join('')}
      </div>
      <label class="field">Fragen pro Quiz
        <select id="anz">${[5, 10, 15, 20, 30].map((n) => `<option${n === s.settings.quizAnzahl ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="field">Neue Lernkarten pro Tag
        <select id="neu">${[10, 20, 30, 50, 100].map((n) => `<option${n === s.settings.neueKartenProTag ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
    </section>

    <section class="card">
      <h2 class="h-small">Prüfungstermine</h2>
      <p>${esc(t.schriftlich.label)}: <strong>${fmtDate(t.schriftlich.von)}${t.schriftlich.bis !== t.schriftlich.von ? ' – ' + fmtDate(t.schriftlich.bis) : ''}</strong><br>
      ${esc(t.muendlich.label)}: <strong>${fmtDate(t.muendlich.von)} – ${fmtDate(t.muendlich.bis)}</strong>${t.dokumentation ? `<br>${esc(t.dokumentation.label)}: <strong>${fmtDate(t.dokumentation.von)}</strong> <small class="muted">(${esc(t.dokumentation.hinweis || '')})</small>` : ''}</p>
      <p class="small muted">Änderbar in <code>content/config.json</code> (danach neu veröffentlichen).</p>
    </section>

    <section class="card">
      <h2 class="h-small">Werte 2026 ${badge2026()}</h2>
      <p class="small muted">${esc(werte.hinweis)} Abgerufen: ${fmtDate(werte.abgerufen)}.</p>
      <table class="tbl werte"><tbody>
        ${Object.values(werte.werte).map((v) => `<tr><td>${esc(v.label)}${v.hinweis ? `<br><small class="muted">${esc(v.hinweis)}</small>` : ''}</td><td class="num"><a href="${esc(werte.quellen[v.quelle])}" target="_blank" rel="noopener" title="Quelle">${esc(fmtWert(v))}</a></td></tr>`).join('')}
      </tbody></table>
    </section>

    <section class="card">
      <h2 class="h-small">Modellunternehmen</h2>
      <p><strong>${esc(firma.name)}</strong>, ${esc(firma.sitz)} · ${firma.mitarbeiter} Mitarbeitende · ${esc(firma.branche)}</p>
      <ul>${firma.produkte.map((p) => `<li>${esc(p.name)} – ${esc(p.art)}</li>`).join('')}</ul>
      <p class="small muted">${esc(firma.hinweis)}</p>
    </section>

    <section class="card">
      <h2 class="h-small">Daten</h2>
      <p class="small muted">Dein Lernstand wird nur auf diesem Gerät gespeichert (localStorage).${store.isMemoryOnly() ? ' <strong>Achtung: Speichern ist im Moment nicht möglich (privater Modus?).</strong>' : ''}</p>
      <div class="row-btns"><a class="btn" href="#/daten">Export / Import</a><button class="btn bad" id="reset">Zurücksetzen</button></div>
    </section>
    <p class="small muted center">Kein offizielles Angebot der IHK oder AkA. Eigene Übungsaufgaben ohne Gewähr.</p>`;

  el.addEventListener('click', (e) => {
    const p = e.target.closest('[data-profil]');
    if (p) { store.update((x) => { x.settings.profil = p.dataset.profil; }); rebuild(); toast('Prüfungsordnung: ' + profile[p.dataset.profil].kurz); rerender(); return; }
    const th = e.target.closest('[data-theme-set]');
    if (th) { store.update((x) => { x.settings.theme = th.dataset.themeSet; }); rerender(); return; }
    if (e.target.id === 'reset' && confirm('Gesamten Lernstand (Fortschritt, Fehlerkorb, Karten) löschen? Eigene Fragen bleiben erhalten.')) {
      const eigene = store.get().eigene; const settings = store.get().settings;
      store.reset(); store.update((x) => { x.eigene = eigene; x.settings = settings; });
      toast('Lernstand gelöscht'); rerender();
    }
  });
  el.querySelector('#anz').addEventListener('change', (e) => store.update((x) => { x.settings.quizAnzahl = Number(e.target.value); }));
  el.querySelector('#neu').addEventListener('change', (e) => store.update((x) => { x.settings.neueKartenProTag = Number(e.target.value); }));
}
const rerender = () => window.dispatchEvent(new Event('ik-rerender'));
void icon;
