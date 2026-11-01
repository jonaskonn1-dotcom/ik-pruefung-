import { config, data, aktivesProfil, themenImBereich } from '../content.js';
import { store, today } from '../store.js';
import { esc, progressBar, icon, fmtDate, daysUntil } from '../ui.js';
import { faFortschritt } from './fortschritt.js';
import { faelligeKarten } from './karten.js';

/** Anteil gemeisterter Fragen (letzte Antwort richtig) je Bereich. */
export function bereichFortschritt(bereich) {
  const s = store.get();
  const fragen = themenImBereich(bereich.id).flatMap((t) => t.fragen || []);
  const gesamt = fragen.length;
  const beantwortet = fragen.filter((q) => s.q[q.id]).length;
  const sicher = fragen.filter((q) => s.q[q.id]?.last).length;
  return { gesamt, beantwortet, sicher, frac: gesamt ? sicher / gesamt : 0 };
}

function countdown(label, iso, bisIso) {
  const d = daysUntil(iso);
  const laeuft = d < 0 && bisIso && daysUntil(bisIso) >= 0;
  const num = d > 1 ? `${d}<small>Tage</small>` : d === 1 ? 'morgen' : d === 0 ? 'heute' : laeuft ? 'läuft' : '✓';
  const zeitraum = bisIso && bisIso !== iso
    ? `${fmtDate(iso, { day: '2-digit', month: '2-digit' })}–${fmtDate(bisIso, { day: '2-digit', month: '2-digit', year: 'numeric' })}`
    : fmtDate(iso);
  return `<div class="count" role="group" aria-label="${esc(label)}: ${d > 0 ? 'noch ' + d + ' Tage' : esc(String(num))}">
    <div class="count-num">${num}</div>
    <div class="count-label">${esc(label)}</div>
    <div class="count-sub">${zeitraum}</div>
  </div>`;
}

export function homeView(el) {
  const s = store.get();
  const profil = aktivesProfil();
  const { termine } = config;
  const fehler = Object.keys(s.fehler).filter((id) => data().fragen.has(id)).length;
  const faellig = faelligeKarten().length;
  const heute = s.tage[today()] || { fragen: 0, richtig: 0, karten: 0 };

  const bereiche = profil.bereiche.map((b) => {
    if (b.art === 'muendlich') {
      const fa = faFortschritt();
      if (!fa.aktiv) return `<div class="area soon" aria-disabled="true">
        <div class="area-top"><span class="area-name">${esc(b.kurz)}</span><span class="area-meta">${b.gewicht} %</span></div>
        <div class="area-full">${esc(b.name)}</div>
        <span class="badge">kommt bald</span></div>`;
      return `<a class="area" href="#/fachaufgabe">
        <div class="area-top"><span class="area-name">${esc(b.kurz)}</span><span class="area-meta">${b.gewicht} %</span></div>
        <div class="area-full">${esc(b.name)}</div>
        ${progressBar(fa.frac, b.name)}
        <div class="area-meta">${fa.text}</div></a>`;
    }
    const p = bereichFortschritt(b);
    return `<a class="area" href="#/lernen?bereich=${b.id}">
      <div class="area-top"><span class="area-name">${esc(b.kurz)}</span><span class="area-meta">${b.dauer ? b.dauer + ' Min. · ' : ''}${b.gewicht} %</span></div>
      <div class="area-full">${esc(b.name)}</div>
      ${progressBar(p.frac, b.name)}
      <div class="area-meta">${p.sicher} von ${p.gesamt} Fragen sicher${p.gesamt ? ` · ${Math.round(p.frac * 100)} %` : ''}</div></a>`;
  }).join('');

  el.innerHTML = `
    <header class="hero">
      <p class="eyebrow">${esc(config.ihk)} · ${esc(config.beruf)}</p>
      <h1>Prüfungstrainer</h1>
      <div class="counts">
      ${countdown(termine.schriftlich.label, termine.schriftlich.von, termine.schriftlich.bis)}
      ${countdown(termine.muendlich.label, termine.muendlich.von, termine.muendlich.bis)}
      </div>
    </header>

    <section class="quick" aria-label="Schnellstart">
      <a class="quick-btn primary" href="#/quiz?modus=mix">${icon.quiz}<span>Gemischtes Quiz</span></a>
      <a class="quick-btn" href="#/simulation${s.simLauf ? '/laufend' : ''}">${icon.clock}<span>${s.simLauf ? 'Simulation fortsetzen' : 'Prüfungs&shy;simulation'}</span></a>
      <a class="quick-btn" href="#/karten/lernen">${icon.cards}<span>Karten <b class="pill">${faellig}</b></span></a>
      <a class="quick-btn" href="#/fehler">${icon.basket}<span>Fehlerkorb <b class="pill${fehler ? ' red' : ''}">${fehler}</b></span></a>
    </section>

    <section aria-labelledby="h-heute" class="card today">
      <h2 id="h-heute" class="h-small">Heute</h2>
      <div class="stats3">
        <div><b>${heute.fragen}</b><span>Fragen</span></div>
        <div><b>${heute.fragen ? Math.round(heute.richtig / heute.fragen * 100) : 0} %</b><span>richtig</span></div>
        <div><b>${heute.karten}</b><span>Karten</span></div>
      </div>
    </section>

    <section aria-labelledby="h-bereiche">
      <div class="section-head"><h2 id="h-bereiche">Fortschritt</h2><a href="#/statistik" class="small-link">Statistik ›</a></div>
      <div class="areas">${bereiche}</div>
      <a class="btn big" href="#/quiz?schwach=1" style="margin-top:.75rem">${icon.chart} Schwächste Themen üben</a>
      <p class="small muted center">Prüfungsordnung: ${esc(profil.kurz)} · <a href="#/mehr">ändern</a></p>
    </section>`;
}
