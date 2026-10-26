/* Mobilität – Service Worker: Precache der App-Shell, danach cache-first mit Update im Hintergrund.
 * CACHE_VERSION bei jeder Änderung an den Dateien hochzählen. */
const CACHE_VERSION = 3;
const CACHE_NAME = `mob-cache-v${CACHE_VERSION}`;
const PRECACHE = ['./', 'index.html', 'manifest.webmanifest', 'css/app.css', 'css/anim.css', 'js/app.js', 'js/data.js', 'js/routine.js', 'js/store.js',
  'js/anim-view.js', 'js/anim-data.js', 'js/anim-bar.js', 'js/motion.js', 'js/motion-front.js', 'js/motion-female.js', 'js/pool-shim.js', 'js/sheet.js', 'js/util.js', 'js/icons.js',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('mob-cache-') && k !== CACHE_NAME).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => {
    const net = fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(req, copy)); } return res; }).catch(() => hit);
    return hit || net;
  }));
});
