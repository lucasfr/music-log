// Service worker for Music.log PWA
const CACHE = 'musiclog-v4';
const PRECACHE = ['/', '/index.html'];

// A cheap fingerprint of a response, used to tell whether the page we served from the cache
// has since changed on the server.
const tagOf = res => (res && res.headers && (res.headers.get('etag') || res.headers.get('last-modified'))) || '';

function tellClients(message) {
  return self.clients.matchAll({ type: 'window' }).then(cs => cs.forEach(c => c.postMessage(message)));
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache first, refreshed in the background. That makes loads instant, but it means a deploy
// is only visible on the visit after the one that noticed it. So when the refreshed page
// differs from the one just served, tell the open page, which offers a Reload.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          if (cached && e.request.mode === 'navigate') {
            const before = tagOf(cached);
            const after = tagOf(res);
            if (before && after && before !== after) e.waitUntil(tellClients({ type: 'update-available' }));
          }
        }
        return res;
      });
      // Keep the worker alive until the background refresh finishes (the page already has its answer).
      if (cached) e.waitUntil(fetchPromise.catch(() => {}));
      return cached || fetchPromise;
    })
  );
});
