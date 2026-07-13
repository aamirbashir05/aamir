/* Service worker — offline support for Mera Khata */
const CACHE = 'altariq-hisaab-v3';
const ASSETS = [
  './',
  './index.html',
  './view.html',
  './manifest.json',
  './css/styles.css',
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
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => cached)
    )
  );
});
