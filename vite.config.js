import { defineConfig } from 'vite';
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

// Kleiner eigener Service-Worker-Generator (statt Plugin-Abhängigkeit):
// Nach dem Build werden alle Dateien in dist/ vorab gecacht → App läuft offline.
function serviceWorker() {
  let outDir;
  return {
    name: 'ik-service-worker',
    apply: 'build',
    configResolved(c) { outDir = c.build.outDir; },
    closeBundle() {
      const files = [];
      const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(relative(outDir, p).split('\\').join('/')); });
      walk(outDir);
      const list = files.filter((f) => f !== 'sw.js' && !f.endsWith('.map')).map((f) => (f === 'index.html' ? './' : './' + f));
      const version = createHash('sha1').update(list.join()).digest('hex').slice(0, 10);
      writeFileSync(join(outDir, 'sw.js'), `// automatisch erzeugt
const CACHE = 'ik-${version}';
const FILES = ${JSON.stringify(list)};
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') { e.respondWith(fetch(req).catch(() => caches.match('./'))); return; }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
`);
      console.log(`✓ sw.js mit ${list.length} Dateien (Cache ${version})`);
    },
  };
}

export default defineConfig({
  base: './',
  build: { target: 'es2020', assetsInlineLimit: 0 },
  plugins: [serviceWorker()],
});
