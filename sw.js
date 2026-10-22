/* Service worker — offline support for Mera Khata */
const CACHE = 'altariq-hisaab-v117';
const ASSETS = [
  './app.html',
  './view.html',
  './studio.html',
  './oghi.html',
  './hisaab.html',
  './manifest.json',
  './css/styles.css',
  './js/firebase-config.js',
  './js/logo.js',
  './js/store.js',
  './js/cloud.js',
  './js/app.js',
  './assets/logo.png',
  './assets/mark.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/favicon.png',
  './assets/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  // best-effort: koi aik file missing/404 ho to bhi install fail na ho (pehle addAll
  // aik missing file par poora SW install tor deta tha — updates/offline ruk jate the).
  e.waitUntil(
    caches.open(CACHE)
      // cache:'reload' -> browser ki HTTP cache se purani file NA uthao, seedha server se taaza
      .then(c => Promise.all(ASSETS.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const p = url.pathname;
  if (p.endsWith('version.json')) return; // hamesha seedha server (force-update check)
  // APP SHELL (app.html): network-first LEKIN 2s me network na aaye to CACHE se foran
  // khol do — slow internet par app turant khule, net theek ho to taza le le.
  if (url.origin === location.origin && p.endsWith('app.html')) {
    // network se taaza copy — waitUntil taake slow net par bhi (jab cache se khol diya) ye
    // poori ho kar cache update kare (pehle SW beech me band ho jata tha -> purana version atka rehta)
    const net = fetch(e.request, { cache: 'no-cache' }).then(async res => {
      if (res && res.ok) { const copy = res.clone(); const c = await caches.open(CACHE); await c.put(e.request, copy); }
      return res;
    }).catch(() => null);
    e.waitUntil(net);
    e.respondWith((async () => {
      const cached = await caches.match(e.request);
      if (!cached) return (await net) || fetch(e.request); // pehli dafa: cache nahi, net ka intezaar
      const timeout = new Promise(r => setTimeout(() => r(null), 2000));
      return (await Promise.race([net, timeout])) || cached; // slow net -> 2s baad cache se khol do
    })());
    return;
  }
  // Customer page (view.html) aur marketing website (index.html/root): NETWORK-FIRST —
  // hamesha taza. Offline par cache fallback.
  if (url.origin === location.origin &&
      (p.endsWith('view.html') || p.endsWith('index.html') || p === '/' || p.endsWith('/') || p.includes('/data/'))) {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  // Our own files: stale-while-revalidate — cache se FORAN do (app turant khule),
  // background me network se taza kar lo (agli dafa nayi code mil jaye).
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const network = fetch(e.request).then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }
  // Everything else: cache-first
  e.respondWith(caches.match(e.request).then(c => c || fetch(e.request)));
});
