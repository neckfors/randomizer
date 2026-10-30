// Bump VERSION when you change any file so phones pick up the update.
const VERSION = 108;
const CACHE = `whostarts-v${VERSION}`;
const FILES = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png'];

// Versions before this one took over as soon as they had downloaded, and their page only offers the
// update once a new version has taken over. So coming from one of them, this version takes over by
// itself one last time; after that a new version waits until Update is tapped.
const FIRST_WAITING_VERSION = 102;

async function cameFromOldVersion() {
  return (await caches.keys()).some((key) => {
    const match = /^whostarts-v(\d+)$/.exec(key);
    return match && Number(match[1]) < FIRST_WAITING_VERSION;
  });
}

// 'reload' skips the browser's own HTTP cache, so a new version really gets
// the new files and not copies the browser kept from before.
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })));
    if (await cameFromOldVersion()) self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// The page asks the waiting version to take over (Update tapped), and which version is running.
self.addEventListener('message', (e) => {
  if (e.data === 'update') self.skipWaiting();
  if (e.data === 'version') e.ports[0]?.postMessage(VERSION);
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
