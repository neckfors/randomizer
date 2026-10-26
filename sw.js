// Bump the version when you change any file so phones pick up the update.
const CACHE = 'whostarts-v63';
const FILES = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png'];

// 'reload' skips the browser's own HTTP cache, so a new version really gets
// the new files and not copies the browser kept from before.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
