const CACHE_NAME = 'mafiya-cache-v3';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/style.css',
  './js/i18n.js',
  './js/audio.js',
  './js/socketClient.js',
  './js/app.js',
  './js/paho-mqtt.min.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-192.svg',
  './icons/icon-512.png',
  './icons/icon-512.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('[SW] Ba\'zi fayllarni keshga olib bo\'lmadi:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Eski kesh tozalandi:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // Real-time Socket.io, MQTT yoki tashqi API so'rovlarini keshlamaymiz
  if (
    url.includes('/socket.io/') ||
    url.includes('broker.hivemq.com') ||
    url.includes('broker.emqx.io') ||
    e.request.method !== 'GET'
  ) {
    return;
  }

  // HTML / Asosiy sahifa: Network-first, tarmoq bo'lmasa keshdan
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          return response;
        })
        .catch(() => caches.match(e.request).then(res => res || caches.match('./index.html')))
    );
    return;
  }

  // Statik fayllar (CSS, JS, Fonts, Icons): Cache-first with network fallback
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fonda yangilab qo'yamiz (stale-while-revalidate)
        fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return networkResponse;
      });
    }).catch(() => {
      // Offline fallback
      return caches.match('./index.html');
    })
  );
});
