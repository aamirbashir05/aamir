/* Service worker — offline support for Mera Khata */
const CACHE = 'altariq-hisaab-v13';
const ASSETS = [
  './',
  './index.html',
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
  // view.html (customer ka hisaab page): NETWORK-FIRST — hamesha taza, taake purani
  // cache ki wajah se customer ko ghalat/NaN data na dikhe. Offline par cache fallback.
  if (url.origin === location.origin && url.pathname.endsWith('view.html')) {
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
