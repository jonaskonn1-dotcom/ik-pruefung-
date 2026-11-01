import { fachaufgabe } from '../content.js';
import { store } from '../store.js';

/** Fortschritt der Fachaufgabe: abgehakte Checklistenpunkte. */
export function faFortschritt() {
  const items = fachaufgabe.flatMap((d) => (d.checklisten || []).flatMap((c) => c.punkte.map((p, i) => `${c.id}:${i}`)));
  if (!items.length) return { frac: 0, text: 'Trainer folgt in Version 2' };
  const done = items.filter((k) => store.get().fa?.check?.[k]).length;
  return { frac: done / items.length, text: `${done} von ${items.length} Checklistenpunkten erledigt` };
}
