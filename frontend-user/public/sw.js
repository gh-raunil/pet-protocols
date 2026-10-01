// Pet Protocols — Production-Safe Progressive Web App Service Worker
// Version: 1.0.0

const CACHE_VERSION = 'pet-protocols-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const OFFLINE_URL = '/offline';

const PRECACHE_ASSETS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-192x192.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32x32.png',
  '/images/logo1.png',
];

// Install Event: Pre-cache app shell and offline page
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        // Continue even if an asset fails to precache
        console.warn('[PWA] Pre-cache warning:', err);
      })
  );
});

// Activate Event: Clean up outdated caches owned by Pet Protocols
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name.startsWith('pet-protocols-') && name !== STATIC_CACHE) {
              return caches.delete(name);
            }
            return null;
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch Event: Safe, conservative caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Never handle non-GET requests (POST, PUT, DELETE, PATCH must always hit network directly)
  if (request.method !== 'GET') {
    return;
  }

  // 2. Ignore non-http(s) schemes like chrome-extension
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 3. EXCLUDE all API and auth requests from service worker caching
  // Never cache authentication, checkout, user orders, or private cart endpoints
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.includes('/checkout') ||
    url.pathname.includes('/orders') ||
    url.pathname.includes('/profile')
  ) {
    return;
  }

  // 4. HTML Navigation Requests (Network-First with Offline Fallback)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cachedOffline = await cache.match(OFFLINE_URL);
        return cachedOffline || Response.error();
      })
    );
    return;
  }

  // 5. Static Images & Icons (Cache-First, Network Fallback)
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

  // 6. Default: Network directly
});
