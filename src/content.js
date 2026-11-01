// Lädt alle Inhalte aus /content und /data (zur Build-Zeit gebündelt → offline verfügbar).
import config from '../content/config.json';
import werte from '../data/werte-2026.json';
import firma from '../content/modellunternehmen.json';
import { flattenWerte } from './lib/calc.js';
import { store } from './store.js';

const themenMods = import.meta.glob('../content/themen/**/*.json', { eager: true, import: 'default' });
const formelMods = import.meta.glob('../content/formeln/*.json', { eager: true, import: 'default' });
const profilMods = import.meta.glob('../content/pruefung/*.json', { eager: true, import: 'default' });
const faMods = import.meta.glob('../content/fachaufgabe/*.json', { eager: true, import: 'default' });

export { config, werte, firma };
export const W = flattenWerte(werte);

export const profile = Object.fromEntries(Object.values(profilMods).map((p) => [p.id, p]));
export const formelGruppen = Object.entries(formelMods).sort(([a], [b]) => a.localeCompare(b)).map(([, g]) => g);
export const fachaufgabe = Object.entries(faMods).sort(([a], [b]) => a.localeCompare(b)).map(([, d]) => d);

const usesW = (q) => /\bW\.|svA[NG]\(/.test([q.calc, q.frage, q.erklaerung, q.vorne, q.hinten].filter(Boolean).join(' '));

/** Baut Themen inkl. eigener Inhalte (localStorage) auf. Wird bei Änderungen neu berechnet. */
function build() {
  const themen = Object.values(themenMods).map((t) => ({ ...t, eigen: false }));
  const custom = store.get().eigene || { fragen: [], karten: [] };
  if ((custom.fragen?.length || 0) + (custom.karten?.length || 0) > 0) {
    // Eigene Inhalte werden ihren Themen zugeordnet, sonst Thema "Eigene"
    const byId = new Map(themen.map((t) => [t.id, t]));
    const eigenThema = { id: 'eigene', titel: 'Eigene Fragen & Karten', gruppe: 'Eigene', bereich: {}, fragen: [], karten: [], eigen: true };
    for (const q of custom.fragen || []) (byId.get(q.thema) || eigenThema).fragen = [...(byId.get(q.thema) || eigenThema).fragen, { ...q, eigen: true }];
    for (const k of custom.karten || []) (byId.get(k.thema) || eigenThema).karten = [...(byId.get(k.thema) || eigenThema).karten, { ...k, eigen: true }];
    if (eigenThema.fragen.length || eigenThema.karten.length) themen.push(eigenThema);
  }
  const fragen = new Map();
  const karten = new Map();
  for (const t of themen) {
    for (const q of t.fragen || []) { q.thema = t.id; q.stand2026 = q.stand2026 || usesW(q); fragen.set(q.id, q); }
    for (const k of t.karten || []) { k.thema = t.id; k.stand2026 = k.stand2026 || usesW(k); karten.set(k.id, k); }
  }
  return { themen, fragen, karten, themenById: new Map(themen.map((t) => [t.id, t])) };
}

let db = build();
export const data = () => db;
export function rebuild() { db = build(); }

export function aktivesProfil() {
  return profile[store.get().settings.profil || config.pruefungsordnung] || profile.ao2024;
}

/** Themen eines Prüfungsbereichs im aktiven Profil (eigene Themen ohne Zuordnung landen nirgends). */
export function themenImBereich(bereichId, profil = aktivesProfil()) {
  return db.themen.filter((t) => t.bereich?.[profil.id] === bereichId);
}

export function bereichVonThema(thema, profil = aktivesProfil()) {
  return profil.bereiche.find((b) => b.id === thema.bereich?.[profil.id]);
}
