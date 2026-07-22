/* Service worker — offline support for Mera Khata */
const CACHE = 'altariq-hisaab-v22';
const ASSETS = [
  './app.html',
  './view.html',
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
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
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
  // Customer page (view.html) aur marketing website (index.html/root): NETWORK-FIRST —
  // hamesha taza. Offline par cache fallback.
  const p = url.pathname;
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
