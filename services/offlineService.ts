/**
 * Offline Check-In Service
 * Handles storing check-ins locally when offline and syncing when back online
 */

import { get, set, del, keys, createStore } from 'idb-keyval';

// Create a dedicated store for offline check-ins
const offlineStore = createStore('openticket-offline', 'checkins');

export interface OfflineCheckIn {
    id: string;
    eventId: string;
    registrationId: string;
    ticketKey: string;
    checkedIn: boolean;
    timestamp: number;
    synced: boolean;
    attendeeName?: string;
}

export interface CachedEvent {
    id: string;
    title: string;
    date: number;
    cachedAt: number;
}

export interface CachedRegistration {
    id: string;
    eventId: string;
    attendeeName: string;
    attendeeEmail: string;
    tickets: any[];
    checkInStatuses: Record<string, { checkedIn: boolean; timestamp: number }>;
    paymentStatus: string;
    cachedAt: number;
}

export const OfflineService = {
    /**
     * Check if the device is online
     */
    isOnline: (): boolean => {
        return navigator.onLine;
    },

    /**
     * Save a check-in action for later sync
     */
    saveOfflineCheckIn: async (checkIn: Omit<OfflineCheckIn, 'id' | 'synced'>): Promise<string> => {
        const id = `checkin_${checkIn.registrationId}_${checkIn.ticketKey}_${Date.now()}`;
        const offlineCheckIn: OfflineCheckIn = {
            ...checkIn,
            id,
            synced: false
        };
        
        await set(id, offlineCheckIn, offlineStore);
        console.log('[OfflineService] Saved offline check-in:', id);
        return id;
    },

    /**
     * Get all pending (unsynced) check-ins
     */
    getPendingCheckIns: async (): Promise<OfflineCheckIn[]> => {
        const allKeys = await keys(offlineStore);
        const pending: OfflineCheckIn[] = [];
        
        for (const key of allKeys) {
            if (String(key).startsWith('checkin_')) {
                const checkIn = await get<OfflineCheckIn>(key, offlineStore);
                if (checkIn && !checkIn.synced) {
                    pending.push(checkIn);
                }
            }
        }
        
        return pending;
    },

    /**
     * Mark a check-in as synced
     */
    markCheckInSynced: async (id: string): Promise<void> => {
        const checkIn = await get<OfflineCheckIn>(id, offlineStore);
        if (checkIn) {
            checkIn.synced = true;
            await set(id, checkIn, offlineStore);
        }
    },

    /**
     * Delete a synced check-in
     */
    deleteCheckIn: async (id: string): Promise<void> => {
        await del(id, offlineStore);
    },

    /**
     * Clear all synced check-ins (cleanup)
     */
    clearSyncedCheckIns: async (): Promise<void> => {
        const allKeys = await keys(offlineStore);
        
        for (const key of allKeys) {
            if (String(key).startsWith('checkin_')) {
                const checkIn = await get<OfflineCheckIn>(key, offlineStore);
                if (checkIn?.synced) {
                    await del(key, offlineStore);
                }
            }
        }
    },

    /**
     * Cache event data for offline use
     */
    cacheEvent: async (event: CachedEvent): Promise<void> => {
        await set(`event_${event.id}`, { ...event, cachedAt: Date.now() }, offlineStore);
    },

    /**
     * Get cached event
     */
    getCachedEvent: async (eventId: string): Promise<CachedEvent | null> => {
        return await get<CachedEvent>(`event_${eventId}`, offlineStore) || null;
    },

    /**
     * Cache registrations for offline use
     */
    cacheRegistrations: async (eventId: string, registrations: CachedRegistration[]): Promise<void> => {
        const data = {
            eventId,
            registrations: registrations.map(r => ({ ...r, cachedAt: Date.now() })),
            cachedAt: Date.now()
        };
        await set(`registrations_${eventId}`, data, offlineStore);
    },

    /**
     * Get cached registrations
     */
    getCachedRegistrations: async (eventId: string): Promise<CachedRegistration[] | null> => {
        const data = await get<{ registrations: CachedRegistration[] }>(`registrations_${eventId}`, offlineStore);
        return data?.registrations || null;
    },

    /**
     * Apply offline check-in to cached data (for UI display)
     */
    applyOfflineCheckIn: (
        registrations: CachedRegistration[],
        registrationId: string,
        ticketKey: string,
        checkedIn: boolean,
        timestamp: number
    ): CachedRegistration[] => {
        return registrations.map(reg => {
            if (reg.id === registrationId) {
                return {
                    ...reg,
                    checkInStatuses: {
                        ...reg.checkInStatuses,
                        [ticketKey]: { checkedIn, timestamp }
                    }
                };
            }
            return reg;
        });
    },

    /**
     * Get count of pending check-ins
     */
    getPendingCount: async (): Promise<number> => {
        const pending = await OfflineService.getPendingCheckIns();
        return pending.length;
    },

    /**
     * Listen for online/offline events
     */
    setupNetworkListeners: (onOnline: () => void, onOffline: () => void): () => void => {
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        
        // Also listen for service worker sync messages
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data?.type === 'SYNC_CHECKINS') {
                    onOnline();
                }
            });
        }
        
        return () => {
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
        };
    },

    /**
     * Request background sync (for browsers that support it)
     */
    requestSync: async (): Promise<void> => {
        if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
            const registration = await navigator.serviceWorker.ready;
            // @ts-ignore
            await registration.sync.register('sync-checkins');
        }
    }
};

export default OfflineService;
