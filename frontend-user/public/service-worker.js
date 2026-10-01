// Pet Protocols — Production-Safe Progressive Web App Service Worker
// Version: 2.0.0

const CACHE_VERSION = 'pet-protocols-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const OFFLINE_URL = '/offline';
const OFFLINE_HTML = '/offline.html';

const PRECACHE_ASSETS = [
  OFFLINE_URL,
  OFFLINE_HTML,
  '/manifest.webmanifest',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-192x192.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32x32.png',
  '/screenshots/desktop-home.png',
  '/screenshots/mobile-home.png',
  '/images/logo1.png',
];

// 1. Install Event: Activate immediately and pre-cache app shell assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      await Promise.allSettled(
        PRECACHE_ASSETS.map(async (asset) => {
          try {
            await cache.add(asset);
          } catch (err) {
            // Non-blocking: continue precaching remaining assets
          }
        })
      );
    })
  );
});

// 2. Activate Event: Claim control immediately and delete legacy caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name.startsWith('pet-protocols-') && name !== STATIC_CACHE) {
              return caches.delete(name);
            }
            return null;
          })
        );
      }),
    ])
  );
});

// 3. Message Event: Support external update controllers & PWABuilder triggers
self.addEventListener('message', (event) => {
  if (event.data && (event.data.type === 'SKIP_WAITING' || event.data === 'skipWaiting')) {
    self.skipWaiting();
  }
});

// 4. Fetch Event: Conservative, privacy-safe caching
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Exclude non-GET requests (POST, PUT, DELETE, PATCH must always hit network)
  if (request.method !== 'GET') {
    return;
  }

  // Exclude non-http(s) schemes (e.g., chrome-extension://)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Strictly NEVER cache private user data, authentication, cart, checkout, or orders
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.includes('/checkout') ||
    url.pathname.includes('/orders') ||
    url.pathname.includes('/profile') ||
    url.pathname.includes('/cart')
  ) {
    return;
  }

  // Detect HTML navigation requests
  const isNavigation =
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    (request.headers.get('accept') && request.headers.get('accept').includes('text/html'));

  if (isNavigation) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        // 1. Try cached Next.js /offline route
        const cachedOffline = await cache.match(OFFLINE_URL);
        if (cachedOffline) {
          return cachedOffline;
        }
        // 2. Try static offline.html
        const cachedHtml = await cache.match(OFFLINE_HTML);
        if (cachedHtml) {
          return cachedHtml;
        }
        // 3. Fallback standalone offline response
        return new Response(
          `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offline — Pet Protocols</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #FAF7F2; color: #1E293B; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; text-align: center; }
    .card { background: #FFFFFF; border: 1px solid #E2E8F0; padding: 36px 24px; border-radius: 24px; max-width: 420px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); }
    h1 { font-size: 22px; font-weight: 800; margin: 0 0 12px; color: #0F172A; }
    p { font-size: 14px; color: #64748B; margin: 0 0 24px; line-height: 1.5; }
    button { background: #EA580C; color: white; border: none; padding: 12px 24px; font-size: 14px; font-weight: 700; border-radius: 14px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <h1>You are currently offline</h1>
    <p>Pet Protocols requires an active connection to view live menus and place orders.</p>
    <button onclick="window.location.reload()">Retry Connection</button>
  </div>
</body>
</html>`,
          {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          }
        );
      })
    );
    return;
  }

  // Static images, icons, and safe branding assets (Cache-first, network fallback)
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              const responseToCache = networkResponse.clone();
              caches.open(STATIC_CACHE).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(() => Response.error());
      })
    );
    return;
  }

  // Default: Normal direct network request
});

// 5. Push Event: Receive and display background web push notifications
self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = {
      title: 'Pet Protocols',
      body: event.data.text(),
    };
  }

  const title = data.title || 'Pet Protocols';
  const options = {
    body: data.body || 'You have a new update from Pet Protocols.',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/favicon-32x32.png',
    data: data.data || { url: '/orders' },
    tag: data.tag || 'pet-protocols-notification',
    renotify: true,
    vibrate: [100, 50, 100],
    actions: data.actions || [
      { action: 'open', title: 'View' },
      { action: 'close', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 6. Notification Click Event: Navigate user to relevant order or page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/orders';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If a window is already open with the app, focus it and navigate
        for (const client of clientList) {
          if (client.url && 'focus' in client) {
            client.focus();
            if ('navigate' in client) {
              return client.navigate(targetUrl);
            }
            return;
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

