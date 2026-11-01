// Zusammenführen zweier Lernstände (z. B. Handy + Mac). Reine Funktion, ohne Browser-Abhängigkeiten.
// Regeln: pro Frage gewinnt der neuere Eintrag (Zeitstempel t), pro Karte der mit mehr Wiederholungen,
// Tagesstatistik je Feld das Maximum, Simulationen und eigene Inhalte werden vereinigt.
// Einstellungen und eine laufende Simulation bleiben vom aktuellen Gerät.

export const EXPORT_APP = 'ik-pruefungstrainer';

export function mergeState(lokal, fremd) {
  const out = structuredClone(lokal);
  const a = lokal || {}, b = fremd || {};

  // Fragen
  out.q = { ...(a.q || {}) };
  for (const [id, e] of Object.entries(b.q || {})) {
    const l = out.q[id];
    if (!l || (e.t || 0) > (l.t || 0)) out.q[id] = e;
  }

  // Fehlerkorb: maßgeblich ist das Gerät mit der neueren Antwort zu dieser Frage
  out.fehler = {};
  const ids = new Set([...Object.keys(a.fehler || {}), ...Object.keys(b.fehler || {})]);
  for (const id of ids) {
    const ta = a.q?.[id]?.t || 0, tb = b.q?.[id]?.t || 0;
    const quelle = tb > ta ? b : a;
    const anders = quelle === a ? b : a;
    const eintrag = quelle.fehler?.[id] ?? (ta === tb ? anders.fehler?.[id] : undefined);
    if (eintrag) out.fehler[id] = eintrag;
  }

  // Karten
  out.karten = { ...(a.karten || {}) };
  for (const [id, c] of Object.entries(b.karten || {})) {
    const l = out.karten[id];
    if (!l || (c.n || 0) > (l.n || 0) || ((c.n || 0) === (l.n || 0) && (c.due || '') > (l.due || ''))) out.karten[id] = c;
  }

  // Tage
  out.tage = { ...(a.tage || {}) };
  for (const [d, t] of Object.entries(b.tage || {})) {
    const l = out.tage[d] || {};
    out.tage[d] = { fragen: Math.max(l.fragen || 0, t.fragen || 0), richtig: Math.max(l.richtig || 0, t.richtig || 0), karten: Math.max(l.karten || 0, t.karten || 0) };
  }

  // Simulationen
  const key = (s) => `${s.datum}|${s.titel}|${s.prozent}|${s.punkte}`;
  const sims = new Map([...(a.sims || []), ...(b.sims || [])].map((s) => [key(s), s]));
  out.sims = [...sims.values()].sort((x, y) => (x.datum < y.datum ? -1 : 1)).slice(-30);

  // Eigene Inhalte
  const union = (x = [], y = []) => [...new Map([...x, ...y].map((e) => [e.id, e])).values()];
  out.eigene = { fragen: union(a.eigene?.fragen, b.eigene?.fragen), karten: union(a.eigene?.karten, b.eigene?.karten) };

  // Fachaufgabe (Checkliste/Notizen)
  out.fa = { ...(b.fa || {}), ...(a.fa || {}), check: { ...(b.fa?.check || {}), ...(a.fa?.check || {}) } };
  return out;
}

/** Prüft eine Exportdatei und liefert den Lernstand oder wirft einen verständlichen Fehler. */
export function parseExport(text) {
  let obj;
  try { obj = JSON.parse(text); } catch { throw new Error('Die Datei ist kein gültiges JSON.'); }
  const st = obj?.app === EXPORT_APP ? obj.daten : obj;
  if (!st || typeof st !== 'object' || typeof st.q !== 'object' || typeof st.settings !== 'object') {
    throw new Error('Die Datei enthält keinen Lernstand dieser App.');
  }
  return st;
}
