// Gemeinsame Lade-Funktionen für Node-Skripte (Test, Fill).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flattenWerte } from '../src/lib/calc.js';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));

export function walk(dir, ext = ".json") {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, ext));
    else if (p.endsWith(ext)) out.push(p);
  }
  return out.sort();
}

export function readJson(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')); }
  catch (e) { throw new Error(`${relative(ROOT, p)}: ungültiges JSON – ${e.message}`); }
}

export function loadAll() {
  const werte = readJson(join(ROOT, 'data/werte-2026.json'));
  const W = flattenWerte(werte);
  const themen = walk(join(ROOT, 'content/themen')).map((file) => ({ file, rel: relative(ROOT, file), data: readJson(file) }));
  const formeln = walk(join(ROOT, 'content/formeln')).map((file) => ({ file, rel: relative(ROOT, file), data: readJson(file) }));
  const profile = walk(join(ROOT, 'content/pruefung')).map((f) => readJson(f));
  const fachaufgabe = walk(join(ROOT, 'content/fachaufgabe')).map((file) => ({ file, rel: relative(ROOT, file), data: readJson(file) }));
  return { werte, W, themen, formeln, profile, fachaufgabe };
}
