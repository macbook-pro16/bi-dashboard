// PWA Service Worker (minimum)
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // オフラインキャッシュは行わない
  event.respondWith(fetch(event.request));
});