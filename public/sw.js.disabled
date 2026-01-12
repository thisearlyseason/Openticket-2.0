// OpenTicket Service Worker - PWA with Push Notifications & Offline Support
// VERSION: 4 - Updated 2026-01-11
const SW_VERSION = 'v4';
const CACHE_NAME = `openticket-${SW_VERSION}`;
const OFFLINE_CACHE = `openticket-offline-${SW_VERSION}`;

// Log version on load for debugging
console.log(`[SW] Service Worker ${SW_VERSION} loaded`);

// Assets to cache for offline use
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing Service Worker ${SW_VERSION}...`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log(`[SW] ${SW_VERSION} installed, skipping waiting`);
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating Service Worker ${SW_VERSION}...`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      console.log('[SW] Found caches:', cacheNames);
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('openticket') && name !== CACHE_NAME && name !== OFFLINE_CACHE)
          .map((name) => {
            console.log(`[SW] Deleting old cache: ${name}`);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log(`[SW] ${SW_VERSION} now active and controlling all clients`);
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // API requests - network first, cache for offline
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful API responses for offline use
          if (response.ok && (
            url.pathname.includes('/events/') ||
            url.pathname.includes('/registrations/')
          )) {
            const responseClone = response.clone();
            caches.open(OFFLINE_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Return cached response if offline
          return caches.match(request);
        })
    );
    return;
  }

  // HTML and navigation requests - ALWAYS network first to ensure fresh content
  // This prevents stale HTML serving old JS bundle references
  if (request.mode === 'navigate' || 
      url.pathname === '/' || 
      url.pathname.endsWith('.html') ||
      url.search.includes('success=') ||
      url.search.includes('stripe_return=') ||
      url.search.includes('session_id=')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the fresh response for offline use
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Only use cache as fallback when offline
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || new Response('Offline', { status: 503 });
          });
        })
    );
    return;
  }

  // JS and CSS files - network first for freshness, cache as fallback
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // Other static assets (images, fonts) - cache first for performance
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((response) => {
          // Cache new static assets
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
  );
});

// Background sync for offline check-ins
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-checkins') {
    console.log('[SW] Syncing offline check-ins...');
    event.waitUntil(syncOfflineCheckIns());
  }
});

async function syncOfflineCheckIns() {
  // This will be called when the device comes back online
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_CHECKINS' });
  });
}

// Push notification handler
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  let data = {
    title: 'OpenTicket',
    body: 'You have a new notification',
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-72.svg',
    tag: 'openticket',
    data: {}
  };
  
  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.svg',
    badge: data.badge || '/icons/icon-72.svg',
    tag: data.tag || 'openticket',
    data: data.data || {},
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
    vibrate: [200, 100, 200],
    timestamp: data.timestamp || Date.now()
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag);
  
  event.notification.close();
  
  const action = event.action;
  const data = event.notification.data || {};
  
  // Handle specific actions
  if (action === 'dismiss') {
    return;
  }
  
  // Determine URL to open
  let urlToOpen = '/';
  
  if (data.url) {
    urlToOpen = data.url;
  } else if (data.eventId) {
    urlToOpen = `/#/event/${data.eventId}`;
  } else if (data.registrationId) {
    urlToOpen = `/#/ticket/${data.registrationId}`;
  }
  
  // Focus existing window or open new one
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there's already a window open
        for (const client of windowClients) {
          if (client.url.includes(self.registration.scope)) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // Open new window if none exists
        return clients.openWindow(urlToOpen);
      })
  );
});

// Notification close handler (for analytics)
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event.notification.tag);
});

// Message handler (for communication with main app)
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
