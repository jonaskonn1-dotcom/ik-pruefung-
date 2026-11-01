import './styles.css';
import { icon } from './ui.js';
import { store } from './store.js';
import { homeView } from './views/home.js';
import { lernenView, themaView } from './views/lernen.js';
import { quizView } from './views/quiz.js';
import { kartenView, kartenLernenView } from './views/karten.js';
import { formelnView } from './views/formeln.js';
import { fehlerView } from './views/fehler.js';
import { mehrView } from './views/mehr.js';

const routes = [
  { path: '', view: homeView, nav: 'start' },
  { path: 'lernen', view: lernenView, nav: 'lernen' },
  { path: 'thema/:id', view: themaView, nav: 'lernen' },
  { path: 'quiz', view: quizView, nav: 'lernen', focus: true },
  { path: 'fehler', view: fehlerView, nav: 'lernen' },
  { path: 'karten', view: kartenView, nav: 'karten' },
  { path: 'karten/lernen', view: kartenLernenView, nav: 'karten', focus: true },
  { path: 'formeln', view: formelnView, nav: 'formeln' },
  { path: 'mehr', view: mehrView, nav: 'mehr' },
];

/** Weitere Routen (P2/P3) können sich hier registrieren. */
export function addRoute(r) { routes.push(r); }

const navItems = [
  { id: 'start', href: '#/', label: 'Start', icon: icon.home },
  { id: 'lernen', href: '#/lernen', label: 'Quiz', icon: icon.quiz },
  { id: 'karten', href: '#/karten', label: 'Karten', icon: icon.cards },
  { id: 'formeln', href: '#/formeln', label: 'Formeln', icon: icon.formula },
  { id: 'mehr', href: '#/mehr', label: 'Mehr', icon: icon.more },
];

function renderNav(active) {
  document.getElementById('nav').innerHTML = `
    <div class="nav-brand" aria-hidden="true"><img src="./icons/icon.svg" alt="" width="32" height="32"> IK-Trainer</div>
    ${navItems.map((n) => `<a href="${n.href}" class="nav-item${n.id === active ? ' active' : ''}"${n.id === active ? ' aria-current="page"' : ''}>${n.icon}<span>${n.label}</span></a>`).join('')}`;
}

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [pathPart, queryPart] = raw.split('?');
  const path = pathPart.replace(/\/$/, '');
  const query = Object.fromEntries(new URLSearchParams(queryPart || ''));
  for (const r of routes) {
    const keys = [];
    const re = new RegExp('^' + r.path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    const m = re.exec(path);
    if (m) return { route: r, params: Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])), query };
  }
  return { route: routes[0], params: {}, query };
}

let cleanup = null;
function router() {
  if (typeof cleanup === 'function') { try { cleanup(); } catch {} }
  cleanup = null;
  const { route, params, query } = parseHash();
  // Frisches <main>-Element → alte Event-Listener verschwinden mit der alten Ansicht
  const old = document.getElementById('main');
  const main = old.cloneNode(false);
  old.replaceWith(main);
  document.body.classList.toggle('focus-mode', !!route.focus);
  renderNav(route.nav);
  cleanup = route.view(main, params, query) || null;
  window.scrollTo(0, 0);
  // Fokus für Screenreader/Tastatur auf neue Seite setzen (ohne Scroll-Sprung)
  const h1 = main.querySelector('h1');
  if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
}

function applyTheme() {
  const t = store.get().settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  try { localStorage.setItem('ik-theme', t); } catch {}
}

store.subscribe(applyTheme);
applyTheme();
window.addEventListener('hashchange', router);
window.addEventListener('ik-rerender', router);

// P2/P3-Module laden (registrieren eigene Routen)
const extras = import.meta.glob('./views/extra/*.js', { eager: true });
for (const m of Object.values(extras)) m.register?.(addRoute);

router();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
