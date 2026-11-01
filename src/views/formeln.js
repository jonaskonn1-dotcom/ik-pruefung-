import { formelGruppen } from '../content.js';
import { esc, rich, header, icon, badge2026, plain } from '../ui.js';

const norm = (s) => String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9%]+/g, ' ');

export function formelnView(el, _p, query) {
  let gruppe = query.g || '';
  let suche = query.q || '';
  const alle = formelGruppen.flatMap((g) => g.formeln.map((f) => ({
    ...f, gruppe: g.kurz,
    idx: norm([f.name, f.formel, f.erklaerung, (f.tags || []).join(' '), g.titel, g.kurz].join(' ')),
  })));

  el.innerHTML = `
    ${header('Formelsammlung')}
    <div class="search">
      ${icon.search}
      <label for="f-q" class="sr-only">Formeln durchsuchen</label>
      <input id="f-q" type="search" placeholder="Suchen, z. B. Break-even, Liquidität, Skonto" value="${esc(suche)}" autocomplete="off">
    </div>
    <div class="chips" role="group" aria-label="Kategorie">
      <button class="chip" data-g="" aria-pressed="${!gruppe}">Alle</button>
      ${formelGruppen.map((g) => `<button class="chip" data-g="${esc(g.kurz)}" aria-pressed="${gruppe === g.kurz}">${esc(g.kurz)}</button>`).join('')}
    </div>
    <p class="small muted" id="f-count" aria-live="polite"></p>
    <div id="f-list" class="formeln"></div>`;

  const list = el.querySelector('#f-list');
  function update() {
    const terms = norm(suche).split(' ').filter(Boolean);
    const hits = alle.filter((f) => (!gruppe || f.gruppe === gruppe) && terms.every((t) => f.idx.includes(t)));
    el.querySelector('#f-count').textContent = `${hits.length} Formel${hits.length === 1 ? '' : 'n'}`;
    list.innerHTML = hits.map((f) => `
      <details class="formel" ${terms.length && hits.length <= 3 ? 'open' : ''}>
        <summary><span class="f-name">${esc(f.name)}</span><span class="f-grp">${esc(f.gruppe)}</span></summary>
        <div class="f-body">
          ${f.stand2026 ? badge2026() : ''}
          <pre class="f-formel">${esc(plain(f.formel))}</pre>
          ${f.erklaerung ? `<p>${rich(f.erklaerung)}</p>` : ''}
          ${f.beispiel ? `<p class="f-bsp"><strong>Beispiel:</strong> ${rich(f.beispiel.text, f.beispiel.vars || {})}</p>` : ''}
          ${f.tags?.length ? `<p class="tags">${f.tags.map((t) => `<button class="tag" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}</p>` : ''}
        </div>
      </details>`).join('') || '<p class="muted">Keine Treffer.</p>';
    const hash = `#/formeln${suche || gruppe ? '?' + new URLSearchParams({ ...(suche && { q: suche }), ...(gruppe && { g: gruppe }) }) : ''}`;
    history.replaceState(null, '', hash);
  }
  el.querySelector('#f-q').addEventListener('input', (e) => { suche = e.target.value; update(); });
  el.addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (c) { gruppe = c.dataset.g; el.querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-pressed', x === c)); update(); }
    const t = e.target.closest('.tag');
    if (t) { suche = t.dataset.tag; el.querySelector('#f-q').value = suche; gruppe = ''; el.querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-pressed', x.dataset.g === '')); update(); scrollTo(0, 0); }
  });
  update();
}
