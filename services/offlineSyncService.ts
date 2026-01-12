// Offline Sync Service
// Handles IndexedDB operations for offline check-ins and analytics

const DB_NAME = 'OpenTicketDB';
const DB_VERSION = 1;

// Object store names
const STORES = {
  OFFLINE_CHECKINS: 'offline_checkins',
  SCAN_ANALYTICS: 'scan_analytics',
  CACHED_EVENTS: 'cached_events',
  CACHED_REGISTRATIONS: 'cached_registrations'
};

class OfflineSyncService {
  private db: IDBDatabase | null = null;

  // Initialize IndexedDB
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[OfflineSync] Failed to open DB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[OfflineSync] DB initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        console.log('[OfflineSync] Upgrading DB schema...');

        // Offline check-ins store
        if (!db.objectStoreNames.contains(STORES.OFFLINE_CHECKINS)) {
          const checkinStore = db.createObjectStore(STORES.OFFLINE_CHECKINS, {
            keyPath: 'id',
            autoIncrement: true
          });
          checkinStore.createIndex('ticketId', 'ticketId', { unique: false });
          checkinStore.createIndex('timestamp', 'timestamp', { unique: false });
          checkinStore.createIndex('synced', 'synced', { unique: false });
        }

        // Scan analytics store
        if (!db.objectStoreNames.contains(STORES.SCAN_ANALYTICS)) {
          const analyticsStore = db.createObjectStore(STORES.SCAN_ANALYTICS, {
            keyPath: 'id',
            autoIncrement: true
          });
          analyticsStore.createIndex('eventId', 'eventId', { unique: false });
          analyticsStore.createIndex('timestamp', 'timestamp', { unique: false });
          analyticsStore.createIndex('success', 'success', { unique: false });
        }

        // Cached events store
        if (!db.objectStoreNames.contains(STORES.CACHED_EVENTS)) {
          const eventsStore = db.createObjectStore(STORES.CACHED_EVENTS, {
            keyPath: 'id'
          });
          eventsStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
        }

        // Cached registrations store
        if (!db.objectStoreNames.contains(STORES.CACHED_REGISTRATIONS)) {
          const regsStore = db.createObjectStore(STORES.CACHED_REGISTRATIONS, {
            keyPath: 'id'
          });
          regsStore.createIndex('eventId', 'eventId', { unique: false });
          regsStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
        }
      };
    });
  }

  // Queue offline check-in
  async queueCheckIn(ticketId: string, eventId: string, token: string): Promise<number> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORES.OFFLINE_CHECKINS, 'readwrite');
      const store = tx.objectStore(STORES.OFFLINE_CHECKINS);

      const checkInData = {
        ticketId,
        eventId,
        token,
        timestamp: Date.now(),
        synced: false
      };

      const request = store.add(checkInData);

      request.onsuccess = () => {
        console.log('[OfflineSync] Queued check-in:', ticketId);
        resolve(request.result as number);
      };

      request.onerror = () => {
        console.error('[OfflineSync] Failed to queue check-in:', request.error);
        reject(request.error);
      };
    });
  }

  // Get all pending check-ins
  async getPendingCheckIns(): Promise<any[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORES.OFFLINE_CHECKINS, 'readonly');
      const store = tx.objectStore(STORES.OFFLINE_CHECKINS);
      const index = store.index('synced');
      const request = index.getAll(false);

      request.onsuccess = () => {
        console.log('[OfflineSync] Found pending check-ins:', request.result.length);
        resolve(request.result);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Mark check-in as synced
  async markCheckInSynced(id: number): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORES.OFFLINE_CHECKINS, 'readwrite');
      const store = tx.objectStore(STORES.OFFLINE_CHECKINS);
      const request = store.get(id);

      request.onsuccess = () => {
        const data = request.result;
        if (data) {
          data.synced = true;
          data.syncedAt = Date.now();
          store.put(data);
        }
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Delete synced check-in
  async deleteCheckIn(id: number): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORES.OFFLINE_CHECKINS, 'readwrite');
      const store = tx.objectStore(STORES.OFFLINE_CHECKINS);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Save scan analytics
  async saveScanAnalytics(data: {
    eventId: string;
    ticketId?: string;
    success: boolean;
    errorMessage?: string;
    duration: number;
    timestamp: number;
  }): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORES.SCAN_ANALYTICS, 'readwrite');
      const store = tx.objectStore(STORES.SCAN_ANALYTICS);
      const request = store.add(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Get scan analytics for event
  async getScanAnalytics(eventId: string): Promise<any[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORES.SCAN_ANALYTICS, 'readonly');
      const store = tx.objectStore(STORES.SCAN_ANALYTICS);
      const index = store.index('eventId');
      const request = index.getAll(eventId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Cache event data
  async cacheEvent(eventId: string, eventData: any): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORES.CACHED_EVENTS, 'readwrite');
      const store = tx.objectStore(STORES.CACHED_EVENTS);
      
      const cacheData = {
        id: eventId,
        data: eventData,
        lastUpdated: Date.now()
      };

      const request = store.put(cacheData);

      request.onsuccess = () => {
        console.log('[OfflineSync] Cached event:', eventId);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Get cached event
  async getCachedEvent(eventId: string): Promise<any | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORES.CACHED_EVENTS, 'readonly');
      const store = tx.objectStore(STORES.CACHED_EVENTS);
      const request = store.get(eventId);

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          console.log('[OfflineSync] Retrieved cached event:', eventId);
          resolve(result.data);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Cache registrations for event
  async cacheRegistrations(eventId: string, registrations: any[]): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORES.CACHED_REGISTRATIONS, 'readwrite');
      const store = tx.objectStore(STORES.CACHED_REGISTRATIONS);

      registrations.forEach(reg => {
        store.put({
          id: reg.id,
          eventId: eventId,
          data: reg,
          lastUpdated: Date.now()
        });
      });

      tx.oncomplete = () => {
        console.log('[OfflineSync] Cached registrations for event:', eventId);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  // Get cached registrations
  async getCachedRegistrations(eventId: string): Promise<any[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORES.CACHED_REGISTRATIONS, 'readonly');
      const store = tx.objectStore(STORES.CACHED_REGISTRATIONS);
      const index = store.index('eventId');
      const request = index.getAll(eventId);

      request.onsuccess = () => {
        const results = request.result.map(item => item.data);
        console.log('[OfflineSync] Retrieved cached registrations:', results.length);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Clear all data (for logout)
  async clearAll(): Promise<void> {
    if (!this.db) await this.init();

    const stores = Object.values(STORES);
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(stores, 'readwrite');

      stores.forEach(storeName => {
        tx.objectStore(storeName).clear();
      });

      tx.oncomplete = () => {
        console.log('[OfflineSync] Cleared all data');
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  // Get database stats
  async getStats(): Promise<{
    pendingCheckIns: number;
    scanAnalytics: number;
    cachedEvents: number;
    cachedRegistrations: number;
  }> {
    if (!this.db) await this.init();

    const [pendingCheckIns, scanAnalytics, cachedEvents, cachedRegistrations] = await Promise.all([
      this.getPendingCheckIns().then(data => data.length),
      this.countRecords(STORES.SCAN_ANALYTICS),
      this.countRecords(STORES.CACHED_EVENTS),
      this.countRecords(STORES.CACHED_REGISTRATIONS)
    ]);

    return {
      pendingCheckIns,
      scanAnalytics,
      cachedEvents,
      cachedRegistrations
    };
  }

  private async countRecords(storeName: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// Export singleton instance
export const offlineSyncService = new OfflineSyncService();
export default offlineSyncService;
