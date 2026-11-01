// Sicherung & Gerätewechsel: Lernstand als JSON exportieren / importieren (zusammenführen oder ersetzen).
import { store, today } from '../../store.js';
import { rebuild } from '../../content.js';
import { esc, header, toast, icon, fmtDate } from '../../ui.js';
import { mergeState, parseExport, EXPORT_APP } from '../../lib/merge.js';
import { mehrLinks } from '../mehr.js';

function zusammenfassung(st) {
  const tage = Object.keys(st.tage || {}).sort();
  return {
    fragen: Object.keys(st.q || {}).length,
    karten: Object.keys(st.karten || {}).length,
    fehler: Object.keys(st.fehler || {}).length,
    sims: (st.sims || []).length,
    eigene: (st.eigene?.fragen?.length || 0) + (st.eigene?.karten?.length || 0),
    zuletzt: tage[tage.length - 1],
  };
}

const zeile = (z) => `${z.fragen} Fragen beantwortet · ${z.karten} Karten · ${z.fehler} im Fehlerkorb · ${z.sims} Simulationen${z.eigene ? ` · ${z.eigene} eigene Inhalte` : ''}${z.zuletzt ? ` · zuletzt aktiv ${fmtDate(z.zuletzt, { day: '2-digit', month: '2-digit', year: 'numeric' })}` : ''}`;

function exportDatei() {
  const s = store.get();
  const daten = { ...s };
  delete daten.simLauf; // laufende Simulation nicht mitnehmen
  const json = JSON.stringify({ app: EXPORT_APP, version: 1, exportiert: new Date().toISOString(), daten }, null, 1);
  const name = `ik-lernstand-${today()}.json`;
  return { json, name, file: new File([json], name, { type: 'application/json' }) };
}

function view(el) {
  const s = store.get();
  const z = zusammenfassung(s);
  const letzter = s.settings.letzterExport;
  const kannTeilen = typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] });
  el.innerHTML = `
    ${header('Sicherung & Gerätewechsel', '#/mehr')}
    <p class="muted">Der Lernstand liegt nur im Browser dieses Geräts. Mit einer Sicherungsdatei kannst du ihn auf ein anderes Gerät übertragen (z. B. Handy ↔ Mac) oder sichern.</p>
    <section class="card">
      <h2 class="h-small">1. Auf diesem Gerät exportieren</h2>
      <p class="small">${zeile(z)}</p>
      <div class="stack">
        ${kannTeilen ? `<button class="btn primary big" id="share">${icon.plus} Teilen (AirDrop, Mail, Dateien …)</button>` : ''}
        <button class="btn big${kannTeilen ? '' : ' primary'}" id="download">Sicherungsdatei herunterladen</button>
      </div>
      <p class="small muted">${letzter ? `Letzter Export: ${fmtDate(letzter.slice(0, 10))}` : 'Noch nie exportiert.'}</p>
    </section>
    <section class="card">
      <h2 class="h-small">2. Auf dem anderen Gerät importieren</h2>
      <label class="btn big file-btn">Sicherungsdatei auswählen<input type="file" id="file" accept="application/json,.json"></label>
      <div id="preview" aria-live="polite"></div>
    </section>
    <details class="card"><summary>So funktioniert das Zusammenführen</summary>
      <ul class="small">
        <li>Pro Frage gilt die <strong>neuere</strong> Antwort – egal, auf welchem Gerät.</li>
        <li>Lernkarten: der Stand mit mehr Wiederholungen gewinnt.</li>
        <li>Simulationen, eigene Fragen und Tagesstatistik werden vereinigt.</li>
        <li>Einstellungen (z. B. Dunkelmodus) bleiben pro Gerät.</li>
        <li>Tipp: Vor jedem Gerätewechsel exportieren, auf dem anderen Gerät „Zusammenführen“ wählen.</li>
      </ul>
    </details>`;

  const merkeExport = () => store.update((x) => { x.settings.letzterExport = new Date().toISOString(); });

  el.querySelector('#download').addEventListener('click', () => {
    const { json, name } = exportDatei();
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    merkeExport(); toast('Sicherung gespeichert: ' + name);
  });
  el.querySelector('#share')?.addEventListener('click', async () => {
    const { file } = exportDatei();
    try { await navigator.share({ files: [file], title: 'IK-Trainer Lernstand' }); merkeExport(); toast('Sicherung geteilt'); }
    catch (e) { if (e.name !== 'AbortError') toast('Teilen nicht möglich – bitte herunterladen.'); }
  });

  el.querySelector('#file').addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    const prev = el.querySelector('#preview');
    if (!f) return;
    let fremd;
    try { fremd = parseExport(await f.text()); }
    catch (err) { prev.innerHTML = `<p class="feedback bad">${esc(err.message)}</p>`; return; }
    const zf = zusammenfassung(fremd);
    prev.innerHTML = `
      <p class="small"><strong>Datei:</strong> ${esc(f.name)}<br>${zeile(zf)}</p>
      <div class="stack">
        <button class="btn primary big" id="merge">Zusammenführen (empfohlen)</button>
        <button class="btn bad" id="replace">Lernstand dieses Geräts ersetzen</button>
      </div>`;
    prev.querySelector('#merge').onclick = () => {
      store.replace(mergeState(store.get(), fremd)); rebuild();
      toast('Lernstände zusammengeführt'); window.dispatchEvent(new Event('ik-rerender'));
    };
    prev.querySelector('#replace').onclick = () => {
      if (!confirm('Den gesamten Lernstand dieses Geräts durch die Datei ersetzen?')) return;
      const keep = { settings: store.get().settings };
      store.replace({ ...fremd, ...keep }); rebuild();
      toast('Lernstand ersetzt'); window.dispatchEvent(new Event('ik-rerender'));
    };
  });
}

export function register(addRoute) {
  addRoute({ path: 'daten', view, nav: 'mehr' });
  mehrLinks.push({ href: '#/daten', label: 'Sicherung & Gerätewechsel', text: 'Lernstand exportieren / importieren', icon: icon.cards, order: 25 });
}
