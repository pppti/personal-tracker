const CACHE = 'tracker-v1';
const ASSETS = [
  '/',
  '/css/style.css',
  '/js/utils.js',
  '/js/api.js',
  '/js/app.js',
  '/js/pages/login.js',
  '/js/pages/dashboard.js',
  '/js/pages/entries.js',
  '/js/pages/summary.js',
  '/js/pages/reminders.js',
  '/js/pages/settings.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).then(res => {
        if (res.ok && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
