const CACHE = 'vitalcare-paciente-v3';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './data.js',
  './script.js',
  './manifest.webmanifest',
  './assets/logo-vitalcare-2.0.png',
  './assets/favicon.svg'
];
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(resp => {
    const copy = resp.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return resp;
  }).catch(() => caches.match(e.request).then(cached => cached || caches.match('./index.html'))));
});
