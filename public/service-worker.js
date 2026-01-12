// OpenTicket Service Worker
// Version 2.0.0 - FORCE CACHE CLEAR FOR BUG FIXES
const CACHE_VERSION = 'v2-1768240810646';
const CACHE_NAME = `openticket-scanner-${CACHE_VERSION}`;
const RUNTIME_CACHE = `openticket-runtime-${CACHE_VERSION}`;

console.log('[SW] Service Worker v2 loaded - FORCE CACHE CLEAR');

// Assets to cache immediately on install
const PRECACHE_ASSETS = [];  // Don't precache to force fresh loads

// API endpoints that should use network-first strategy
const API_ROUTES = [
  '/api/registrations/checkin',
  '/api/events',
  '/api/admin'
];

// Install event - DELETE ALL OLD CACHES
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v2 - CLEARING ALL CACHES...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('[SW] Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      console.log('[SW] All caches cleared, skipping waiting');
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
            })
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - handle network requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    // For POST requests (like check-in), try network and queue if offline
    if (url.pathname.includes('/api/registrations/checkin')) {
      event.respondWith(
        fetch(request)
          .catch(async (error) => {
            // Queue the request for later sync
            console.log('[SW] Check-in failed, queuing for sync:', error);
            
            // Store in IndexedDB for background sync
            const body = await request.clone().text();
            await queueOfflineCheckIn({
              url: request.url,
              method: request.method,
              headers: Object.fromEntries(request.headers.entries()),
              body: body,
              timestamp: Date.now()
            });
            
            // Return offline response
            return new Response(JSON.stringify({
              success: false,
              offline: true,
              message: 'Check-in queued for sync when online',
              queued: true
            }), {
              status: 202,
              headers: { 'Content-Type': 'application/json' }
            });
          })
      );
      return;
    }
    return;
  }

  // API requests - Network first, then cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      networkFirstStrategy(request)
    );
    return;
  }

  // Static assets - Cache first, then network
  event.respondWith(
    cacheFirstStrategy(request)
  );
});

// Cache-first strategy (for static assets)
async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Fetch failed, returning offline page:', error);
    return new Response('Offline', { status: 503 });
  }
}

// Network-first strategy (for API calls)
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    if (response.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      console.log('[SW] Network failed, returning cached response');
      return cached;
    }
    throw error;
  }
}

// Queue offline check-ins to IndexedDB
async function queueOfflineCheckIn(requestData) {
  try {
    // Open IndexedDB
    const db = await openDB();
    const tx = db.transaction('offline_checkins', 'readwrite');
    const store = tx.objectStore('offline_checkins');
    
    await store.add(requestData);
    console.log('[SW] Queued offline check-in');
  } catch (error) {
    console.error('[SW] Failed to queue check-in:', error);
  }
}

// Open IndexedDB connection
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('OpenTicketDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object stores
      if (!db.objectStoreNames.contains('offline_checkins')) {
        const store = db.createObjectStore('offline_checkins', { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('scan_analytics')) {
        const store = db.createObjectStore('scan_analytics', { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        store.createIndex('eventId', 'eventId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

// Background sync event - sync offline check-ins
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-checkins') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(syncOfflineCheckIns());
  }
});

// Sync offline check-ins when back online
async function syncOfflineCheckIns() {
  try {
    const db = await openDB();
    const tx = db.transaction('offline_checkins', 'readonly');
    const store = tx.objectStore('offline_checkins');
    const requests = await store.getAll();
    
    console.log(`[SW] Syncing ${requests.length} offline check-ins`);
    
    for (const requestData of requests) {
      try {
        const response = await fetch(requestData.url, {
          method: requestData.method,
          headers: requestData.headers,
          body: requestData.body
        });
        
        if (response.ok) {
          // Remove from queue after successful sync
          const deleteTx = db.transaction('offline_checkins', 'readwrite');
          const deleteStore = deleteTx.objectStore('offline_checkins');
          await deleteStore.delete(requestData.id);
          console.log('[SW] Synced check-in:', requestData.id);
        }
      } catch (error) {
        console.error('[SW] Failed to sync check-in:', error);
      }
    }
    
    // Notify clients that sync is complete
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        count: requests.length
      });
    });
  } catch (error) {
    console.error('[SW] Sync failed:', error);
  }
}

// Message event - handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(RUNTIME_CACHE)
        .then(cache => cache.addAll(event.data.urls))
    );
  }
});

console.log('[SW] Service Worker loaded');
