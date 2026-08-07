// Basic service worker for Pantry Snap PWA
// Provides app shell caching for offline reliability

const CACHE_NAME = 'pantry-snap-v2';
const SHELL_ASSETS = [
  '/',
  '/index.html',
];

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Push: expiry reminders sent by netlify/functions/expiry-notifications.mjs.
// Payload: { title, body, url?, tag? }
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'Pantry Snap', {
      body: payload.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: payload.tag || 'pantry-expiry',
      data: { url: payload.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

// Fetch: network-first for API, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and Supabase API requests
  if (request.method !== 'GET' || url.hostname.includes('supabase')) {
    return;
  }

  // For navigation requests, try network then fall back to cached index.html (SPA).
  // Refresh the cached copy on every successful fetch — otherwise the fallback
  // stays frozen at whatever was cached on install and, after a redeploy, points
  // offline users at asset hashes that no longer exist.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        // Only the app entry may refresh the cached shell — a navigation to a
        // real static page (e.g. /legal/privacy.html) must not become the
        // offline fallback for the whole app.
        if (response && response.status === 200 && (url.pathname === '/' || url.pathname === '/index.html')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
        }
        return response;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // For assets: stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      // Never resolve respondWith() to undefined — with no cached copy the
      // browser must see a real network error, not a silent empty response.
      }).catch(() => cached || Response.error());

      return cached || fetchPromise;
    })
  );
});
