// Pet Protocols Restaurant Admin Portal — Web Push Service Worker
// Version: 1.0.0

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data && (event.data.type === 'SKIP_WAITING' || event.data === 'skipWaiting')) {
    self.skipWaiting();
  }
});

// Push Event: Deliver real-time kitchen & order push alerts from VAPID
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Kitchen Alert 🔔', body: event.data.text() };
    }
  }

  const title = data.title || 'Restaurant Alert 🔔';
  const options = {
    body: data.body || 'You have a new restaurant order or status update.',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/favicon-32x32.png',
    data: data.data || { url: data.url || '/orders' },
    tag: data.tag || 'pet-admin-order-alert',
    renotify: true,
    requireInteraction: true, // Keep notification visible on desktop until actioned
    vibrate: [200, 100, 200, 100, 200],
    actions: [
      { action: 'open_orders', title: 'View Orders' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification Click Event: Focus or open the Kitchen Orders page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/orders';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. If an existing admin portal tab is already open, focus and navigate it
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // 2. Otherwise open a new window to the target orders URL
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
