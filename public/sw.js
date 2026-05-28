const CACHE = 'tracker-v6';
const ASSETS = [
  '/',
  '/css/style.css',
  '/js/utils.js',
  '/js/api.js',
  '/js/app.js',
  '/js/pages/login.js',
  '/js/pages/dashboard.js',
  '/js/pages/entries.js',
  '/js/pages/workflows.js',
  '/js/pages/ai-chat.js',
  '/js/pages/today.js',
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
  const url = new URL(e.request.url);
  // Never cache API calls
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request));
    return;
  }
  // Network-first for HTML (always get latest)
  if (e.request.mode === 'navigate' || url.pathname === '/') {
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  // Cache-first for static assets
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

self.addEventListener('push', (e) => {
  if (!e.data) return;
  const data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.title || '提醒', {
      body: data.body || '',
      icon: data.icon || '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      tag: 'reminder',
      requireInteraction: true
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(clients => {
      if (clients.length > 0) {
        clients[0].focus();
      } else {
        clients.openWindow('/');
      }
    })
  );
});
