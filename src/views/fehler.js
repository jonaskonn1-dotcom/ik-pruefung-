import { data, config } from '../content.js';
import { store } from '../store.js';
import { esc, header, icon, plain } from '../ui.js';

export function fehlerView(el) {
  const s = store.get();
  const db = data();
  const eintraege = Object.entries(s.fehler).map(([id, f]) => ({ q: db.fragen.get(id), f })).filter((x) => x.q);
  const byThema = new Map();
  for (const e of eintraege) {
    if (!byThema.has(e.q.thema)) byThema.set(e.q.thema, []);
    byThema.get(e.q.thema).push(e);
  }
  const schwelle = config.quiz.fehlerkorbRichtigBisEntfernen;
  el.innerHTML = `
    ${header('Fehlerkorb')}
    <p class="muted">Falsch beantwortete Fragen landen automatisch hier. Nach ${schwelle}× richtig in Folge verschwinden sie wieder.</p>
    ${eintraege.length ? `<a class="btn primary big" href="#/quiz?modus=fehler">${icon.basket} Alle ${eintraege.length} wiederholen</a>` : '<div class="card empty-state"><p>Der Fehlerkorb ist leer. 🎉</p></div>'}
    ${[...byThema].map(([tid, list]) => {
      const t = db.themenById.get(tid);
      return `<section class="card">
        <div class="section-head"><h2 class="h-small">${esc(t?.titel || tid)}</h2><a class="small-link" href="#/quiz?modus=fehler&thema=${tid}">Wiederholen (${list.length})</a></div>
        <ul class="plain-list">${list.map(({ q, f }) => `<li>${esc(plain(q.frage, q.vars).split('\n')[0].replace(/\*\*/g, '').slice(0, 130))}
          <span class="streak" title="richtig in Folge">${'●'.repeat(f.streak)}${'○'.repeat(Math.max(0, schwelle - f.streak))}</span></li>`).join('')}</ul>
      </section>`;
    }).join('')}`;
}
