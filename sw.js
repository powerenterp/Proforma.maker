/* Proforma service worker
   Network-first: the app always loads the newest files when online,
   and falls back to the saved copy when offline.
   Change CACHE (e.g. proforma-v4) whenever you want to force a clean start. */
const CACHE = 'proforma-v4';
const SHELL = ['index.html', 'manifest.webmanifest'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled(SHELL.map(u => c.add(new Request(u, { cache: 'reload' }))))
    )
  );
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

// Safari/Chrome reject redirected responses for page loads, so copy them cleanly.
const clean = async res =>
  res.redirected
    ? new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers })
    : res;

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // never touch saves/logins
  if (new URL(req.url).origin !== location.origin) return; // server/API calls go straight through

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await clean(await fetch(req, { cache: 'no-cache' }));
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const shell = await cache.match('index.html');
        if (shell) return shell;
      }
      return Response.error();
    }
  })());
});
