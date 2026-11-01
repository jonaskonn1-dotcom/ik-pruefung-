// Lernfortschritt in localStorage. Ein einziger Schlüssel, JSON. Fällt auf Speicher im RAM zurück,
// wenn localStorage nicht verfügbar ist (privater Modus).
const KEY = 'ik-lernstand-v1';

const empty = () => ({
  version: 1,
  settings: { theme: 'auto', profil: null, quizAnzahl: 10, neueKartenProTag: 20, mitTeil1: false },
  q: {},        // Frage-ID → { n, ok, last, t }
  fehler: {},   // Frage-ID → { seit, streak }
  karten: {},   // Karten-ID → { box, due, n }
  tage: {},     // 'YYYY-MM-DD' → { fragen, richtig, karten }
  sims: [],     // Prüfungssimulationen
  fa: {},       // Fachaufgabe: Checklisten, Notizen
  eigene: { fragen: [], karten: [] },
});

let state;
let memoryOnly = false;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const base = empty();
      return { ...base, ...s, settings: { ...base.settings, ...(s.settings || {}) }, eigene: { ...base.eigene, ...(s.eigene || {}) } };
    }
  } catch { memoryOnly = true; }
  return empty();
}

state = load();
const listeners = new Set();

function save() {
  if (memoryOnly) return;
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { memoryOnly = true; }
}

export const today = (d = new Date()) => {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};

export const store = {
  get: () => state,
  isMemoryOnly: () => memoryOnly,
  update(fn) { fn(state); save(); listeners.forEach((l) => l(state)); },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  replace(newState) { const base = empty(); state = { ...base, ...newState, settings: { ...base.settings, ...(newState.settings || {}) } }; save(); listeners.forEach((l) => l(state)); },
  reset() { state = empty(); save(); listeners.forEach((l) => l(state)); },
  KEY,
};

function tag(s) {
  const k = today();
  return (s.tage[k] ||= { fragen: 0, richtig: 0, karten: 0 });
}

/** Antwort protokollieren. modus 'fehler' zählt die Streak für den Fehlerkorb. */
/** punkte (0..1) erlaubt Teilpunkte, z. B. Selbstbewertung „teilweise“ = 0,5 für die Trefferquote. */
export function recordAnswer(qid, ok, schwelle = 2, punkte = ok ? 1 : 0) {
  store.update((s) => {
    const e = (s.q[qid] ||= { n: 0, ok: 0, last: false, t: 0 });
    e.n++; e.ok += ok ? 1 : Math.max(0, Math.min(1, punkte || 0)); e.last = ok; e.t = Date.now();
    const d = tag(s); d.fragen++; if (ok) d.richtig++;
    if (!ok) s.fehler[qid] = { seit: s.fehler[qid]?.seit || Date.now(), streak: 0 };
    else if (s.fehler[qid]) {
      s.fehler[qid].streak++;
      if (s.fehler[qid].streak >= schwelle) delete s.fehler[qid];
    }
  });
}

export function recordCard() { store.update((s) => { tag(s).karten++; }); }
