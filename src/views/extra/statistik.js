// Statistik: Schwachstellen nach Thema, Simulationsverlauf, „Schwächste Themen üben“.
import { data, aktivesProfil, themenImBereich, mixBereiche } from '../../content.js';
import { store, today } from '../../store.js';
import { esc, icon, header, progressBar, fmtDate } from '../../ui.js';
import { mehrLinks } from '../mehr.js';

/** Kennzahlen je Thema. beherrschung = Anteil der Fragen, deren letzte Antwort richtig war. */
export function themenStatistik() {
  const s = store.get();
  return mixBereiche().flatMap((b) => themenImBereich(b.id).map((t) => {
    const fragen = t.fragen || [];
    let versuche = 0, richtig = 0, beantwortet = 0, sicher = 0;
    for (const q of fragen) {
      const e = s.q[q.id];
      if (!e) continue;
      beantwortet++; versuche += e.n; richtig += e.ok; if (e.last) sicher++;
    }
    return {
      thema: t, bereich: b, gesamt: fragen.length, beantwortet, sicher, versuche,
      quote: versuche ? richtig / versuche : null,
      beherrschung: fragen.length ? sicher / fragen.length : 0,
      fehler: fragen.filter((q) => s.fehler[q.id]).length,
    };
  }));
}

const vergleich = (a, b) => a.beherrschung - b.beherrschung || (a.quote ?? 1) - (b.quote ?? 1);

/** Die n schwächsten Themen: zuerst bereits geübte mit niedriger Trefferquote, dann ungeübte. */
export function schwaechsteThemen(n = 3) {
  return themenStatistik()
    .filter((x) => x.gesamt)
    .sort(vergleich)
    .slice(0, n);
}

/** Fragen für „Schwächste Themen üben“: nicht sicher beantwortete Fragen der schwächsten Themen. */
export function schwachFragen(anzahl) {
  const s = store.get();
  const themen = schwaechsteThemen(3);
  const offen = [], rest = [];
  for (const x of themen) for (const q of x.thema.fragen) (s.q[q.id]?.last ? rest : offen).push(q);
  const mix = (a) => a.sort(() => Math.random() - 0.5);
  return [...mix(offen), ...mix(rest)].slice(0, anzahl);
}

function view(el) {
  const s = store.get();
  const profil = aktivesProfil();
  const stats = themenStatistik();
  const alle = Object.values(s.q);
  const versuche = alle.reduce((x, e) => x + e.n, 0);
  const richtig = alle.reduce((x, e) => x + e.ok, 0);
  const tage = Object.keys(s.tage).sort();
  let serie = 0;
  for (let d = new Date(); ; d.setDate(d.getDate() - 1)) {
    const k = today(d); const t = s.tage[k];
    if (t && (t.fragen || t.karten)) serie++; else if (k !== today()) break;
    if (serie > 400) break;
  }
  const schwach = schwaechsteThemen(3);
  const sims = (s.sims || []).filter((x) => x.profil === profil.id);
  const sorted = [...stats].sort(vergleich);
  const cls = (p) => (p < 0.5 ? 'bad-t' : p < 0.67 ? 'mid-t' : 'ok-t');

  el.innerHTML = `
    ${header('Statistik')}
    <div class="stats-grid">
      <div class="card stat"><b>${alle.length}</b><span>Fragen beantwortet</span></div>
      <div class="card stat"><b>${versuche ? Math.round(richtig / versuche * 100) : 0} %</b><span>Trefferquote</span></div>
      <div class="card stat"><b>${serie}</b><span>Tage in Folge</span></div>
      <div class="card stat"><b>${tage.length}</b><span>Lerntage gesamt</span></div>
    </div>

    <section class="card">
      <h2 class="h-small">Deine schwächsten Themen</h2>
      ${schwach.length ? `<ol class="plain-list">${schwach.map((x) => `<li><a href="#/thema/${x.thema.id}">${esc(x.thema.titel)}</a> <span class="muted small">· ${Math.round(x.beherrschung * 100)} % sicher${x.quote != null ? ` · Trefferquote ${Math.round(x.quote * 100)} %` : ' · noch nicht geübt'}</span></li>`).join('')}</ol>
      <a class="btn primary big" href="#/quiz?schwach=1">${icon.quiz} Schwächste Themen üben</a>` : '<p class="muted">Noch keine Daten.</p>'}
    </section>

    ${sims.length ? `<section class="card"><h2 class="h-small">Prüfungssimulationen</h2>
      <table class="tbl"><thead><tr><th>Datum</th><th>Bereich</th><th>Punkte</th><th>Note</th></tr></thead><tbody>
      ${sims.slice(-8).reverse().map((v) => `<tr><td>${fmtDate(v.datum, { day: '2-digit', month: '2-digit' })}</td><td>${esc(v.titel)}</td><td>${v.ausstehend ? '–' : v.prozent}</td><td><b>${v.ausstehend ? 'offen' : v.note}</b></td></tr>`).join('')}
      </tbody></table></section>` : `<a class="btn big" href="#/simulation">${icon.clock} Erste Prüfungssimulation starten</a>`}

    <section>
      <h2>Alle Themen <span class="muted small">(schwächste zuerst)</span></h2>
      <p class="small muted">„Sicher“ = letzte Antwort richtig. Trefferquote = alle Versuche. ${s.settings.mitTeil1 ? '' : 'Teil 1 ist ausgeblendet (Schalter unter „Quiz“).'}</p>
      <ul class="topics">${sorted.map((x) => `<li><a class="topic" href="#/thema/${x.thema.id}">
        <span class="topic-main"><span class="topic-group">${esc(x.bereich.kurz)}${x.thema.gruppe && x.thema.gruppe !== x.bereich.kurz ? ' · ' + esc(x.thema.gruppe) : ''}</span><span class="topic-title">${esc(x.thema.titel)}</span>
        ${progressBar(x.beherrschung, x.thema.titel)}
        <span class="small muted">${x.sicher}/${x.gesamt} sicher · ${x.beantwortet} geübt${x.quote != null ? ` · Quote ${Math.round(x.quote * 100)} %` : ''}${x.fehler ? ` · ${x.fehler} im Fehlerkorb` : ''}</span></span>
        <span class="topic-num ${cls(x.beherrschung)}">${Math.round(x.beherrschung * 100)} %</span></a></li>`).join('')}</ul>
    </section>`;
}

export function register(addRoute) {
  addRoute({ path: 'statistik', view, nav: 'mehr' });
  mehrLinks.push({ href: '#/statistik', label: 'Statistik', text: 'Schwachstellen nach Thema', icon: icon.chart, order: 20 });
}
