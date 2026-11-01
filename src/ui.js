import { render } from './lib/template.js';
import { W } from './content.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Mini-Markdown: **fett**, Zeilen mit "- " als Liste, Zeilenumbrüche. Templates {{…}} werden vorher ausgewertet. */
export function rich(text, vars = {}) {
  let t;
  try { t = render(String(text ?? ''), vars, W); } catch (e) { t = String(text) + ` [Formelfehler: ${e.message}]`; }
  const lines = esc(t).split('\n');
  let html = '', inList = false;
  for (const line of lines) {
    const li = /^\s*[-•]\s+(.*)$/.exec(line);
    if (li) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${li[1]}</li>`; continue; }
    if (inList) { html += '</ul>'; inList = false; }
    html += line + '<br>';
  }
  if (inList) html += '</ul>';
  return html.replace(/(<br>)+$/, '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

export const plain = (text, vars = {}) => { try { return render(String(text ?? ''), vars, W); } catch { return String(text); } };

const P = (d) => `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const icon = {
  home: P('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'),
  quiz: P('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><circle cx="12" cy="17.5" r=".6" fill="currentColor"/>'),
  cards: P('<rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v12"/>'),
  formula: P('<path d="M5 4h14"/><path d="M5 4l7 8-7 8h14"/>'),
  more: P('<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>'),
  back: P('<path d="M15 18l-6-6 6-6"/>'),
  check: P('<path d="M5 12l5 5 9-10"/>'),
  x: P('<path d="M6 6l12 12M18 6L6 18"/>'),
  basket: P('<path d="M4 9h16l-1.5 10h-13z"/><path d="M8 9l4-6 4 6"/>'),
  search: P('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
  clock: P('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  chart: P('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  mic: P('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
  plus: P('<path d="M12 5v14M5 12h14"/>'),
};

export function progressBar(frac, label) {
  const pct = Math.round(Math.max(0, Math.min(1, frac)) * 100);
  return `<div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(label || 'Fortschritt')}"><span style="width:${pct}%"></span></div>`;
}

export const badge2026 = () => `<span class="badge warn" title="Wert ändert sich jährlich – vor der Prüfung prüfen">Stand 2026 – prüfen</span>`;

let toastTimer;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

export const fmtDate = (iso, opts = { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', opts);

export function daysUntil(iso) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d = new Date(iso + 'T00:00:00');
  return Math.round((d - now) / 86400000);
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function note(prozent, schluessel) {
  return schluessel.find((s) => prozent >= s.ab) || schluessel[schluessel.length - 1];
}

export const header = (title, backHref) => `
  <header class="page-head">
    ${backHref ? `<a class="icon-btn" href="${backHref}" aria-label="Zurück">${icon.back}</a>` : ''}
    <h1>${esc(title)}</h1>
  </header>`;
